import { bridge } from '../_lib/restyle';

// Funzione-ponte Cloudflare Pages verso la Edge Function Supabase "share-profile",
// con la pagina di anteprima ridisegnata nello stile blu.
export const onRequest: PagesFunction = async (context) => bridge(context, 'share-profile');
