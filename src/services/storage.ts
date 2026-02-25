import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../config/supabase';

/**
 * Uploads an image to Supabase Storage
 * @param uri Local file URI (from ImagePicker)
 * @param bucket The Supabase bucket name ('job-photos' or 'logos')
 * @param folder Optional folder path (e.g. 'job-123')
 */
export const uploadImage = async (uri: string, bucket: 'job-photos' | 'logos', folder?: string) => {
  try {
    // 1. Read the file as Base64 using string 'base64'
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: 'base64',
    });

    // 2. Create a unique filename
    const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = folder ? `${folder}/${fileName}` : fileName;

    // 3. Upload using the decode utility
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, decode(base64), {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (error) throw error;

    // 4. Get the Public URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    return publicUrl;
  } catch (error) {
    console.error('Supabase Upload Error:', error);
    throw error;
  }
};