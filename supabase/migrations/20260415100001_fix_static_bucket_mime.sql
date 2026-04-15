-- Remove MIME type restriction on static bucket to allow text/html uploads
UPDATE storage.buckets SET allowed_mime_types = NULL WHERE id = 'static';
