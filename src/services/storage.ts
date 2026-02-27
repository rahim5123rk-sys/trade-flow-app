import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../config/supabase';

/**
 * Uploads an image to Supabase Storage (private bucket).
 * Returns the **storage path** (not a public URL).
 * Use `getSignedUrl()` to generate a time-limited access URL.
 */
export const uploadImage = async (
  uri: string,
  bucket: 'job-photos' | 'logos',
  folder?: string,
): Promise<string> => {
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: 'base64',
    });

    const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = folder ? `${folder}/${fileName}` : fileName;

    const { error } = await supabase.storage
      .from(bucket)
      .upload(filePath, decode(base64), {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (error) throw error;

    // Return the storage path — callers use getSignedUrl() to display
    return `${bucket}:${filePath}`;
  } catch (error) {
    console.error('Supabase Upload Error');
    throw error;
  }
};

/**
 * Parse a storage reference string into bucket + path.
 * Handles both new format "bucket:path" and legacy full public URLs.
 */
function parseStorageRef(ref: string): { bucket: string; path: string } | null {
  // New format: "bucket:path"
  if (ref.includes(':') && !ref.includes('://')) {
    const idx = ref.indexOf(':');
    return { bucket: ref.slice(0, idx), path: ref.slice(idx + 1) };
  }

  // Legacy format: full Supabase public URL
  // e.g. https://xxx.supabase.co/storage/v1/object/public/logos/123.jpg
  const publicMatch = ref.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
  if (publicMatch) {
    return { bucket: publicMatch[1], path: publicMatch[2] };
  }

  return null;
}

/**
 * Generate a signed URL for a stored file.
 * Works with both new "bucket:path" refs and legacy public URLs.
 * Returns the original string if it can't be parsed (e.g. base64 data URIs).
 *
 * @param ref  Storage reference or legacy URL
 * @param expiresIn  Seconds until URL expires (default 1 hour)
 */
export const getSignedUrl = async (
  ref: string,
  expiresIn = 3600,
): Promise<string> => {
  if (!ref) return '';

  // Data URIs (base64 signatures) pass through untouched
  if (ref.startsWith('data:')) return ref;

  const parsed = parseStorageRef(ref);
  if (!parsed) return ref; // Unknown format — return as-is

  const { data, error } = await supabase.storage
    .from(parsed.bucket)
    .createSignedUrl(parsed.path, expiresIn);

  if (error || !data?.signedUrl) {
    console.error('Signed URL error');
    return ref; // Fallback to original
  }

  return data.signedUrl;
};

/**
 * Resolve an array of storage refs to signed URLs.
 * Handy for job photos arrays.
 */
export const getSignedUrls = async (
  refs: string[],
  expiresIn = 3600,
): Promise<string[]> => {
  if (!refs || refs.length === 0) return [];
  return Promise.all(refs.map((r) => getSignedUrl(r, expiresIn)));
};
