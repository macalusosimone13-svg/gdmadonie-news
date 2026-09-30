// /og-home.jpg: immagine di anteprima della home e delle pagine fisse
// (WhatsApp, Facebook, Telegram). E' il logo del circolo in formato
// 1200x630 JPG da ~25 KB, preparato dal servizio di ridimensionamento
// (lo stesso usato per le anteprime degli articoli) a partire dal logo
// originale: la PNG da 1,27 MB era troppo pesante e WhatsApp non la mostrava.
const LOGO = 'https://pub-1b641aacf1b949cfadd9ca8ab453df1b.r2.dev/legacy/2026-09-16/f1422048-c330-4a0a-8892-0a85294ff01b.png';
const URL_OG = `https://wsrv.nl/?url=${encodeURIComponent(LOGO)}&w=1200&h=630&fit=contain&cbg=black&output=jpg&q=78`;

export const onRequest: PagesFunction = async () => {
  const r = await fetch(URL_OG, { cf: { cacheEverything: true, cacheTtl: 604800 } as any });
  // se il servizio non risponde, si ripiega sul logo originale
  if (!r.ok) return Response.redirect(LOGO, 302);
  return new Response(r.body, {
    headers: { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=604800' },
  });
};
