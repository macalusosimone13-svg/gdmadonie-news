import { paginaPaesi } from '../_lib/paesi';

// /paesi: elenco dei paesi, gia' compilato lato server per i motori di ricerca.
export const onRequestGet: PagesFunction = async (context) => paginaPaesi(context, null);
