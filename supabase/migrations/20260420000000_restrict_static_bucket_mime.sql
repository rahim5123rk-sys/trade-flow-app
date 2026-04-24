-- Restrict static bucket MIME types to prevent stored-XSS via malicious uploads.
-- The bucket hosts quote-accept/decline pages; only HTML/CSS/JS are expected.
-- Previous migration (20260415100001) set allowed_mime_types to NULL which
-- accepted any file type -- a stored-XSS vector from public read access.

UPDATE storage.buckets
SET allowed_mime_types = ARRAY['text/html', 'text/css', 'application/javascript'],
    file_size_limit    = 1048576
WHERE id = 'static';
