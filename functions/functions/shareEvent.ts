// Funzione-ponte Cloudflare Pages verso la Edge Function Supabase "share-event".
export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const target = new URL('https://fxfckcpdxuyrhuinkyxq.supabase.co/functions/v1/share-event');
  target.search = url.search;
  const resp = await fetch(target.toString(), {
    method: context.request.method,
    headers: {
      'x-app-origin': url.host,
    },
  });
  return new Response(resp.body, { status: resp.status, headers: resp.headers });
};
