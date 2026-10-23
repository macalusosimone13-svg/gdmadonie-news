// Sezione ARS: funzioni comuni a tutte le pagine (/ars/...).
// La stessa regola per gli indirizzi degli atti e' in functions/_lib/ars.ts,
// nella funzione sitemap e nella funzione ars-import (email "Avvisami").

export const SITE = 'https://www.gdmadonie-news.com';

export const TIPI = { I: 'Interrogazione', P: 'Interpellanza', M: 'Mozione', D: 'Disegno di legge' };
export const TIPI_PLURALE = { I: 'Interrogazioni', P: 'Interpellanze', M: 'Mozioni', D: 'Disegni di legge' };
const SLUG_TIPO = { I: 'interrogazione', P: 'interpellanza', M: 'mozione', D: 'ddl' };
const TIPO_SLUG = Object.fromEntries(Object.entries(SLUG_TIPO).map(([k, v]) => [v, k]));

export const COMUNI = ['Alimena', 'Aliminusa', 'Blufi', 'Bompietro', 'Caccamo', 'Caltavuturo', 'Castelbuono', 'Castellana Sicula', 'Cefalù', 'Collesano', 'Gangi', 'Geraci Siculo', 'Gratteri', 'Isnello', 'Montemaggiore Belsito', 'Petralia Soprana', 'Petralia Sottana', 'Polizzi Generosa', 'Pollina', 'San Mauro Castelverde', 'Scillato', 'Sclafani Bagni'];
export const MADONIE = ['Madonie', ...COMUNI];

export const TEMI = ['Sanità', 'Agricoltura e pesca', 'Acqua e dighe', 'Ambiente e rifiuti', 'Strade e trasporti', 'Scuola e università',
  'Lavoro e precari', 'Imprese e turismo', 'Comuni ed enti locali', 'Cultura e beni culturali', 'Sociale e famiglie', 'Bilancio e fondi',
  'Legalità e sicurezza', 'Energia', 'Casa', 'Istituzioni e Regione', 'Sport', 'Protezione civile'];

export const linkAtto = (k) => `/ars/atto/${SLUG_TIPO[k?.[0]] || 'atto'}-${String(k || '').slice(1)}`;
export const kDaSlug = (slug) => {
  const m = /^([a-z]+)-(\d{1,5})$/.exec(String(slug || '').toLowerCase());
  if (m && TIPO_SLUG[m[1]]) return TIPO_SLUG[m[1]] + m[2];
  const m2 = /^([ipmd])(\d{1,5})$/i.exec(String(slug || ''));
  return m2 ? m2[1].toUpperCase() + m2[2] : null;
};
export const linkLegge = (id) => `/ars/legge/${String(id || '').toLowerCase()}`;
export const idDaSlugLegge = (s) => String(s || '').toUpperCase().replace(/^L/, 'L');

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const MESI_B = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
export const fmtData = (d, breve = false) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || '');
  if (!m) return '';
  return `${+m[3]} ${(breve ? MESI_B : MESI)[+m[2] - 1]} ${m[1]}`;
};
export const giornoMese = (d) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || '');
  return m ? { g: +m[3], m: MESI_B[+m[2] - 1], a: m[1] } : null;
};
export const oggiRoma = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });

// "Rossi, Bianchi e altri 2"
export const cognomi = (nomi, max = 3) => {
  const s = (nomi || []).map((n) => {
    const p = String(n).split(' ');
    return ['De', 'La', 'Lo', 'Di', 'Li'].includes(p[0]) && p.length > 2 ? p.slice(0, 2).join(' ') : p[0];
  });
  return s.slice(0, max).join(', ') + (s.length > max ? ` e altri ${s.length - max}` : '');
};

export const titoloLegge = (l) => String(l?.titolo_breve || l?.titolo || (l ? `Disegno di legge n. ${l.ddl}` : '')).replace(/\.\s*$/, '');

// Glossario: si apre toccando la parola sottolineata.
export const GLOSSARIO = {
  interrogazione: ['Interrogazione', 'Una domanda scritta che uno o più deputati fanno al Governo regionale su un problema preciso. Il Governo può rispondere per iscritto o in Aula.'],
  interpellanza: ['Interpellanza', 'Simile all\'interrogazione, ma chiede al Governo di spiegare le sue scelte e le sue intenzioni su una questione. Chi l\'ha presentata può replicare in Aula.'],
  mozione: ['Mozione', 'Un testo che, se l\'Aula lo approva, impegna il Governo regionale a fare qualcosa. Non è una legge.'],
  ddl: ['Disegno di legge (ddl)', 'Una proposta di legge. Prima la esamina una commissione, poi va in Aula: se viene approvata e pubblicata sulla Gazzetta ufficiale diventa legge regionale.'],
  commissione: ['Commissione', 'Un gruppo di deputati che esamina le proposte di legge su un tema (bilancio, sanità, ambiente...) prima del voto in Aula.'],
  stralcio: ['Stralcio', 'Quando una parte di una proposta di legge viene tolta dal testo e messa da parte: si potrà discutere più avanti, separatamente.'],
  gurs: ['GURS', 'Gazzetta Ufficiale della Regione Siciliana: le leggi entrano in vigore dopo essere pubblicate qui.'],
  variazioni: ['Variazioni di bilancio', 'Spostamenti di soldi tra le voci del bilancio della Regione durante l\'anno: si tolgono fondi da una parte per metterli in un\'altra.'],
  resoconto: ['Resoconto', 'Il verbale ufficiale di una seduta dell\'Aula: riporta parola per parola cosa è stato detto e votato.'],
  odg: ['Ordine del giorno', 'L\'elenco degli argomenti che l\'Aula o una commissione affronta in una seduta.'],
  risposta_scritta: ['Risposta scritta', 'La risposta che l\'assessore competente manda per iscritto all\'Assemblea; viene pubblicata negli allegati delle sedute.'],
  trasformata: ['Trasformata in risposta scritta', 'In Aula non c\'era chi l\'aveva presentata, o si è deciso così: la domanda resta valida ma il Governo risponderà per iscritto.'],
};

// "I - Affari Istituzionali" -> "Commissione I - Affari Istituzionali"; i nomi che iniziano gia' con "Commissione" restano come sono.
export const nomeCommissione = (c) => (/^commission/i.test(String(c || '').trim()) ? c : `Commissione ${c}`);
