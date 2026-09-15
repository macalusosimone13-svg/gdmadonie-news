import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

// Adattato per funzionare fuori dal sandbox Base44 (es. Cloudflare Pages):
// serverUrl assoluto (prima era vuoto, il che funzionava solo perché Base44
// stesso faceva da proxy) e un ID app di riserva, così le funzionalità non
// ancora migrate (upload immagini, notifiche email, rassegna stampa) restano
// operative anche quando il sito è ospitato altrove.
export const base44 = createClient({
  appId: appId || '6a81b39b7d72fb1a125621b0',
  token,
  functionsVersion,
  serverUrl: 'https://base44.app',
  requiresAuth: false,
  appBaseUrl
});
