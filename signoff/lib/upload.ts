'use client';

import * as tus from 'tus-js-client';
import { createClient } from './supabase/client';

/** Resumable upload to the private media bucket, so large videos survive a dropped connection. */
export async function uploadToMedia(file: File, path: string, onProgress?: (fraction: number) => void) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Your session expired. Sign in again.');

  await new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/upload/resumable`,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: { authorization: `Bearer ${session.access_token}`, 'x-upsert': 'false' },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: { bucketName: 'media', objectName: path, contentType: file.type || 'application/octet-stream', cacheControl: '3600' },
      // Supabase requires 6MB chunks
      chunkSize: 6 * 1024 * 1024,
      onError: (err) => reject(err),
      onProgress: (sent, total) => onProgress?.(total ? sent / total : 0),
      onSuccess: () => resolve(),
    });
    upload.findPreviousUploads().then((prev) => {
      if (prev.length) upload.resumeFromPreviousUpload(prev[0]);
      upload.start();
    });
  });
}

/** Width, height and (for video) duration, read in the browser before upload */
export function measure(file: File): Promise<{ width: number | null; height: number | null; duration_sec: number | null }> {
  const url = URL.createObjectURL(file);
  const done = <T,>(v: T) => { URL.revokeObjectURL(url); return v; };
  if (file.type.startsWith('video/')) {
    return new Promise((resolve) => {
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.onloadedmetadata = () => resolve(done({ width: v.videoWidth || null, height: v.videoHeight || null, duration_sec: Number.isFinite(v.duration) ? v.duration : null }));
      v.onerror = () => resolve(done({ width: null, height: null, duration_sec: null }));
      v.src = url;
    });
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(done({ width: img.naturalWidth, height: img.naturalHeight, duration_sec: null }));
    img.onerror = () => resolve(done({ width: null, height: null, duration_sec: null }));
    img.src = url;
  });
}
