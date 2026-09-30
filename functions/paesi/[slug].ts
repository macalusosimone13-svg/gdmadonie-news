import { paginaPaesi } from '../_lib/paesi';

// /paesi/<paese>: pagina del singolo comune, gia' compilata lato server.
export const onRequestGet: PagesFunction = async (context) => paginaPaesi(context, String(context.params.slug || '').toLowerCase());
