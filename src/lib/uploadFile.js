import { supabase } from '@/lib/supabaseClient';

const DIRECT_UPLOAD_THRESHOLD = 8 * 1024 * 1024; // 8 MB

// Carica un file (immagine, video o allegato) su Cloudflare R2.
// - File piccoli (< 8MB, tipico per le foto): passano dalla Edge Function
//   "upload-image", piu' semplice.
// - File grandi (video): il browser carica direttamente su R2 con un link
//   temporaneo generato da "get-upload-url", senza passare i byte dalla
//   nostra funzione (che altrimenti esaurirebbe la memoria disponibile).
// Stessa forma di risposta in entrambi i casi: { file_url }.
export async function uploadFile(file) {
  if (file.size <= DIRECT_UPLOAD_THRESHOLD) {
    return uploadSmall(file);
  }
  return uploadLargeDirect(file);
}

async function uploadSmall(file) {
  const { data: { session } } = await supabase.auth.getSession();
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch('https://fxfckcpdxuyrhuinkyxq.supabase.co/functions/v1/upload-image', {
    method: 'POST',
    headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
    body: formData
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Caricamento file non riuscito');
  }
  return data;
}

async function uploadLargeDirect(file) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch('https://fxfckcpdxuyrhuinkyxq.supabase.co/functions/v1/get-upload-url', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {})
    },
    body: JSON.stringify({ filename: file.name, contentType: file.type || 'application/octet-stream' })
  });
  const info = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(info.error || 'Impossibile preparare il caricamento');
  }

  const putRes = await fetch(info.upload_url, {
    method: 'PUT',
    headers: { 'Content-Type': info.content_type || file.type || 'application/octet-stream' },
    body: file
  });
  if (!putRes.ok) {
    throw new Error('Caricamento su R2 non riuscito (' + putRes.status + ')');
  }

  return { file_url: info.file_url };
}
