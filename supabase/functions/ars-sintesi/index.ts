import { createClient } from 'npm:@supabase/supabase-js@2';

// ---------------------------------------------------------------------------
// ars-sintesi — spiegazione in parole semplici di un atto dell'ARS
// (interrogazione, interpellanza, mozione, disegno di legge), scritta da
// Gemini partendo SOLO dal testo ufficiale e salvata nel database.
//  - POST { k: 'I2743' } dal sito: restituisce la sintesi (la crea se manca o
//    se il testo e' cambiato). Limite per indirizzo IP.
//  - POST { lotto: 20 } con CRON_SECRET: prepara in anticipo le sintesi degli
//    atti nuovi (prima quelli sulle Madonie, poi i piu' recenti).
// ---------------------------------------------------------------------------

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!;
const GEMINI_MODEL = 'gemini-3.1-flash-lite';
const VERSIONE = 'v1';
export const TEMI = ['Sanità', 'Agricoltura e pesca', 'Acqua e dighe', 'Ambiente e rifiuti', 'Strade e trasporti', 'Scuola e università',
  'Lavoro e precari', 'Imprese e turismo', 'Comuni ed enti locali', 'Cultura e beni culturali', 'Sociale e famiglie', 'Bilancio e fondi',
  'Legalità e sicurezza', 'Energia', 'Casa', 'Istituzioni e Regione', 'Sport', 'Protezione civile', 'Altro'];
const TIPI: Record<string, string> = { I: 'interrogazione', P: 'interpellanza', M: 'mozione', D: 'disegno di legge' };

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (d: unknown, status = 200) => Response.json(d, { status, headers: cors });

function estraiJson(text: string) {
  let t = text.trim();
  const f = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (f) t = f[1].trim();
  return JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
}
async function gemini(system: string, testo: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  for (let a = 1; a <= 3; a++) {
    const r = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ system_instruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: testo }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 } }),
      signal: AbortSignal.timeout(40000),
    });
    if (r.ok) {
      const d = await r.json();
      return estraiJson((d.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text || '').join('\n'));
    }
    const err = await r.text();
    if ((r.status === 429 || r.status === 503) && a < 3) { await new Promise((ok) => setTimeout(ok, a * 2500)); continue; }
    throw new Error('Gemini ' + r.status + ' ' + err.slice(0, 160));
  }
}

const PROMPT = `Sei il redattore della sezione ARS di GD Madonie News. Spieghi a chiunque (un ragazzo, un pensionato) un atto dell'Assemblea Regionale Siciliana partendo SOLO dal testo ufficiale che ricevi.
Scrivi in italiano semplice, frasi brevi, niente parole tecniche (se servono, spiegale), tono neutro: nessun giudizio, nessuna opinione, nessun commento politico. Non inventare nulla che non sia nel testo: niente cifre, date, nomi o conseguenze che il testo non dice.
Rispondi SOLO con JSON:
{"breve": "2 o 3 frasi: di cosa parla e perche' e' stato presentato",
 "chiede": ["cosa chiedono o propongono i firmatari, 1-4 punti brevi; per un disegno di legge: cosa cambierebbe"],
 "risposta": "solo se c'e' una risposta del Governo: 1-3 frasi su cosa ha risposto, altrimenti null",
 "tema": uno tra ${TEMI.map((t) => '"' + t + '"').join(', ')}}`;

async function impronta(s: string) {
  const b = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

async function sintetizza(sb: any, a: any) {
  const risp = a.risposta?.txt || ((a.orale && ['svolta', 'parzialmente svolta'].includes(a.orale.stato)) ? a.orale.txt : '');
  const base = `${VERSIONE}|${a.titolo}|${a.testo || ''}|${risp || ''}`;
  const h = await impronta(base);
  if (a.sintesi && a.sintesi_hash === h) return a.sintesi;
  if (!a.testo && !risp) {
    // solo il titolo: niente IA (non c'e' abbastanza per spiegare senza inventare)
    const s = { breve: null, chiede: [], risposta: null, solo_titolo: true };
    await sb.from('ars_atti').update({ sintesi: s, sintesi_hash: h, sintesi_at: new Date().toISOString() }).eq('k', a.k);
    return s;
  }
  const testo = `Tipo: ${TIPI[a.tipo] || 'atto'} n. ${a.n}\nTitolo: ${a.titolo}\n` +
    (a.destinatari?.length ? `Rivolta a: ${a.destinatari.join('; ')}\n` : '') +
    (a.testo ? `\nTESTO UFFICIALE:\n${String(a.testo).slice(0, 7000)}\n` : '') +
    (risp ? `\nRISPOSTA DEL GOVERNO:\n${String(risp).slice(0, 5000)}\n` : '\n(Il Governo non ha ancora risposto.)\n');
  const out = await gemini(PROMPT, testo);
  const s = {
    breve: typeof out?.breve === 'string' ? out.breve.trim() : null,
    chiede: Array.isArray(out?.chiede) ? out.chiede.filter((x: any) => typeof x === 'string' && x.trim()).slice(0, 5) : [],
    risposta: risp && typeof out?.risposta === 'string' && out.risposta.trim() ? out.risposta.trim() : null,
    modello: GEMINI_MODEL,
  };
  const tema = TEMI.includes(out?.tema) ? out.tema : null;
  await sb.from('ars_atti').update({ sintesi: s, sintesi_hash: h, sintesi_at: new Date().toISOString(), tema }).eq('k', a.k);
  return s;
}

const CAMPI = 'k, tipo, n, titolo, testo, destinatari, risposta, orale, sintesi, sintesi_hash, luoghi, data';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST' }, 405);
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  let body: any = {};
  try { body = await req.json(); } catch { /* */ }

  // ---- lotto programmato (cron)
  if (body.lotto) {
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
    const cron = (Deno.env.get('CRON_SECRET') || '').trim();
    if (!token || token !== cron) return json({ error: 'Non autorizzato' }, 403);
    const inizio = Date.now();
    const n = Math.min(Number(body.lotto) || 15, 40);
    const madonie = ['Madonie', 'Alimena', 'Aliminusa', 'Blufi', 'Bompietro', 'Caccamo', 'Caltavuturo', 'Castelbuono', 'Castellana Sicula', 'Cefalù', 'Collesano', 'Gangi', 'Geraci Siculo', 'Gratteri', 'Isnello', 'Montemaggiore Belsito', 'Petralia Soprana', 'Petralia Sottana', 'Polizzi Generosa', 'Pollina', 'San Mauro Castelverde', 'Scillato', 'Sclafani Bagni'];
    const primi = await sb.from('ars_atti').select(CAMPI).is('sintesi', null).overlaps('luoghi', madonie).order('data', { ascending: false }).limit(n);
    let lista = primi.data || [];
    if (lista.length < n) {
      const altri = await sb.from('ars_atti').select(CAMPI).is('sintesi', null).order('data', { ascending: false }).limit(n - lista.length);
      lista = lista.concat(altri.data || []);
    }
    // atti con una risposta del Governo arrivata dopo la sintesi: va rifatta
    if (lista.length < n) {
      const rifare = await sb.from('ars_atti').select(CAMPI).eq('ha_risposta', true).not('sintesi', 'is', null).is('sintesi->risposta', null)
        .is('sintesi->solo_titolo', null).order('data', { ascending: false }).limit(n - lista.length);
      lista = lista.concat(rifare.data || []);
    }
    const fatti: string[] = [], errori: string[] = [];
    for (const a of lista) {
      if (Date.now() - inizio > 110000) break;
      try { await sintetizza(sb, a); fatti.push(a.k); } catch (e) { errori.push(`${a.k}: ${(e as Error).message}`); if (/429/.test((e as Error).message)) break; }
    }
    return json({ fatti: fatti.length, errori });
  }

  // ---- singolo atto dal sito
  const k = String(body.k || '').toUpperCase();
  if (!/^[IPMD]\d{1,5}$/.test(k)) return json({ error: 'atto non valido' }, 400);
  const { data: a } = await sb.from('ars_atti').select(CAMPI).eq('k', k).maybeSingle();
  if (!a) return json({ error: 'atto non trovato' }, 404);
  const risp = a.risposta?.txt || ((a.orale && ['svolta', 'parzialmente svolta'].includes(a.orale.stato)) ? a.orale.txt : '');
  const h = await impronta(`${VERSIONE}|${a.titolo}|${a.testo || ''}|${risp || ''}`);
  if (a.sintesi && a.sintesi_hash === h) return json({ sintesi: a.sintesi });

  // limite: 30 sintesi nuove all'ora per indirizzo, 400 in tutto
  const ip = req.headers.get('cf-connecting-ip') || (req.headers.get('x-forwarded-for') || '').split(',')[0].trim();
  const iph = ip ? await impronta('gdm' + ip) : null;
  const ora = new Date(Date.now() - 3600_000).toISOString();
  const [{ count: mie }, { count: tutte }] = await Promise.all([
    sb.from('ars_cerca_log').select('id', { count: 'exact', head: true }).eq('iph', iph || '-').like('domanda', 'sintesi:%').gte('at', ora),
    sb.from('ars_cerca_log').select('id', { count: 'exact', head: true }).like('domanda', 'sintesi:%').gte('at', ora),
  ]);
  if ((mie || 0) >= 30 || (tutte || 0) >= 400) return json({ sintesi: a.sintesi || null, limite: true });
  await sb.from('ars_cerca_log').insert({ iph, domanda: 'sintesi:' + k });
  try {
    return json({ sintesi: await sintetizza(sb, a) });
  } catch (e) {
    console.error('[sintesi]', k, (e as Error).message);
    return json({ sintesi: a.sintesi || null, errore: true });
  }
});
