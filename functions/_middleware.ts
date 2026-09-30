import { paginaFissa } from './_lib/seo';

// Per tutte le pagine del sito che non hanno una funzione dedicata (home,
// GD Madonie, Sondaggi, Chi siamo, Privacy, ecc.) scrive dal server titolo,
// descrizione e indirizzo ufficiale giusti, invece di quelli della home.
// Gli indirizzi che non esistono rispondono 404 (prima rispondevano 200).
// File, immagini, JavaScript e le funzioni /functions/* passano senza modifiche.
const DEDICATE = /^\/(paesi|articolo|post|evento|functions)(\/|$)/;

export const onRequest: PagesFunction = async (context) => {
  const res = await context.next();
  const method = context.request.method;
  if (method !== 'GET' && method !== 'HEAD') return res;
  if (res.status !== 200 || !(res.headers.get('content-type') || '').includes('text/html')) return res;
  const { pathname } = new URL(context.request.url);
  // file veri (es. il file di verifica di Google .html) e pagine con funzione propria
  if (DEDICATE.test(pathname) || /\.[a-z0-9]+$/i.test(pathname)) return res;
  try {
    // solo la pagina dell'app (index.html), mai altri file HTML veri
    // (es. il file di verifica di Google servito senza .html)
    const html = method === 'HEAD'
      ? await (await context.env.ASSETS.fetch(new Request(context.request.url, { method: 'GET' }))).text()
      : await res.clone().text();
    if (!html.includes('<div id="root">')) return res;
    return await paginaFissa(res, pathname);
  } catch {
    return res;
  }
};
