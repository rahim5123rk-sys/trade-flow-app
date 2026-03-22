-- Track which plan type the user is on (monthly, annual, lifetime)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_type text;
