import { paginaArs } from '../_lib/ars';

// /ars e tutte le sue pagine (leggi, atti, sedute, deputati): compilate lato server.
export const onRequestGet: PagesFunction = async (context) => paginaArs(context);
