import { paginaArticolo } from '../_lib/seo';

// /articolo/<titolo o codice>: titolo, anteprima e testo gia' nell'HTML (Google, WhatsApp, Facebook).
export const onRequest: PagesFunction = async (context) =>
  ['GET', 'HEAD'].includes(context.request.method) ? paginaArticolo(context, String(context.params.id || '')) : context.next();
