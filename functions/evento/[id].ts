import { paginaEvento } from '../_lib/seo';

// /evento/<codice>: titolo, data, luogo e anteprima gia' nell'HTML; 404 se l'evento non esiste.
export const onRequest: PagesFunction = async (context) =>
  ['GET', 'HEAD'].includes(context.request.method) ? paginaEvento(context, String(context.params.id || '').toLowerCase()) : context.next();
