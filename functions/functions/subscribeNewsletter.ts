// Funzione-ponte Cloudflare Pages verso la Edge Function Supabase
// "subscribe-newsletter". Stesso percorso usato dal frontend (Home.jsx).
export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const target = new URL('https://fxfckcpdxuyrhuinkyxq.supabase.co/functions/v1/subscribe-newsletter');
  const resp = await fetch(target.toString(), {
    method: context.request.method,
    headers: {
      'Content-Type': 'application/json',
      'x-app-origin': url.host,
    },
    body: context.request.method === 'POST' ? await context.request.text() : undefined,
  });
  return new Response(resp.body, { status: resp.status, headers: resp.headers });
};
