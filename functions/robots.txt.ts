// Funzione-ponte Cloudflare Pages: inoltra la richiesta alla Edge Function
// Supabase corrispondente, mantenendo sempre visibile il dominio del sito.
// Nota: Supabase riscrive da solo gli header standard x-forwarded-host/proto
// con valori interni suoi, quindi il dominio vero viaggia in un header
// personalizzato (x-app-origin) che Supabase non tocca.
export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const target = new URL('https://fxfckcpdxuyrhuinkyxq.supabase.co/functions/v1/robots-txt');
  target.search = url.search;
  const resp = await fetch(target.toString(), {
    method: context.request.method,
    headers: {
      'x-app-origin': url.host,
    },
  });
  return new Response(resp.body, { status: resp.status, headers: resp.headers });
};
