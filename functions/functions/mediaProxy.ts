// Proxy same-origin per foto e video usati nelle immagini di condivisione.
// Il bucket R2 non invia gli header CORS, quindi il browser non puo' leggere
// i pixel (canvas) ne' scaricare il video per condividerlo. Passando da qui
// la risorsa arriva dallo stesso dominio del sito.
// Sicurezza: solo http(s), solo contenuti image/* o video/*.
export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const raw = url.searchParams.get('u');
  if (!raw) return new Response('missing u', { status: 400 });
  let target: URL;
  try { target = new URL(raw); } catch { return new Response('bad url', { status: 400 }); }
  if (target.protocol !== 'https:' && target.protocol !== 'http:') return new Response('bad protocol', { status: 400 });
  if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.)/.test(target.hostname)) return new Response('forbidden', { status: 403 });

  const headers: Record<string, string> = { 'user-agent': 'Mozilla/5.0 GDMadonieNews' };
  const range = context.request.headers.get('range');
  if (range) headers['range'] = range;
  const upstream = await fetch(target.toString(), { headers, cf: { cacheEverything: true, cacheTtl: 86400 } as any });
  const type = upstream.headers.get('content-type') || '';
  if (!upstream.ok && upstream.status !== 206) return new Response('upstream ' + upstream.status, { status: 502 });
  if (!/^(image|video)\//i.test(type)) return new Response('unsupported type', { status: 415 });

  const out = new Headers();
  out.set('content-type', type);
  for (const h of ['content-length', 'content-range', 'accept-ranges']) {
    const v = upstream.headers.get(h);
    if (v) out.set(h, v);
  }
  out.set('cache-control', 'public, max-age=86400');
  return new Response(upstream.body, { status: upstream.status, headers: out });
};
