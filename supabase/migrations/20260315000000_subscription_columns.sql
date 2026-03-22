-- Add subscription fields to profiles table for RevenueCat integration
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_tier text NOT NULL DEFAULT 'starter';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_expires_at timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS revenuecat_user_id text;
