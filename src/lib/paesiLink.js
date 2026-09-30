// Indirizzo della pagina di una notizia dei paesi:
//   /paesi/<paese>/<titolo-leggibile>-<primi 8 caratteri dell'id>
// Il titolo serve a Google e a chi legge il link; per trovare la notizia
// conta solo il codice finale. La stessa regola e' in functions/_lib/paesi.ts
// e nella funzione sitemap: se si cambia qui, va cambiata anche li'.
export const slugTitolo = (t) => {
  let s = String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (s.length > 70) s = s.slice(0, 70).replace(/-[^-]*$/, '');
  return s || 'notizia';
};

export const linkNotizia = (comuneSlug, n) => `/paesi/${comuneSlug}/${slugTitolo(n.titolo)}-${String(n.id).slice(0, 8)}`;

// Dal pezzo finale dell'indirizzo al codice della notizia (8 caratteri esadecimali).
export const codiceNotizia = (param) => (String(param || '').toLowerCase().match(/([0-9a-f]{8})$/) || [])[1] || null;

// Intervallo di id che iniziano con quel codice (gli uuid si confrontano in ordine).
export const rangeId = (codice) => [`${codice}-0000-0000-0000-000000000000`, `${codice}-ffff-ffff-ffff-ffffffffffff`];
