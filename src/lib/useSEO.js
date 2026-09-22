import { useEffect } from 'react';

// Hook minimale per SEO dinamico lato client: aggiorna <title>, meta description,
// Open Graph (og:title/description/image/url/type) e tag Twitter.
// In SPA senza SSR i crawler moderni leggono i meta impostati via JS.
function upsertMeta(attr, key, content) {
  if (!content) return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLink(rel, href) {
  if (!href) return;
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

// Il sito e' raggiungibile anche da indirizzi "tecnici" (es. il dominio
// gratuito di Cloudflare Pages), oltre al dominio vero. Qualunque sia
// l'indirizzo con cui la pagina viene aperta, diciamo sempre a Google che
// quello "vero" e' il nostro dominio: altrimenti l'indirizzo tecnico rischia
// di finire indicizzato come se fosse un sito a se stante.
const CANONICAL_HOST = 'https://www.gdmadonie-news.com';
function toCanonicalUrl(url) {
  if (!url) return url;
  try {
    const u = new URL(url);
    return CANONICAL_HOST + u.pathname + u.search;
  } catch {
    return url;
  }
}

export function useSEO({ title, description, image, url, type = 'website', noindex = false }) {
  useEffect(() => {
    if (title) document.title = title;
    if (description) upsertMeta('name', 'description', description);
    upsertMeta('property', 'og:title', title);
    upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:image', image);
    upsertMeta('property', 'og:type', type);
    if (url) {
      const canonicalUrl = toCanonicalUrl(url);
      upsertMeta('property', 'og:url', canonicalUrl);
      upsertLink('canonical', canonicalUrl);
    }
    upsertMeta('name', 'twitter:card', image ? 'summary_large_image' : 'summary');
    upsertMeta('name', 'twitter:title', title);
    upsertMeta('name', 'twitter:description', description);
    upsertMeta('name', 'twitter:image', image);

    // Contenuti aggregati da fonti terze (rassegna stampa): teniamoli fuori
    // dall'indice di Google per non farli contare come "contenuto di scarso
    // valore" del sito in fase di revisione AdSense.
    // "max-image-preview:large" e' quello che permette a Google di mostrare
    // le foto delle nostre notizie a grandezza intera nei risultati di
    // ricerca e in Google Discover (senza, Google le mostra piu' piccole,
    // di default): e' uno dei requisiti indicati da Google stesso per
    // comparire bene in Discover. "max-snippet:-1" lascia mostrare
    // l'anteprima di testo per intero invece che tagliata.
    let robots = document.head.querySelector('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement('meta');
      robots.setAttribute('name', 'robots');
      document.head.appendChild(robots);
    }
    robots.setAttribute('content', (noindex ? 'noindex, follow' : 'index, follow') + ', max-image-preview:large, max-snippet:-1');
  }, [title, description, image, url, type, noindex]);
}
