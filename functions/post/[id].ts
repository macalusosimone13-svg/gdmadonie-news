import { paginaArticolo } from '../_lib/seo';

// /post/<codice>: vecchio indirizzo degli articoli, stessa pagina di /articolo (canonical su /articolo).
export const onRequest: PagesFunction = async (context) =>
  ['GET', 'HEAD'].includes(context.request.method) ? paginaArticolo(context, String(context.params.id || '')) : context.next();
