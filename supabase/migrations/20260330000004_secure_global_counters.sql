-- Enable RLS on global_counters to prevent direct client manipulation
-- Counter functions are SECURITY DEFINER so they bypass RLS
ALTER TABLE public.global_counters ENABLE ROW LEVEL SECURITY;

-- No policies needed — only SECURITY DEFINER functions should access this table
-- Any direct client access will be blocked
