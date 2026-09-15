// Funzione-ponte Cloudflare Pages: inoltra la richiesta alla Edge Function
// Supabase corrispondente, MA mantenendo sempre visibile il dominio del sito
// (il visitatore/crawler non vede mai l'indirizzo di Supabase). L'header
// x-forwarded-host dice alla funzione Supabase quale dominio usare nei link
// che genera (sitemap, feed RSS): senza questo, quei link punterebbero per
// errore all'indirizzo tecnico di Supabase invece che al sito vero.
export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const target = new URL('https://fxfckcpdxuyrhuinkyxq.supabase.co/functions/v1/robots-txt');
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
