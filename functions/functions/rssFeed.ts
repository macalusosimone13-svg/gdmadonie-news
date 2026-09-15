// Funzione-ponte Cloudflare Pages verso la Edge Function Supabase "rss-feed".
// Il percorso /functions/rssFeed replica quello usato da Base44 (già
// referenziato in index.html), così non serve cambiare nulla nel frontend.
export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const target = new URL('https://fxfckcpdxuyrhuinkyxq.supabase.co/functions/v1/rss-feed');
  target.search = url.search;
  const resp = await fetch(target.toString(), {
    method: context.request.method,
    headers: {
      'x-forwarded-host': url.host,
      'x-forwarded-proto': 'https',
    },
  });
  return new Response(resp.body, { status: resp.status, headers: resp.headers });
};
