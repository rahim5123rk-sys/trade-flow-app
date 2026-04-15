-- Create a public storage bucket for hosting static web pages
-- (e.g., the quote accept/decline page served as proper HTML)

INSERT INTO storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
VALUES ('static', 'static', true, ARRAY['text/html', 'text/css', 'application/javascript'], 1048576)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to the static bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read access on static bucket'
  ) THEN
    CREATE POLICY "Allow public read access on static bucket"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'static');
  END IF;
END $$;
