import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import Purchases, { CustomerInfo, LOG_LEVEL, PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import { supabase } from '../config/supabase';
import { useAuth } from './AuthContext';

const DEV_OVERRIDE_KEY = '@gaspilot_dev_starter_override';

type SubscriptionContextType = {
  isPro: boolean;
  isLoading: boolean;
  currentOffering: PurchasesOffering | null;
  purchasePackage: (pkg: PurchasesPackage) => Promise<void>;
  purchaseWorkerSeat: () => Promise<void>;
  restorePurchases: () => Promise<void>;
  devResetToStarter: () => Promise<void>;
};

const SubscriptionContext = createContext<SubscriptionContextType>({
  isPro: false,
  isLoading: true,
  currentOffering: null,
  purchasePackage: async () => {},
  purchaseWorkerSeat: async () => {},
  restorePurchases: async () => {},
  devResetToStarter: async () => {},
});

function getSubscriptionType(info: CustomerInfo): string | null {
  const active = info.entitlements.active['pro'];
  if (!active) return null;
  const id = active.productIdentifier ?? '';
  if (id.includes('annual')) return 'annual';
  if (id.includes('lifetime')) return 'lifetime';
  return 'monthly';
}

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { session, userProfile } = useAuth();
  const [isPro, setIsPro] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentOffering, setCurrentOffering] = useState<PurchasesOffering | null>(null);

  const isAdmin = userProfile?.role === 'admin';

  // Sync admin's subscription to Supabase (admin + all company members)
  const syncToSupabase = useCallback(
    async (info: CustomerInfo) => {
      if (!session?.user.id) return;
      const active = info.entitlements.active['pro'];
      const tier = active ? 'pro' : 'starter';
      const subType = getSubscriptionType(info);
      const expiresAt = subType === 'lifetime' ? null : (active?.expirationDate ?? null);

      // Update the admin's own profile
      await supabase
        .from('profiles')
        .update({
          subscription_tier: tier,
          subscription_type: subType,
          subscription_expires_at: expiresAt,
          revenuecat_user_id: info.originalAppUserId,
        })
        .eq('id', session.user.id);

      // Also sync all company members
      if (userProfile?.company_id) {
        await supabase
          .from('profiles')
          .update({ subscription_tier: tier })
          .eq('company_id', userProfile.company_id)
          .neq('id', session.user.id);
      }
    },
    [session?.user.id, userProfile?.company_id],
  );

  useEffect(() => {
    if (!session?.user.id) {
      setIsLoading(false);
      return;
    }

    // Workers (non-admin) or web: check Supabase directly instead of RevenueCat
    if (!isAdmin || Platform.OS === 'web') {
      const checkProfile = async () => {
        const { data } = await supabase
          .from('profiles')
          .select('subscription_tier')
          .eq('id', session.user.id)
          .single();
        setIsPro(data?.subscription_tier === 'pro');
        setIsLoading(false);
      };
      checkProfile();
      return;
    }

    // Admin on native: use RevenueCat
    const iosKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '';
    const androidKey = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '';
    const apiKey = Platform.OS === 'ios' ? iosKey : androidKey;

    if (!apiKey || apiKey.includes('xxxx')) {
      setIsLoading(false);
      return;
    }

    Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    Purchases.configure({ apiKey, appUserID: session.user.id });

    const listener = Purchases.addCustomerInfoUpdateListener(async (info) => {
      if (__DEV__) {
        const override = await AsyncStorage.getItem(DEV_OVERRIDE_KEY);
        if (override === 'true') return;
      }
      setIsPro(typeof info.entitlements.active['pro'] !== 'undefined');
      syncToSupabase(info);
    });

    const init = async () => {
      try {
        // Check dev override
        if (__DEV__) {
          const override = await AsyncStorage.getItem(DEV_OVERRIDE_KEY);
          if (override === 'true') {
            setIsPro(false);
            const offerings = await Purchases.getOfferings();
            setCurrentOffering(offerings.current);
            setIsLoading(false);
            return;
          }
        }

        const [info, offerings] = await Promise.all([
          Purchases.getCustomerInfo(),
          Purchases.getOfferings(),
        ]);
        setIsPro(typeof info.entitlements.active['pro'] !== 'undefined');
        setCurrentOffering(offerings.current);
        await syncToSupabase(info);
      } catch (e) {
        console.warn('RevenueCat init error:', e);
      } finally {
        setIsLoading(false);
      }
    };

    init();

    return () => { (listener as any)?.remove?.(); };
  }, [session?.user.id, isAdmin, syncToSupabase]);

  const purchasePackage = useCallback(async (pkg: PurchasesPackage) => {
    await AsyncStorage.removeItem(DEV_OVERRIDE_KEY);
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    setIsPro(typeof customerInfo.entitlements.active['pro'] !== 'undefined');
    await syncToSupabase(customerInfo);
  }, [syncToSupabase]);

  const purchaseWorkerSeat = useCallback(async () => {
    if (!currentOffering || !userProfile?.company_id) throw new Error('Not available');
    const seatPkg = currentOffering.availablePackages.find(
      (p) => p.identifier === '$rc_custom' || p.identifier === 'worker_seat' || p.product.identifier.includes('worker.seat'),
    );
    if (!seatPkg) throw new Error('Worker seat package not found');
    const { customerInfo } = await Purchases.purchasePackage(seatPkg);
    // Only increment seat limit if purchase actually went through
    if (customerInfo.entitlements.active['worker_seat'] || customerInfo.allPurchasedProductIdentifiers.includes(seatPkg.product.identifier)) {
      const { data: company } = await supabase
        .from('companies')
        .select('worker_seat_limit')
        .eq('id', userProfile.company_id)
        .single();
      const currentLimit = company?.worker_seat_limit ?? 0;
      await supabase
        .from('companies')
        .update({ worker_seat_limit: currentLimit + 1 })
        .eq('id', userProfile.company_id);
    }
  }, [currentOffering, userProfile?.company_id]);

  const devResetToStarter = useCallback(async () => {
    if (!__DEV__) return;
    await AsyncStorage.setItem(DEV_OVERRIDE_KEY, 'true');
    setIsPro(false);
  }, []);

  const restorePurchases = useCallback(async () => {
    const info = await Purchases.restorePurchases();
    setIsPro(typeof info.entitlements.active['pro'] !== 'undefined');
    await syncToSupabase(info);
  }, [syncToSupabase]);

  return (
    <SubscriptionContext.Provider value={{ isPro, isLoading, currentOffering, purchasePackage, purchaseWorkerSeat, restorePurchases, devResetToStarter }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export const useSubscription = () => useContext(SubscriptionContext);
