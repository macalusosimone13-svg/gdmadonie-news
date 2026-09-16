import { supabase } from '@/lib/supabaseClient';

// Carica un file (immagine, video o allegato) su Cloudflare R2 tramite la
// Edge Function "upload-image". Stessa forma di risposta del vecchio
// base44.integrations.Core.UploadFile ({ file_url }), per non dover
// riscrivere il codice che la chiama.
export async function uploadFile(file) {
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
