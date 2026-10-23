import { createClient } from 'npm:@supabase/supabase-js@2';

function escapeXml(s: unknown) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Indirizzo della pagina di una notizia dei paesi: stessa regola di
// src/lib/paesiLink.js e functions/_lib/paesi.ts nel sito.
const slugTitolo = (t: unknown) => {
  let s = String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (s.length > 70) s = s.slice(0, 70).replace(/-[^-]*$/, '');
  return s || 'notizia';
};
const linkNotizia = (slug: string, n: { id: string; titolo: string }) => `/paesi/${slug}/${slugTitolo(n.titolo)}-${String(n.id).slice(0, 8)}`;

// Sezione ARS: stessa regola di src/lib/ars.js e functions/_lib/ars.ts.
const SLUG_TIPO: Record<string, string> = { I: 'interrogazione', P: 'interpellanza', M: 'mozione', D: 'ddl' };
const linkAtto = (k: string) => `/ars/atto/${SLUG_TIPO[k?.[0]] || 'atto'}-${String(k || '').slice(1)}`;
const linkLegge = (id: string) => `/ars/legge/${String(id || '').toLowerCase()}`;
const MADONIE = ['Madonie', 'Alimena', 'Aliminusa', 'Blufi', 'Bompietro', 'Caccamo', 'Caltavuturo', 'Castelbuono', 'Castellana Sicula', 'Cefalù', 'Collesano', 'Gangi', 'Geraci Siculo', 'Gratteri', 'Isnello', 'Montemaggiore Belsito', 'Petralia Soprana', 'Petralia Sottana', 'Polizzi Generosa', 'Pollina', 'San Mauro Castelverde', 'Scillato', 'Sclafani Bagni'];

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const appOrigin = req.headers.get('x-app-origin');
    const origin = appOrigin ? `https://${appOrigin}` : `${url.protocol}//${url.host}`;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Indirizzi leggibili (/articolo/<slug>) quando il flag slug_urls e' acceso.
    const { data: flag } = await supabase.from('app_flags').select('enabled').eq('key', 'slug_urls').maybeSingle();
    const useSlug = !!flag?.enabled;

    const { data: posts, error: postsError } = await supabase
      .from('posts')
      .select('id, slug, title, published_date, updated_at, source_type')
      .eq('status', 'published')
      .eq('source_type', 'gd_madonie')
      .order('published_date', { ascending: false })
      .limit(1000);
    if (postsError) console.error('sitemap posts error:', postsError.message);

    // v15: la tabella events non ha updated_at (prima la query falliva e gli eventi mancavano).
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('id, date, created_at')
      .order('date', { ascending: false })
      .limit(1000);
    if (eventsError) console.error('sitemap events error:', eventsError.message);

    const now = new Date().toISOString();
    // /rassegna-stampa non c'e': e' esclusa da Google (noindex) per scelta.
    const staticPages: [string, string, string][] = [
      ['/', 'daily', '1.0'],
      ['/gd-madonie', 'daily', '0.9'],
      ['/sondaggi', 'weekly', '0.7'],
      ['/chi-siamo', 'monthly', '0.7'],
      ['/partecipa', 'monthly', '0.6'],
      ['/in-evidenza/1', 'monthly', '0.5'],
      ['/in-evidenza/2', 'monthly', '0.5'],
      ['/privacy', 'yearly', '0.2'],
      ['/termini', 'yearly', '0.2'],
    ];
    const urls: string[] = [];
    for (const [p, freq, prio] of staticPages) {
      urls.push(`  <url>\n    <loc>${escapeXml(origin + p)}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>${freq}</changefreq>\n    <priority>${prio}</priority>\n  </url>`);
    }

    // v16: sezione Paesi (/paesi e /paesi/<paese>), con la data dell'ultima
    // notizia del paese. Si aggiunge solo quando la sezione e' davvero online
    // sul sito (la pagina /paesi risponde con il contenuto gia' compilato).
    try {
      const check = await fetch(`${origin}/paesi`, { signal: AbortSignal.timeout(6000) });
      const online = check.ok && (await check.text()).includes('ssr-paesi');
      if (online) {
        const { data: comuni } = await supabase.from('comuni').select('slug, punto_aggiornato_at').eq('attivo', true).order('sort_order');
        const { data: ultime } = await supabase.from('comuni_notizie').select('comune_slug, published_date').eq('stato', 'pubblicata').order('published_date', { ascending: false }).limit(500);
        let piuRecente = '';
        for (const c of comuni || []) {
          const u = (ultime || []).find((x) => x.comune_slug === c.slug);
          const date = [u?.published_date, c.punto_aggiornato_at].filter(Boolean).map((d) => new Date(d as string).toISOString()).sort().pop() || now;
          if (date > piuRecente) piuRecente = date;
          urls.push(`  <url>\n    <loc>${escapeXml(origin + '/paesi/' + c.slug)}</loc>\n    <lastmod>${date}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.8</priority>\n  </url>`);
        }
        urls.push(`  <url>\n    <loc>${escapeXml(origin + '/paesi')}</loc>\n    <lastmod>${piuRecente || now}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.8</priority>\n  </url>`);

        // v17: pagina di ogni notizia dei paesi (/paesi/<paese>/<titolo>-<codice>).
        // Solo quelle con il riassunto (le altre sono noindex) e solo quando
        // queste pagine sono davvero online sul sito.
        const { data: nn } = await supabase.from('comuni_notizie')
          .select('id, comune_slug, titolo, published_date')
          .eq('stato', 'pubblicata').not('riassunto', 'is', null)
          .order('published_date', { ascending: false }).limit(3000);
        if (nn && nn.length) {
          const prova = await fetch(origin + linkNotizia(nn[0].comune_slug, nn[0]), { signal: AbortSignal.timeout(6000) });
          const txt = prova.ok ? await prova.text() : '';
          if (txt.includes('ssr-paesi') && txt.includes('NewsArticle')) {
            for (const n of nn) {
              const d = n.published_date ? new Date(n.published_date).toISOString() : now;
              urls.push(`  <url>\n    <loc>${escapeXml(origin + linkNotizia(n.comune_slug, n))}</loc>\n    <lastmod>${d}</lastmod>\n    <priority>0.6</priority>\n  </url>`);
            }
          }
        }
      }
    } catch (e) {
      console.error('sitemap paesi:', (e as Error).message);
    }

    // v18: sezione ARS (/ars, leggi, atti). Solo quando le pagine sono davvero
    // online sul sito, compilate lato server. Degli atti si mettono quelli con
    // il riassunto o che riguardano le Madonie (gli altri hanno solo il titolo).
    try {
      const prova = await fetch(`${origin}/ars/leggi`, { signal: AbortSignal.timeout(8000) });
      const txt = prova.ok ? await prova.text() : '';
      if (txt.includes('ssr-pagina') && txt.includes('/ars/legge/')) {
        const { data: meta } = await supabase.from('ars_meta').select('updated_at').order('updated_at', { ascending: false }).limit(1);
        const agg = meta?.[0]?.updated_at ? new Date(meta[0].updated_at).toISOString() : now;
        for (const [p, freq, prio] of [['/ars', 'daily', '0.8'], ['/ars/leggi', 'daily', '0.7'], ['/ars/domande', 'daily', '0.7'], ['/ars/aula', 'daily', '0.6'], ['/ars/deputati', 'weekly', '0.6']]) {
          urls.push(`  <url>\n    <loc>${escapeXml(origin + p)}</loc>\n    <lastmod>${agg}</lastmod>\n    <changefreq>${freq}</changefreq>\n    <priority>${prio}</priority>\n  </url>`);
        }
        const { data: leggi } = await supabase.from('ars_leggi').select('id, data, updated_at').is('unita_a', null).order('data', { ascending: false }).limit(1000);
        for (const l of leggi || []) {
          const d = new Date(l.updated_at || l.data || now).toISOString();
          urls.push(`  <url>\n    <loc>${escapeXml(origin + linkLegge(l.id))}</loc>\n    <lastmod>${d}</lastmod>\n    <priority>0.6</priority>\n  </url>`);
        }
        const visti = new Set<string>();
        const conSintesi = await supabase.from('ars_atti').select('k, updated_at').not('sintesi', 'is', null).order('data', { ascending: false, nullsFirst: false }).limit(5000);
        const madonie = await supabase.from('ars_atti').select('k, updated_at').overlaps('luoghi', MADONIE).limit(2000);
        for (const a of [...(madonie.data || []), ...(conSintesi.data || [])]) {
          if (visti.has(a.k)) continue;
          visti.add(a.k);
          urls.push(`  <url>\n    <loc>${escapeXml(origin + linkAtto(a.k))}</loc>\n    <lastmod>${new Date(a.updated_at || now).toISOString()}</lastmod>\n    <priority>0.5</priority>\n  </url>`);
        }
      }
    } catch (e) {
      console.error('sitemap ars:', (e as Error).message);
    }

    // Notizie "fresche" (ultime 48 ore): blocco <news:news> per Google News.
    const twoDaysAgoMs = Date.now() - 48 * 60 * 60 * 1000;
    for (const post of posts || []) {
      const lastmod = post.updated_at
        ? new Date(post.updated_at).toISOString()
        : (post.published_date ? new Date(post.published_date).toISOString() : now);
      const isFresh = post.published_date && new Date(post.published_date).getTime() > twoDaysAgoMs;
      const newsBlock = isFresh ? `\n    <news:news>\n      <news:publication>\n        <news:name>GD Madonie News</news:name>\n        <news:language>it</news:language>\n      </news:publication>\n      <news:publication_date>${new Date(post.published_date).toISOString()}</news:publication_date>\n      <news:title>${escapeXml(post.title || '')}</news:title>\n    </news:news>` : '';
      const key = useSlug && post.slug ? post.slug : post.id;
      urls.push(`  <url>\n    <loc>${escapeXml(origin + '/articolo/' + key)}</loc>\n    <lastmod>${lastmod}</lastmod>${newsBlock}\n  </url>`);
    }
    for (const event of events || []) {
      const lastmod = event.created_at ? new Date(event.created_at).toISOString() : now;
      urls.push(`  <url>\n    <loc>${escapeXml(origin + '/evento/' + event.id)}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`);
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n${urls.join('\n')}\n</urlset>`;

    return new Response(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600'
      }
    });
  } catch (error) {
    return new Response('Error: ' + ((error as Error)?.message || 'unknown'), { status: 500 });
  }
});
