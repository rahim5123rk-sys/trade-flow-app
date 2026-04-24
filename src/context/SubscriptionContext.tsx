import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {createContext, useCallback, useContext, useEffect, useState} from 'react';
import {Platform} from 'react-native';
import Purchases, {CustomerInfo, LOG_LEVEL, PurchasesOffering, PurchasesPackage} from 'react-native-purchases';
import {supabase} from '../config/supabase';
import {useAuth} from './AuthContext';

const PRO_CACHE_PREFIX = '@gaspilot_is_pro_cached:';

// Module-scoped RevenueCat identity state. Purchases.configure() is a no-op
// after the first call, so account switches must go through Purchases.logIn().
let rcConfigured = false;
let rcCurrentUserId: string | null = null;

type SeatTier = 'duo' | 'team' | 'crew' | 'fleet' | null;

type SubscriptionContextType = {
  isPro: boolean;
  isLoading: boolean;
  seatLimit: number;
  seatTier: SeatTier;
  stripeStatus: string | null;
  currentOffering: PurchasesOffering | null;
  purchasePackage: (pkg: PurchasesPackage) => Promise<void>;
  restorePurchases: () => Promise<void>;
};

const SubscriptionContext = createContext<SubscriptionContextType>({
  isPro: false,
  isLoading: true,
  seatLimit: 0,
  seatTier: null,
  stripeStatus: null,
  currentOffering: null,
  purchasePackage: async () => { },
  restorePurchases: async () => { },
});

export const SEAT_TIER_LABELS: Record<Exclude<SeatTier, null>, string> = {
  duo: 'Duo',
  team: 'Team',
  crew: 'Crew',
  fleet: 'Fleet',
};

function getSubscriptionType(info: CustomerInfo): string | null {
  const active = info.entitlements.active['pro'];
  if (!active) return null;
  const id = active.productIdentifier ?? '';
  if (id.includes('annual')) return 'annual';
  if (id.includes('lifetime')) return 'lifetime';
  return 'monthly';
}

export function SubscriptionProvider({children}: {children: React.ReactNode}) {
  const {session, userProfile} = useAuth();
  const [isPro, setIsPro] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [seatLimit, setSeatLimit] = useState(0);
  const [seatTier, setSeatTier] = useState<SeatTier>(null);
  const [stripeStatus, setStripeStatus] = useState<string | null>(null);
  const [currentOffering, setCurrentOffering] = useState<PurchasesOffering | null>(null);

  const userId = session?.user?.id ?? null;
  const proCacheKey = userId ? `${PRO_CACHE_PREFIX}${userId}` : null;

  // User-scoped cache restore on user change (no cross-account leak).
  useEffect(() => {
    if (!proCacheKey) {
      setIsPro(false);
      return;
    }
    AsyncStorage.getItem(proCacheKey).then((cached) => {
      if (cached === 'true') setIsPro(true);
      else if (cached === 'false') setIsPro(false);
    }).catch(() => { });
  }, [proCacheKey]);

  const updateIsPro = useCallback((value: boolean) => {
    setIsPro(value);
    if (proCacheKey) {
      AsyncStorage.setItem(proCacheKey, value ? 'true' : 'false').catch(() => { });
    }
  }, [proCacheKey]);

  // Sync admin's RevenueCat state to Supabase so workers see it via their profile.
  const syncToSupabase = useCallback(
    async (info: CustomerInfo) => {
      if (!userId) return;
      const active = info.entitlements.active['pro'];
      const tier = active ? 'pro' : 'starter';
      const subType = getSubscriptionType(info);
      const expiresAt = subType === 'lifetime' ? null : (active?.expirationDate ?? null);

      await supabase
        .from('profiles')
        .update({
          subscription_tier: tier,
          subscription_type: subType,
          subscription_expires_at: expiresAt,
          revenuecat_user_id: info.originalAppUserId,
        })
        .eq('id', userId);

      if (userProfile?.company_id) {
        await supabase
          .from('profiles')
          .update({subscription_tier: tier})
          .eq('company_id', userProfile.company_id)
          .neq('id', userId);
      }
    },
    [userId, userProfile?.company_id],
  );

  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    let listenerFn: ((info: CustomerInfo) => void) | null = null;

    const run = async () => {
      // 1. Authoritative fast path: read subscription_tier from Supabase.
      //    The RevenueCat webhook writes this for every account (admin + workers),
      //    so this works regardless of role and without touching the RC SDK.
      try {
        const {data} = await supabase
          .from('profiles')
          .select('subscription_tier, subscription_expires_at')
          .eq('id', userId)
          .maybeSingle();
        if (!cancelled && data) {
          const stillValid = !data.subscription_expires_at
            || new Date(data.subscription_expires_at as string).getTime() > Date.now();
          updateIsPro(data.subscription_tier === 'pro' && stillValid);
        }
      } catch (e) {
        console.warn('[Subscription] Profile tier check failed:', e);
      }

      // 1b. Company seat tier (Stripe-managed). Writable only by stripe-webhook.
      if (userProfile?.company_id) {
        try {
          const {data: company} = await supabase
            .from('companies')
            .select('worker_seat_limit, stripe_status, stripe_seat_tier')
            .eq('id', userProfile.company_id)
            .maybeSingle();
          if (!cancelled && company) {
            setSeatLimit(company.worker_seat_limit ?? 0);
            setStripeStatus((company.stripe_status as string) ?? null);
            const tier = company.stripe_seat_tier as SeatTier;
            setSeatTier(tier ?? null);
          }
        } catch (e) {
          console.warn('[Subscription] Company seat check failed:', e);
        }
      }

      if (cancelled) return;
      setIsLoading(false);

      // 2. Web: no RC SDK available.
      if (Platform.OS === 'web') return;

      // 3. Workers never need to hit RevenueCat — their tier is webhook-synced.
      if (userProfile?.role === 'worker') return;

      // 4. Admin (or unknown role yet): configure RC and reconcile.
      const iosKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '';
      const androidKey = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '';
      const apiKey = Platform.OS === 'ios' ? iosKey : androidKey;
      if (!apiKey || apiKey.includes('xxxx')) return;

      try {
        if (!rcConfigured) {
          Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);
          Purchases.configure({apiKey, appUserID: userId});
          rcConfigured = true;
          rcCurrentUserId = userId;
        } else if (rcCurrentUserId !== userId) {
          // Account switch on the same device — re-identify with RC.
          await Purchases.logIn(userId);
          rcCurrentUserId = userId;
        }

        listenerFn = (info: CustomerInfo) => {
          if (cancelled) return;
          const hasPro = typeof info.entitlements.active['pro'] !== 'undefined';
          updateIsPro(hasPro);
          void syncToSupabase(info);
        };
        Purchases.addCustomerInfoUpdateListener(listenerFn);

        const [info, offerings] = await Promise.all([
          Purchases.getCustomerInfo(),
          Purchases.getOfferings(),
        ]);
        if (cancelled) return;

        const hasProFromRC = typeof info.entitlements.active['pro'] !== 'undefined';
        // RC is the source of truth for the admin who actually owns the purchase.
        updateIsPro(hasProFromRC);
        setCurrentOffering(offerings.current);
        await syncToSupabase(info);
      } catch (e) {
        console.warn('[Subscription] RevenueCat init error:', e);
      }
    };

    run();

    return () => {
      cancelled = true;
      if (listenerFn) Purchases.removeCustomerInfoUpdateListener(listenerFn);
    };
  }, [userId, userProfile?.role, syncToSupabase, updateIsPro]);

  const purchasePackage = useCallback(async (pkg: PurchasesPackage) => {
    const {customerInfo} = await Purchases.purchasePackage(pkg);
    updateIsPro(typeof customerInfo.entitlements.active['pro'] !== 'undefined');
    await syncToSupabase(customerInfo);
  }, [syncToSupabase, updateIsPro]);

  // Worker seats are sold on the web via Stripe (gaspilotapp.com/team).
  // iOS IAP intentionally does not offer a seat product.

  const restorePurchases = useCallback(async () => {
    // Workers and web have no RC SDK — their source of truth is the profile
    // row, which the webhook keeps in sync. Re-read it and we're done.
    const refreshFromProfile = async () => {
      if (!userId) return;
      const {data} = await supabase
        .from('profiles')
        .select('subscription_tier, subscription_expires_at')
        .eq('id', userId)
        .maybeSingle();
      if (!data) return;
      const stillValid = !data.subscription_expires_at
        || new Date(data.subscription_expires_at as string).getTime() > Date.now();
      updateIsPro(data.subscription_tier === 'pro' && stillValid);
    };

    if (Platform.OS === 'web' || userProfile?.role === 'worker' || !rcConfigured) {
      await refreshFromProfile();
      return;
    }

    const info = await Purchases.restorePurchases();
    updateIsPro(typeof info.entitlements.active['pro'] !== 'undefined');
    await syncToSupabase(info);
  }, [syncToSupabase, updateIsPro, userId, userProfile?.role]);

  return (
    <SubscriptionContext.Provider value={{isPro, isLoading, seatLimit, seatTier, stripeStatus, currentOffering, purchasePackage, restorePurchases}}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export const useSubscription = () => useContext(SubscriptionContext);
