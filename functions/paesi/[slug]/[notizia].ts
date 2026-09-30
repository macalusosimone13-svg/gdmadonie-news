import { paginaNotizia } from '../../_lib/paesi';

// /paesi/<paese>/<titolo>-<codice>: pagina della singola notizia, gia' compilata lato server.
export const onRequestGet: PagesFunction = async (context) =>
  paginaNotizia(context, String(context.params.slug || '').toLowerCase(), String(context.params.notizia || ''));
