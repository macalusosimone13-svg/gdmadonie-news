import { bridge } from '../_lib/restyle';

// Funzione-ponte Cloudflare Pages verso la Edge Function Supabase "share-sondaggi",
// con l'immagine di anteprima ridimensionata per WhatsApp.
export const onRequest: PagesFunction = async (context) => bridge(context, 'share-sondaggi');
