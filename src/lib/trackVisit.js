import { supabase } from '@/lib/supabaseClient';

// Contatore visite anonimo, senza cookie e senza salvare nulla sul telefono
// del visitatore. Il server calcola un'impronta mensile non reversibile
// (niente IP salvati), scarta robot e visite di admin/editor, e classifica
// da dove arriva la persona (Google, Instagram, WhatsApp, diretto...).
// Per i link che non comunicano la provenienza (storie Instagram, WhatsApp)
// si puo' aggiungere ?da=ig / ?da=wa / ?da=fb / ?da=qr all'indirizzo.

let firstHit = true;
let lastPath = null;

export function trackVisit(pathname) {
  try {
    if (typeof window === 'undefined') return;
    if (navigator.webdriver) return;
    if (pathname === lastPath) return;
    lastPath = pathname;

    const entry = firstHit;
    firstHit = false;

    let tag = null;
    let referrer = null;
    if (entry) {
      referrer = document.referrer || null;
      const url = new URL(window.location.href);
      tag = url.searchParams.get('da') || url.searchParams.get('utm_source');
      if (url.searchParams.has('da')) {
        // Tolgo ?da= dall'indirizzo: se la persona ricondivide il link,
        // le nuove visite non vengono attribuite alla fonte sbagliata.
        url.searchParams.delete('da');
        window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
      }
    }

    supabase
      .rpc('track_visit', { p_path: pathname, p_referrer: referrer, p_tag: tag, p_entry: entry })
      .then(() => {}, () => {});
  } catch {
    // il contatore non deve mai rompere il sito
  }
}
