ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS user_id uuid references auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents(user_id);