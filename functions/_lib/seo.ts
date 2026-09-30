// Pagine pronte per Google e per le anteprime social (WhatsApp, Facebook,
// Telegram, Instagram) anche per articoli, eventi e pagine fisse.
//
// Il sito e' una single-page app: senza questo, il server mandava a tutti la
// stessa index.html, con titolo e indirizzo ufficiale (canonical) della home.
// Chi incollava il link di un articolo vedeva l'anteprima generica, e Google
// per un attimo leggeva ogni pagina come se fosse la home.
// Qui si prende la stessa index.html e ci si scrive dentro, dal server:
// titolo, descrizione, canonical, immagine, robots e dati strutturati; per
// articoli, eventi e profili anche il testo. Quando l'app parte, React
// sostituisce il contenuto con la pagina vera (stessa logica di /paesi).
// Gli indirizzi che non esistono rispondono con un vero 404.

import { ogSized } from './restyle';

const SB = 'https://fxfckcpdxuyrhuinkyxq.supabase.co';
// Chiave "anon public" (la stessa del sito): lettura protetta dalle regole RLS.
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4ZmNrY3BkeHV5cmh1aW5reXhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0Njc2NDAsImV4cCI6MjEwNTA0MzY0MH0.FVIFZkQ5enyTSKBy8tlYDYvbI36w1P9ZnT0C7Metd_k';
const SITE = 'https://www.gdmadonie-news.com';
const OG_HOME = `${SITE}/og-home.jpg`;
const TITOLO_SITO = 'GD Madonie News — Giovani Democratici Madonie';
const DESC_SITO = "L'app ufficiale dei Giovani Democratici Madonie: notizie di politica locale e nazionale, comunicati, proposte, eventi e rassegna stampa.";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const taglia = (s: unknown, n = 158) => {
  const t = String(s ?? '').replace(/[#>*_`]/g, '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : t;
};
const paragrafi = (s: unknown) => String(s ?? '').replace(/\r/g, '').split(/\n\s*\n|\n/).map((p) => p.replace(/^#+\s*|^>\s*/, '').trim()).filter(Boolean);
const dataIt = (d: string | null, conOra = false) => {
  if (!d) return '';
  try {
    return new Date(d).toLocaleString('it-IT', { timeZone: 'Europe/Rome', day: 'numeric', month: 'long', year: 'numeric', ...(conOra ? { hour: '2-digit', minute: '2-digit' } : {}) });
  } catch { return ''; }
};

async function sb(path: string) {
  try {
    const r = await fetch(`${SB}/rest/v1/${path}`, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` }, cf: { cacheTtl: 120, cacheEverything: true } as any });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

const STYLE = `<style>.ssr-pagina{background:#FFFDF9;color:#1c2233;font-family:Figtree,system-ui,sans-serif;min-height:100vh;padding:32px 20px 60px}.ssr-pagina .w{max-width:820px;margin:0 auto}.ssr-pagina h1{font-family:Rubik,sans-serif;font-weight:900;font-size:clamp(1.8rem,5vw,2.8rem);line-height:1.1;color:#0F1B3A;margin:8px 0 14px}.ssr-pagina .k{color:#2F5BD8;font-weight:800;text-transform:uppercase;letter-spacing:.12em;font-size:13px}.ssr-pagina .m{font-size:12.5px;font-weight:700;color:#2F5BD8;text-transform:uppercase;margin-bottom:16px}.ssr-pagina img{max-width:100%;height:auto;border-radius:20px;margin:6px 0 18px}.ssr-pagina a{color:#2F5BD8}.ssr-pagina p{line-height:1.7;font-size:17px}</style>`;

type Opzioni = {
  title: string; description: string; url: string;
  image?: string | null; type?: string; noindex?: boolean; status?: number;
  jsonLd?: unknown; jsonLdId?: string; body?: string;
};

// Scrive titolo, meta e (se c'e') il contenuto dentro la index.html.
function riscrivi(res: Response, o: Opzioni): Response {
  const img = o.image || null;
  const noindex = o.noindex || (o.status || 200) >= 400;
  let rw = new HTMLRewriter()
    .on('title', { element(e: any) { e.setInnerContent(o.title); } })
    .on('meta[name="description"]', { element(e: any) { e.setAttribute('content', o.description); } })
    .on('link[rel="canonical"]', { element(e: any) { e.setAttribute('href', o.url); } })
    .on('meta[property="og:title"]', { element(e: any) { e.setAttribute('content', o.title); } })
    .on('meta[property="og:description"]', { element(e: any) { e.setAttribute('content', o.description); } })
    .on('meta[property="og:type"]', { element(e: any) { if (o.type) e.setAttribute('content', o.type); } })
    .on('meta[property="og:image"]', { element(e: any) { if (img) e.setAttribute('content', img); } })
    .on('head', { element(e: any) {
      e.append(`<meta property="og:url" content="${esc(o.url)}" />`, { html: true });
      e.append(`<meta name="twitter:title" content="${esc(o.title)}" /><meta name="twitter:description" content="${esc(o.description)}" />${img ? `<meta name="twitter:image" content="${esc(img)}" />` : ''}`, { html: true });
      e.append(`<meta name="robots" content="${noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large, max-snippet:-1'}" />`, { html: true });
      if (o.jsonLd) {
        const attr = o.jsonLdId ? `id="${o.jsonLdId}"` : 'data-jsonld="page"';
        e.append(`<script type="application/ld+json" ${attr}>${JSON.stringify(o.jsonLd).replace(/</g, '\\u003c')}</script>`, { html: true });
      }
      if (o.body) e.append(STYLE, { html: true });
    } });
  if (o.body) rw = rw.on('#root', { element(e: any) { e.setInnerContent(`<div class="ssr-pagina"><div class="w">${o.body}</div></div>`, { html: true }); } });
  const headers = new Headers(res.headers);
  headers.set('content-type', 'text/html; charset=utf-8');
  // Nessuna cache nel browser: dopo un aggiornamento del sito la pagina deve
  // puntare subito ai nuovi file JavaScript.
  headers.set('cache-control', 'public, max-age=0, must-revalidate');
  headers.delete('content-length');
  headers.delete('etag');
  return rw.transform(new Response(res.body, { status: o.status || 200, headers }));
}

const nonTrovata = (res: Response, url: string, cosa = 'Pagina') => { const nt = cosa === 'Evento' ? 'non trovato' : 'non trovata'; return riscrivi(res, {
  title: `${cosa} ${nt} — GD Madonie News`, description: `${cosa} ${nt}.`, url, status: 404,
  body: `<span class="k">GD Madonie News</span><h1>${esc(cosa)} ${nt}</h1><p>L'indirizzo non esiste o è stato rimosso.</p><p><a href="/">Torna al Feed</a> · <a href="/gd-madonie">News GD</a> · <a href="/paesi">Paesi</a></p>`,
}); };

const isHtml = (res: Response) => (res.headers.get('content-type') || '').includes('text/html');

// ---------- Articoli: /articolo/<slug o codice> e il vecchio /post/<codice> ----------
export async function paginaArticolo(context: any, chiave: string): Promise<Response> {
  const res: Response = await context.next();
  if (!isHtml(res)) return res;
  const k = decodeURIComponent(chiave || '').trim();
  if (!k || k.length > 200) return nonTrovata(res, `${SITE}/gd-madonie`, 'Notizia');
  const col = UUID_RE.test(k) ? 'id' : 'slug';
  const righe = await sb(`posts?select=id,slug,title,excerpt,content,author,image_url,media_type,poster_url,media,external_link,source_name,source_type,status,category,published_date,updated_at&${col}=eq.${encodeURIComponent(k)}&limit=1`);
  if (righe === null) return res; // database non raggiungibile: si lascia fare all'app
  const p = righe[0];
  if (!p) return nonTrovata(res, `${SITE}/gd-madonie`, 'Notizia');

  const url = `${SITE}/articolo/${encodeURIComponent(p.slug || p.id)}`;
  const isGD = p.source_type === 'gd_madonie';
  const primo = Array.isArray(p.media) && p.media.length ? p.media[0] : null;
  const video = /\.(mp4|mov|webm)(\?|$)/i;
  const foto = primo ? (primo.type === 'video' ? (primo.poster_url || p.poster_url) : primo.url)
    : (p.media_type === 'video' || video.test(p.image_url || '') ? p.poster_url : p.image_url);
  const image = foto && !video.test(foto) ? ogSized(foto) : OG_HOME;
  const testo = [...paragrafi(p.excerpt), ...paragrafi(p.content)];
  const description = taglia(testo.join(' ') || (isGD ? `${p.title}: comunicato dei Giovani Democratici Madonie.` : `${p.title} — notizia da ${p.source_name || 'altre testate'}.`));
  const body =
    `<span class="k">${isGD ? 'Giovani Democratici Madonie' : esc(p.source_name || 'Rassegna stampa')}</span>` +
    `<h1>${esc(p.title)}</h1>` +
    `<div class="m">${esc(dataIt(p.published_date))}${p.author ? ' · ' + esc(p.author) : ''}</div>` +
    (foto && !video.test(foto) ? `<img src="${esc(foto)}" alt="${esc(p.title)}" width="1200" height="630" />` : '') +
    testo.map((t) => `<p>${esc(t)}</p>`).join('') +
    (!isGD && p.external_link ? `<p><a href="${esc(p.external_link)}" rel="noopener nofollow">Leggi l'articolo completo su ${esc(p.source_name || 'la fonte originale')}</a></p>` : '') +
    `<p><a href="/gd-madonie">Altre notizie dei Giovani Democratici Madonie</a></p>`;
  const jsonLd = isGD ? {
    '@context': 'https://schema.org', '@type': 'NewsArticle', headline: String(p.title).slice(0, 110), description,
    image: foto && !video.test(foto) ? [foto] : [OG_HOME],
    datePublished: p.published_date, dateModified: p.updated_at || p.published_date,
    author: { '@type': 'Organization', name: 'Giovani Democratici Madonie', url: `${SITE}/chi-siamo` },
    publisher: { '@type': 'Organization', name: 'GD Madonie News', url: SITE, logo: { '@type': 'ImageObject', url: `${SITE}/favicon-192.png` } },
    mainEntityOfPage: url, url, inLanguage: 'it-IT',
  } : undefined;
  // Come nell'app: su Google solo i contenuti scritti dal circolo; la rassegna
  // di altre testate resta fuori (conta come "contenuto di scarso valore").
  return riscrivi(res, {
    title: `${p.title} — GD Madonie News`, description, url, image, type: 'article',
    noindex: !isGD || p.status !== 'published', jsonLd, jsonLdId: 'ld-json-newsarticle', body,
  });
}

// ---------- Eventi: /evento/<codice> ----------
export async function paginaEvento(context: any, id: string): Promise<Response> {
  const res: Response = await context.next();
  if (!isHtml(res)) return res;
  if (!UUID_RE.test(id || '')) return nonTrovata(res, `${SITE}/gd-madonie`, 'Evento');
  const righe = await sb(`events?select=id,title,date,location,description,image_url&id=eq.${id}&limit=1`);
  if (righe === null) return res;
  const ev = righe[0];
  if (!ev) return nonTrovata(res, `${SITE}/gd-madonie`, 'Evento');
  const url = `${SITE}/evento/${ev.id}`;
  const quando = dataIt(ev.date, true);
  const description = taglia(`${quando}${ev.location ? ' · ' + ev.location : ''}. ${ev.description || ''}`);
  const body =
    `<span class="k">Evento dei Giovani Democratici Madonie</span><h1>${esc(ev.title)}</h1>` +
    `<div class="m">${esc(quando)}${ev.location ? ' · ' + esc(ev.location) : ''}</div>` +
    (ev.image_url ? `<img src="${esc(ev.image_url)}" alt="${esc(ev.title)}" />` : '') +
    paragrafi(ev.description).map((t) => `<p>${esc(t)}</p>`).join('') +
    `<p><a href="/gd-madonie?tab=eventi">Tutti gli eventi</a></p>`;
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'Event', name: ev.title, startDate: ev.date, url,
    description: taglia(ev.description || ev.title, 300),
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode', eventStatus: 'https://schema.org/EventScheduled',
    location: { '@type': 'Place', name: ev.location || 'Madonie', address: { '@type': 'PostalAddress', addressLocality: ev.location || 'Madonie', addressRegion: 'Sicilia', addressCountry: 'IT' } },
    image: ev.image_url ? [ev.image_url] : [OG_HOME],
    organizer: { '@type': 'Organization', name: 'Giovani Democratici Madonie', url: SITE },
  };
  return riscrivi(res, { title: `${ev.title} — GD Madonie News`, description, url, image: ev.image_url ? ogSized(ev.image_url) : OG_HOME, type: 'article', jsonLd, body });
}

// ---------- Profili: /in-evidenza/<numero> ----------
async function paginaProfilo(res: Response, slot: string): Promise<Response> {
  const url = `${SITE}/in-evidenza/${slot}`;
  if (!/^\d{1,2}$/.test(slot)) return nonTrovata(res, url);
  const righe = await sb(`site_content?select=key,value&key=like.team_${slot}_*`);
  if (righe === null) return riscrivi(res, { title: TITOLO_SITO, description: DESC_SITO, url });
  const v: Record<string, string> = {};
  for (const r of righe) v[String(r.key).replace(`team_${slot}_`, '')] = r.value;
  if (!v.name) return nonTrovata(res, url);
  const foto = v.detail_photo || v.photo;
  const bio = paragrafi(v.bio);
  const description = taglia(v.caption ? `${v.name}, ${v.caption} dei Giovani Democratici Madonie. ${bio.join(' ')}` : bio.join(' ') || v.name);
  const body = `<span class="k">Giovani Democratici Madonie</span><h1>${esc(v.name)}</h1>${v.caption ? `<div class="m">${esc(v.caption)}</div>` : ''}` +
    (foto ? `<img src="${esc(foto)}" alt="${esc(v.name)}" />` : '') + bio.map((t) => `<p>${esc(t)}</p>`).join('') + `<p><a href="/chi-siamo">Chi siamo</a></p>`;
  const sameAs = ['instagram', 'facebook', 'twitter', 'linkedin'].map((s) => v[s]).filter(Boolean);
  const jsonLd = { '@context': 'https://schema.org', '@type': 'ProfilePage', url, mainEntity: { '@type': 'Person', name: v.name, jobTitle: v.caption || undefined, image: foto || undefined, sameAs, memberOf: { '@type': 'Organization', name: 'Giovani Democratici Madonie', url: SITE } } };
  return riscrivi(res, { title: `${v.name}${v.caption ? ` — ${v.caption}` : ''} — GD Madonie News`, description, url, image: foto ? ogSized(foto) : OG_HOME, type: 'profile', jsonLd, body });
}

// ---------- Pagine fisse e 404 ----------
type Fissa = { title: string; description: string; noindex?: boolean };
const FISSE: Record<string, Fissa> = {
  '/': { title: TITOLO_SITO, description: DESC_SITO },
  '/gd-madonie': { title: 'GD Madonie — Comunicati, news ed eventi del circolo', description: 'Comunicati, news ed eventi dei Giovani Democratici Madonie.' },
  '/sondaggi': { title: 'Sondaggi — GD Madonie News', description: 'Rilevazioni sulle intenzioni di voto, nazionali e regionali, aggiornate dal circolo dei Giovani Democratici Madonie.' },
  '/chi-siamo': { title: 'Chi siamo — GD Madonie News', description: 'Giovani Democratici Madonie: organigramma, contatti e social.' },
  '/partecipa': { title: 'Partecipa — GD Madonie News', description: 'Iscriviti ai Giovani Democratici Madonie, segnala un problema del tuo comune o proponi una notizia.' },
  '/privacy': { title: 'Privacy Policy — GD Madonie News', description: 'Informativa sulla privacy di GD Madonie News.' },
  '/termini': { title: 'Termini di Servizio — GD Madonie News', description: 'Termini e condizioni di utilizzo di GD Madonie News.' },
  '/rassegna-stampa': { title: 'Rassegna Stampa — GD Madonie News', description: 'Notizie di politica nazionale e regionale raccolte da altre testate.', noindex: true },
  '/rassegna-stampa/nazionale': { title: 'Rassegna Stampa nazionale — GD Madonie News', description: 'Notizie di politica nazionale raccolte da altre testate.', noindex: true },
  '/rassegna-stampa/regionale': { title: 'Rassegna Stampa regionale — GD Madonie News', description: 'Notizie di politica regionale raccolte da altre testate.', noindex: true },
  '/assistente': { title: 'Assistente eventi — GD Madonie News', description: "Chiedi all'assistente dei Giovani Democratici Madonie quali eventi sono in programma e registrati con una chat.", noindex: true },
  '/impostazioni': { title: 'Impostazioni — GD Madonie News', description: 'Tema e account di GD Madonie News.', noindex: true },
  '/login': { title: 'Accedi — GD Madonie News', description: 'Accedi a GD Madonie News.', noindex: true },
  '/register': { title: 'Registrati — GD Madonie News', description: 'Crea un account su GD Madonie News.', noindex: true },
  '/forgot-password': { title: 'Password dimenticata — GD Madonie News', description: 'Recupera la password di GD Madonie News.', noindex: true },
  '/reset-password': { title: 'Nuova password — GD Madonie News', description: 'Imposta una nuova password.', noindex: true },
  '/admin': { title: 'Admin — GD Madonie News', description: 'Area riservata.', noindex: true },
};

export async function paginaFissa(res: Response, pathname: string): Promise<Response> {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  const url = SITE + path;
  const f = FISSE[path];
  if (f) return riscrivi(res, { ...f, url, image: OG_HOME });
  const prof = path.match(/^\/in-evidenza\/([^/]+)$/);
  if (prof) return paginaProfilo(res, prof[1]);
  return nonTrovata(res, url);
}
