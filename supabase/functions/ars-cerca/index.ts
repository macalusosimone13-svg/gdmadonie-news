import { createClient } from 'npm:@supabase/supabase-js@2';

// ---------------------------------------------------------------------------
// ars-cerca — "Chiedi all'ARS": risponde a qualsiasi domanda usando tutto
// quello che il sito sa (atti dell'ARS con le risposte del Governo, leggi,
// misure, commissioni, News GD, rassegna stampa, notizie dei paesi).
//  1) Gemini trasforma la domanda in parole chiave (con sinonimi) e luoghi;
//  2) il database trova le fonti (ricerca testuale, ars_cerca_fonti);
//  3) Gemini risponde in parole semplici usando SOLO quelle fonti e le cita.
// Se l'IA non risponde, il sito mostra comunque le fonti trovate.
// Aperto a tutti, con un limite di domande per indirizzo IP.
// ---------------------------------------------------------------------------

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!;
const GEMINI_MODEL = 'gemini-3.1-flash-lite';
const COMUNI = ['Alimena', 'Aliminusa', 'Blufi', 'Bompietro', 'Caccamo', 'Caltavuturo', 'Castelbuono', 'Castellana Sicula', 'Cefalù', 'Collesano', 'Gangi', 'Geraci Siculo', 'Gratteri', 'Isnello', 'Montemaggiore Belsito', 'Petralia Soprana', 'Petralia Sottana', 'Polizzi Generosa', 'Pollina', 'San Mauro Castelverde', 'Scillato', 'Sclafani Bagni'];
const LUOGHI = [...COMUNI, 'Madonie', 'Piano Battaglia', 'Piano Zucchi', 'Gibilmanna', 'Parco delle Madonie', 'SS 120'];
const STOP = new Set('il lo la i gli le un una uno di a da in con su per tra fra e o ma che chi cosa come quali quale sono sulla sulle sui sul del della delle dei degli al alla alle ai agli nel nella nelle nei ci ce è ha hanno fatto fatta fare ultime ultimi ultima ultimo recente recenti ars regione siciliana sicilia mi dimmi cerca cercami vorrei sapere notizie atti tutto tutti tutte stato stati quando dove perché perche cosa novità'.split(' '));

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (d: unknown, status = 200) => Response.json(d, { status, headers: cors });

function estraiJson(text: string) {
  let t = text.trim();
  const f = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (f) t = f[1].trim();
  return JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
}
async function gemini(system: string, testo: string, temperature = 0.2) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  for (let a = 1; a <= 3; a++) {
    const r = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ system_instruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: testo }] }],
        generationConfig: { responseMimeType: 'application/json', temperature } }),
      signal: AbortSignal.timeout(30000),
    });
    if (r.ok) {
      const d = await r.json();
      return estraiJson((d.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text || '').join('\n'));
    }
    const err = await r.text();
    if ((r.status === 429 || r.status === 503) && a < 3) { await new Promise((ok) => setTimeout(ok, a * 2000)); continue; }
    throw new Error('Gemini ' + r.status + ' ' + err.slice(0, 160));
  }
}
async function sha(s: string) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join('').slice(0, 24);
}
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

const oggiIt = () => new Date().toLocaleDateString('it-IT', { timeZone: 'Europe/Rome', day: 'numeric', month: 'long', year: 'numeric' });

const PROMPT_PAROLE = () => `Trasformi la domanda di un cittadino in una ricerca nell'archivio dell'Assemblea Regionale Siciliana (interrogazioni, interpellanze, mozioni, disegni di legge, leggi, commissioni) e nelle notizie di un sito delle Madonie. Oggi e' ${oggiIt()}.
Rispondi SOLO con JSON:
{"musts": [nomi propri o luoghi che DEVONO comparire, es. "Blufi"; [] se la domanda e' generica],
 "anys": [8-16 parole chiave italiane per trovare i documenti: le parole importanti della domanda, i loro sinonimi e i termini che userebbe un testo ufficiale (es. diga -> "diga", "invaso", "bacino", "serbatoio"; medico di base -> "medico di medicina generale", "guardia medica", "assistenza primaria"); niente parole vuote],
 "comuni": [comuni o luoghi delle Madonie citati, scelti tra: ${LUOGHI.join(', ')}],
 "futuro": true se chiede cose in programma o prossime, altrimenti false}`;

const PROMPT_RISPOSTA = () => `Sei l'assistente della sezione ARS di GD Madonie News. Oggi e' ${oggiIt()}. Rispondi alla domanda del cittadino usando SOLO le fonti numerate che ricevi (atti dell'Assemblea Regionale Siciliana, risposte del Governo regionale, leggi, convocazioni delle commissioni, notizie del sito).
Regole:
- italiano semplice, frasi brevi, 3-7 frasi in tutto; spiega le parole tecniche;
- metti prima le cose piu' recenti e piu' pertinenti, con le date;
- di' chi ha presentato un atto e se il Governo ha risposto, solo se lo dicono le fonti;
- tono neutro: nessuna opinione, nessun giudizio su partiti o persone;
- non inventare: se le fonti non rispondono alla domanda, dillo chiaramente e spiega cosa hai trovato di vicino;
- ignora le fonti che parlano d'altro.
Rispondi SOLO con JSON: {"risposta": "...", "fonti": [numeri delle fonti che hai usato, in ordine di importanza]}`;

const ETICHETTA: Record<string, string> = { atto: 'Atto ARS', legge: 'Legge approvata', misura: 'Misura di una legge', commissione: 'Commissione ARS', gd: 'News GD', stampa: 'Rassegna stampa', paese: 'Notizia dal paese' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST' }, 405);
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  let body: any = {};
  try { body = await req.json(); } catch { /* */ }
  const domanda = String(body.domanda || '').replace(/\s+/g, ' ').trim().slice(0, 300);
  if (domanda.length < 3) return json({ error: 'Scrivi una domanda.' }, 400);

  // risposta gia' data di recente alla stessa domanda
  const chiave = await sha(norm(domanda));
  const { data: c } = await sb.from('ars_cerca_cache').select('risposta, at').eq('chiave', chiave).maybeSingle();
  if (c && Date.now() - new Date(c.at).getTime() < 6 * 3600_000) return json({ ...c.risposta, cache: true });

  // limite: 12 domande in 10 minuti e 60 al giorno per indirizzo, 1500 al giorno in tutto
  const ip = req.headers.get('cf-connecting-ip') || (req.headers.get('x-forwarded-for') || '').split(',')[0].trim();
  const iph = ip ? await sha('gdm' + ip) : null;
  const [{ count: dieci }, { count: giorno }, { count: tutte }] = await Promise.all([
    sb.from('ars_cerca_log').select('id', { count: 'exact', head: true }).eq('iph', iph || '-').not('domanda', 'like', 'sintesi:%').gte('at', new Date(Date.now() - 600_000).toISOString()),
    sb.from('ars_cerca_log').select('id', { count: 'exact', head: true }).eq('iph', iph || '-').not('domanda', 'like', 'sintesi:%').gte('at', new Date(Date.now() - 86400_000).toISOString()),
    sb.from('ars_cerca_log').select('id', { count: 'exact', head: true }).not('domanda', 'like', 'sintesi:%').gte('at', new Date(Date.now() - 86400_000).toISOString()),
  ]);
  const limite = (dieci || 0) >= 12 || (giorno || 0) >= 60 || (tutte || 0) >= 1500;
  await sb.from('ars_cerca_log').insert({ iph, domanda });

  // 1) parole chiave
  let p: any = null;
  if (!limite) {
    try { p = await gemini(PROMPT_PAROLE(), domanda, 0.1); } catch (e) { console.error('[parole]', (e as Error).message); }
  }
  const parole = norm(domanda).split(' ').filter((w) => w.length > 2 && !STOP.has(w));
  const comuniDomanda = LUOGHI.filter((l) => norm(domanda).includes(norm(l)) || (l.startsWith('Petralia') && norm(domanda).includes('petralia')));
  const musts: string[] = Array.isArray(p?.musts) ? p.musts.filter((x: any) => typeof x === 'string').slice(0, 3) : [];
  const anys: string[] = [...new Set([...(Array.isArray(p?.anys) ? p.anys.filter((x: any) => typeof x === 'string') : []), ...parole])].slice(0, 22);
  const comuni: string[] = [...new Set([...(Array.isArray(p?.comuni) ? p.comuni.filter((x: any) => LUOGHI.includes(x)) : []), ...comuniDomanda])];
  if (comuni.includes('Petralia Sottana') || comuni.includes('Petralia Soprana') || /petralia/.test(norm(domanda))) {
    for (const x of ['Petralia Sottana', 'Petralia Soprana']) if (!comuni.includes(x)) comuni.push(x);
  }
  const futuro = p?.futuro === true || /\b(prossim|quando|in programma|calendario|convocat)/i.test(domanda);

  // 2) fonti
  let { data: fonti, error } = await sb.rpc('ars_cerca_fonti', { musts, anys, comuni, limite: 24, futuro });
  if (error) console.error('[fonti]', error.message);
  if ((fonti || []).length < 4 && musts.length) {
    const r2 = await sb.rpc('ars_cerca_fonti', { musts: [], anys: [...musts, ...anys], comuni, limite: 24, futuro });
    const visti = new Set((fonti || []).map((f: any) => f.fonte + f.id));
    fonti = [...(fonti || []), ...(r2.data || []).filter((f: any) => !visti.has(f.fonte + f.id))];
  }
  fonti = (fonti || []).slice(0, 24);

  // collegamenti per il sito
  const link = (f: any) => {
    if (f.url) return f.url;
    if (f.fonte === 'atto') return `/ars/atto/${({ I: 'interrogazione', P: 'interpellanza', M: 'mozione', D: 'ddl' } as any)[f.id[0]]}-${f.id.slice(1)}`;
    if (f.fonte === 'gd' || f.fonte === 'stampa') return `/post/${f.id}`;
    if (f.fonte === 'paese') return `/paesi/${f.id.split('/')[0]}`;
    return '/ars';
  };
  const elenco = fonti.map((f: any, i: number) => ({ ...f, n: i + 1, link: link(f), etichetta: ETICHETTA[f.fonte] || 'Fonte' }));

  // 3) risposta
  let risposta: string | null = null;
  let usate: number[] = [];
  if (!limite && elenco.length) {
    const testo = `DOMANDA: ${domanda}\n\nFONTI:\n` + elenco.map((f: any) =>
      `[${f.n}] ${f.etichetta}${f.fonte === 'atto' ? ' (' + f.id + ')' : ''} · ${f.data || 'senza data'}${f.risposta && f.fonte === 'atto' ? ' · il Governo ha risposto' : ''}\nTitolo: ${f.titolo}\n${f.estratto ? 'Estratto: ' + String(f.estratto).slice(0, 700) : ''}`).join('\n\n');
    try {
      const out = await gemini(PROMPT_RISPOSTA(), testo, 0.2);
      if (typeof out?.risposta === 'string') risposta = out.risposta.trim();
      if (Array.isArray(out?.fonti)) usate = out.fonti.map(Number).filter((n: number) => n >= 1 && n <= elenco.length);
    } catch (e) { console.error('[risposta]', (e as Error).message); }
  } else if (!elenco.length && !limite) {
    risposta = "Nell'archivio dell'ARS e nelle notizie del sito non ho trovato nulla su questa domanda. Prova con altre parole (per esempio il nome del paese o dell'opera).";
  }

  // fonti: prima quelle usate dall'IA, poi le altre piu' pertinenti
  const ordine = [...usate, ...elenco.map((f: any) => f.n).filter((n: number) => !usate.includes(n))];
  const out = {
    domanda,
    risposta,
    limite,
    fonti: ordine.slice(0, 10).map((n) => elenco[n - 1]).map((f: any) => ({
      n: f.n, fonte: f.fonte, etichetta: f.etichetta, id: f.id, titolo: f.titolo, data: f.data, link: f.link,
      risposta: f.fonte === 'atto' ? f.risposta : undefined, usata: usate.includes(f.n),
    })),
    parole: { musts, anys: anys.slice(0, 10), comuni },
  };
  if (risposta && !limite && elenco.length) await sb.from('ars_cerca_cache').upsert({ chiave, domanda, risposta: out, at: new Date().toISOString() });
  return json(out);
});
