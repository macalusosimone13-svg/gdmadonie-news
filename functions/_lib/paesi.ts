// Pagine "Paesi" pronte per Google: il sito e' una single-page app (il testo
// compare solo dopo che il JavaScript e' partito). Per /paesi e /paesi/<paese>
// questa funzione prende la stessa index.html e ci scrive dentro, gia' dal
// server, titolo, descrizione, indirizzo ufficiale, dati strutturati e lo
// stesso contenuto che poi la pagina mostra (Il punto + notizie). Cosi' i
// motori di ricerca leggono subito tutto, anche quelli che non eseguono JS.
// Quando l'app parte, React sostituisce questo contenuto con la pagina vera.

const SB = 'https://fxfckcpdxuyrhuinkyxq.supabase.co';
// Chiave "anon public" (la stessa del sito): lettura protetta dalle regole RLS.
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4ZmNrY3BkeHV5cmh1aW5reXhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0Njc2NDAsImV4cCI6MjEwNTA0MzY0MH0.FVIFZkQ5enyTSKBy8tlYDYvbI36w1P9ZnT0C7Metd_k';
const SITE = 'https://www.gdmadonie-news.com';
const OG_INDICE = 'https://pub-1b641aacf1b949cfadd9ca8ab453df1b.r2.dev/paesi/og/_indice.jpg';
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const data = (d: string | null) => { if (!d) return ''; const x = new Date(d); return `${x.getUTCDate()} ${MESI[x.getUTCMonth()]} ${x.getUTCFullYear()}`; };

// Indirizzo della pagina di una notizia: /paesi/<paese>/<titolo>-<primi 8 caratteri dell'id>.
// Stessa regola di src/lib/paesiLink.js e della funzione sitemap.
export const slugTitolo = (t: unknown) => {
  let s = String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (s.length > 70) s = s.slice(0, 70).replace(/-[^-]*$/, '');
  return s || 'notizia';
};
const linkNotizia = (slug: string, n: any) => `/paesi/${slug}/${slugTitolo(n.titolo)}-${String(n.id).slice(0, 8)}`;

async function sb(path: string) {
  try {
    const r = await fetch(`${SB}/rest/v1/${path}`, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` }, cf: { cacheTtl: 300, cacheEverything: true } as any });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

const STYLE = `<style>.ssr-paesi{background:#FFFDF9;color:#1c2233;font-family:Figtree,system-ui,sans-serif;min-height:100vh;padding:32px 20px 60px}.ssr-paesi .w{max-width:1100px;margin:0 auto}.ssr-paesi h1{font-family:Rubik,sans-serif;font-weight:900;text-transform:uppercase;font-size:clamp(2.4rem,8vw,4.4rem);color:#0F1B3A;margin:6px 0 12px}.ssr-paesi .k{color:#2F5BD8;font-weight:800;text-transform:uppercase;letter-spacing:.12em;font-size:13px}.ssr-paesi h2{font-family:Rubik,sans-serif;font-weight:900;text-transform:uppercase;font-size:18px;color:#2F5BD8;margin:28px 0 10px}.ssr-paesi article{background:#fff;border-radius:20px;padding:18px 20px;margin:0 0 14px;box-shadow:0 1px 3px rgba(28,34,51,.08)}.ssr-paesi h3{font-size:18px;margin:6px 0;color:#0F1B3A}.ssr-paesi .m{font-size:12.5px;font-weight:700;color:#2F5BD8;text-transform:uppercase}.ssr-paesi a{color:#2F5BD8}.ssr-paesi p{line-height:1.6}</style>`;

function sostituisci(res: Response, o: { title: string; description: string; url: string; jsonLd: unknown; body: string; status?: number; image?: string | null; noindex?: boolean; type?: string }) {
  const set = (attr: string) => ({ element(e: any) { e.setAttribute(attr === 'href' ? 'href' : 'content', attr === 'href' ? o.url : attr); } });
  const rw = new HTMLRewriter()
    .on('title', { element(e: any) { e.setInnerContent(o.title); } })
    .on('meta[name="description"]', { element(e: any) { e.setAttribute('content', o.description); } })
    .on('link[rel="canonical"]', set('href'))
    .on('meta[property="og:title"]', { element(e: any) { e.setAttribute('content', o.title); } })
    .on('meta[property="og:description"]', { element(e: any) { e.setAttribute('content', o.description); } })
    // immagine di anteprima del paese (WhatsApp, Instagram, Facebook), creata da og-paesi
    .on('meta[property="og:image"]', { element(e: any) { if (o.image) e.setAttribute('content', o.image); } })
    .on('meta[property="og:type"]', { element(e: any) { if (o.type) e.setAttribute('content', o.type); } })
    .on('head', { element(e: any) {
      e.append(`<meta property="og:url" content="${esc(o.url)}" />`, { html: true });
      if (o.image) e.append(`<meta property="og:image:width" content="1200" /><meta property="og:image:height" content="630" /><meta property="og:image:type" content="image/jpeg" /><meta name="twitter:image" content="${esc(o.image)}" />`, { html: true });
      e.append(`<meta name="robots" content="${o.status === 404 || o.noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large, max-snippet:-1'}" />`, { html: true });
      e.append(`<script type="application/ld+json" data-jsonld="page">${JSON.stringify(o.jsonLd).replace(/</g, '\\u003c')}</script>`, { html: true });
      e.append(STYLE, { html: true });
    } })
    .on('#root', { element(e: any) { e.setInnerContent(`<div class="ssr-paesi"><div class="w">${o.body}</div></div>`, { html: true }); } });
  const headers = new Headers(res.headers);
  headers.set('content-type', 'text/html; charset=utf-8');
  headers.set('cache-control', 'public, max-age=300');
  headers.delete('content-length');
  return rw.transform(new Response(res.body, { status: o.status || 200, headers }));
}

export async function paginaPaesi(context: any, slug: string | null): Promise<Response> {
  const res: Response = await context.next();
  if (!(res.headers.get('content-type') || '').includes('text/html')) return res;

  const comuni = (await sb('comuni?select=slug,nome,sito_url,punto,punto_aggiornato_at,og_image_url&attivo=eq.true&order=sort_order')) || [];

  if (!slug) {
    const ultime = (await sb('comuni_notizie?select=comune_slug,titolo,published_date&stato=eq.pubblicata&order=published_date.desc&limit=300')) || [];
    const title = 'Paesi delle Madonie: politica e amministrazione comune per comune — GD Madonie News';
    const description = 'Consiglio comunale, bilancio, fondi, opere pubbliche e servizi nei paesi delle Madonie, comune per comune. Aggiornato ogni giorno.';
    const body = `<span class="k">Le Madonie, paese per paese</span><h1>Paesi</h1><p>Cosa decidono i Comuni, dove vanno i fondi, cosa succede in consiglio comunale.</p>` +
      comuni.map((c: any) => {
        const u = ultime.find((x: any) => x.comune_slug === c.slug);
        return `<article><h3><a href="/paesi/${esc(c.slug)}">${esc(c.nome)}</a></h3>${u ? `<p>${esc(u.titolo)} (${data(u.published_date)})</p>` : ''}</article>`;
      }).join('');
    const jsonLd = { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Paesi delle Madonie', url: `${SITE}/paesi`, description,
      hasPart: comuni.map((c: any) => ({ '@type': 'WebPage', name: c.nome, url: `${SITE}/paesi/${c.slug}` })) };
    return sostituisci(res, { title, description, url: `${SITE}/paesi`, jsonLd, body, image: OG_INDICE });
  }

  const c = comuni.find((x: any) => x.slug === slug);
  if (!c) {
    return sostituisci(res, { title: 'Paese non trovato — GD Madonie News', description: 'Paese non trovato.', url: `${SITE}/paesi`, jsonLd: {}, body: '<h1>Paese non trovato</h1><p><a href="/paesi">Tutti i paesi</a></p>', status: 404 });
  }
  const notizie = (await sb(`comuni_notizie?select=id,titolo,riassunto,tema,fonte_nome,link,published_date&comune_slug=eq.${encodeURIComponent(slug)}&stato=eq.pubblicata&order=published_date.desc&limit=60`)) || [];
  const punto = String(c.punto || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const description = (punto[0] || `Notizie di politica e amministrazione del Comune di ${c.nome}: consiglio comunale, fondi, opere pubbliche e servizi.`).slice(0, 158);
  const title = `${c.nome}: notizie di politica, Comune e consiglio comunale — GD Madonie News`;
  const url = `${SITE}/paesi/${slug}`;
  const body =
    `<span class="k"><a href="/paesi">Paesi delle Madonie</a></span><h1>${esc(c.nome)}</h1>` +
    `<p>Politica e amministrazione a ${esc(c.nome)}: consiglio comunale, bilancio, fondi, opere pubbliche e servizi. Dal sito del Comune e dai giornali, aggiornato in automatico.</p>` +
    (punto.length ? `<h2>Il punto su ${esc(c.nome)}</h2>${punto.map((p) => `<p>${esc(p)}</p>`).join('')}` : '') +
    `<h2>Le notizie</h2>` +
    (notizie.length ? notizie.map((n: any) => `<article><div class="m">${esc(n.fonte_nome)} · ${data(n.published_date)}${n.tema ? ' · ' + esc(n.tema) : ''}</div><h3><a href="${esc(linkNotizia(slug, n))}">${esc(n.titolo)}</a></h3>${n.riassunto ? `<p>${esc(n.riassunto)}</p>` : ''}</article>`).join('') : `<p>Ancora nessuna notizia su ${esc(c.nome)}.</p>`) +
    `<h2>Altri paesi</h2><p>${comuni.filter((x: any) => x.slug !== slug).map((x: any) => `<a href="/paesi/${esc(x.slug)}">${esc(x.nome)}</a>`).join(' · ')}</p>`;
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'CollectionPage', name: `${c.nome}: politica e amministrazione`, url, description, inLanguage: 'it-IT',
    about: { '@type': 'Place', name: c.nome, containedInPlace: { '@type': 'AdministrativeArea', name: 'Città metropolitana di Palermo' } },
    isPartOf: { '@type': 'WebSite', name: 'GD Madonie News', url: SITE },
    breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Paesi', item: `${SITE}/paesi` },
      { '@type': 'ListItem', position: 2, name: c.nome, item: url },
    ] },
    mainEntity: { '@type': 'ItemList', itemListElement: notizie.slice(0, 20).map((n: any, i: number) => ({ '@type': 'ListItem', position: i + 1, name: n.titolo, url: SITE + linkNotizia(slug, n) })) },
  };
  return sostituisci(res, { title, description, url, jsonLd, body, image: c.og_image_url || OG_INDICE });
}

// Pagina di una singola notizia: /paesi/<paese>/<titolo>-<codice>.
export async function paginaNotizia(context: any, slug: string, param: string): Promise<Response> {
  const res: Response = await context.next();
  if (!(res.headers.get('content-type') || '').includes('text/html')) return res;
  const codice = (param.toLowerCase().match(/([0-9a-f]{8})$/) || [])[1];
  const nonTrovata = () => sostituisci(res, { title: 'Notizia non trovata — GD Madonie News', description: 'Notizia non trovata.', url: `${SITE}/paesi/${slug}`, jsonLd: {}, body: `<h1>Notizia non trovata</h1><p><a href="/paesi/${esc(slug)}">Le altre notizie del paese</a></p>`, status: 404 });
  if (!codice || !/^[a-z0-9-]+$/.test(slug)) return nonTrovata();
  const [comuni, righe] = await Promise.all([
    sb(`comuni?select=slug,nome,og_image_url&slug=eq.${encodeURIComponent(slug)}&attivo=eq.true`),
    sb(`comuni_notizie?select=id,titolo,riassunto,tema,fonte_tipo,fonte_nome,link,published_date&comune_slug=eq.${encodeURIComponent(slug)}&stato=eq.pubblicata&id=gte.${codice}-0000-0000-0000-000000000000&id=lte.${codice}-ffff-ffff-ffff-ffffffffffff&limit=1`),
  ]);
  const c = comuni?.[0]; const n = righe?.[0];
  if (!c || !n) return nonTrovata();
  const url = SITE + linkNotizia(slug, n);
  const fonte = n.fonte_tipo === 'comune' ? `sul sito del Comune di ${c.nome}` : `su ${n.fonte_nome}`;
  const description = (n.riassunto || `${n.titolo}. Notizia da ${c.nome}, da ${n.fonte_nome}.`).slice(0, 158);
  const title = `${n.titolo}${String(n.titolo).toLowerCase().includes(String(c.nome).toLowerCase()) ? '' : ` — ${c.nome}`} — GD Madonie News`;
  const body =
    `<span class="k"><a href="/paesi/${esc(slug)}">${esc(c.nome)}</a>${n.tema ? ' · ' + esc(n.tema) : ''}</span>` +
    `<h1 style="font-size:clamp(1.7rem,4.4vw,2.6rem);text-transform:none">${esc(n.titolo)}</h1>` +
    `<div class="m">${esc(n.fonte_nome)} · ${data(n.published_date)}</div>` +
    (n.riassunto ? `<p>${esc(n.riassunto)}</p>` : `<p>Per questa notizia abbiamo solo il titolo: il testo completo è ${esc(fonte)}.</p>`) +
    `<p><a href="${esc(n.link)}" rel="noopener nofollow">Leggi la notizia completa ${esc(fonte)}</a></p>` +
    `<p><a href="/paesi/${esc(slug)}">Tutte le notizie di ${esc(c.nome)}</a></p>`;
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'NewsArticle', headline: String(n.titolo).slice(0, 110), description,
    datePublished: n.published_date, url, mainEntityOfPage: url, inLanguage: 'it-IT',
    image: c.og_image_url ? [c.og_image_url] : undefined, isBasedOn: n.link,
    about: { '@type': 'Place', name: c.nome },
    publisher: { '@type': 'Organization', name: 'GD Madonie News', url: SITE },
  };
  // Le notizie con il solo titolo non hanno testo nostro: fuori da Google, ma condivisibili.
  return sostituisci(res, { title, description, url, jsonLd, body, image: c.og_image_url || OG_INDICE, noindex: !n.riassunto, type: 'article' });
}
