import { createClient } from 'npm:@supabase/supabase-js@2';

// ---------------------------------------------------------------------------
// ars-scheda — bozza della "scheda" di una legge approvata dall'ARS: in breve,
// titolo semplice e spiegazione articolo per articolo (per chi e', come si
// chiede), scritta da Gemini dal testo del disegno di legge allegato al
// resoconto della seduta del voto. Resta una BOZZA in ars_leggi.extra.bozza:
// la redazione la rilegge e la pubblica dal pannello Admin → ARS
// (funzione ars_scheda_decidi). Fino ad allora la pagina della legge mostra
// solo i fatti (voto, percorso, documenti).
//  - POST { legge: 'L273-253A' } da un admin (anche per rifarla);
//  - POST { lotto: 2 } con CRON_SECRET: le leggi nuove che hanno il testo.
// ---------------------------------------------------------------------------

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!;
const MODELLI: [string, number][] = [['gemini-3.1-flash-lite', 0], ['gemini-3.1-flash-lite', 4000], ['gemini-3.5-flash-lite', 1500], ['gemini-flash-lite-latest', 3000]];
const PERSONE = ['Giovani', 'Famiglie', 'Studenti', 'Pazienti', 'Anziani e disabilità', 'Chi viaggia', 'Imprese', 'Agricoltori', 'Comuni', 'Lavoratori'];
const TEMI = ['Sanità', 'Agricoltura', 'Acqua e ambiente', 'Trasporti', 'Scuola e università', 'Lavoro', 'Imprese', 'Comuni', 'Casa', 'Famiglie', 'Cultura', 'Turismo', 'Energia', 'Protezione civile', 'Istituzioni', 'Bilancio', 'Altro'];

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (d: unknown, status = 200) => Response.json(d, { status, headers: cors });

function estraiJson(t: string) {
  let s = t.trim();
  const f = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (f) s = f[1].trim();
  return JSON.parse(s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1));
}
async function gemini(system: string, testo: string) {
  let ultimo = '';
  for (const [model, attesa] of MODELLI) {
    if (attesa) await new Promise((ok) => setTimeout(ok, attesa));
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ system_instruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: testo }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.2 } }),
        signal: AbortSignal.timeout(90000),
      });
      if (r.ok) {
        const d = await r.json();
        return { out: estraiJson((d.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text || '').join('\n')), model };
      }
      ultimo = `${model}: ${r.status}`;
      if (![429, 500, 503, 404].includes(r.status)) throw new Error('Gemini ' + r.status + ' ' + (await r.text()).slice(0, 200));
    } catch (e) { ultimo = `${model}: ${(e as Error).message}`; }
  }
  throw new Error(`Gemini non disponibile in questo momento (${ultimo}). Riprova tra qualche minuto.`);
}

const PROMPT = `Sei il redattore della sezione ARS di GD Madonie News. Ricevi il testo di un disegno di legge approvato dall'Assemblea Regionale Siciliana (testo arrivato in Aula, con l'eventuale relazione). Prepari una scheda che spiega la legge a chiunque: frasi brevi, parole semplici, tono neutro (nessun giudizio, nessun commento politico). Usa SOLO quello che c'e' nel testo: non inventare cifre, date, enti o regole.
Rispondi SOLO con JSON:
{"titolo_breve": "titolo semplice che dice cosa fa la legge, max 70 caratteri (es. 'Più tutela per i cimiteri storici')",
 "breve": ["2 o 3 frasi brevi: cosa fa la legge e per chi"],
 "misure": [{"articolo": "numero dell'articolo (es. '3' o '5 c.2')", "titolo": "cosa fa, max 80 caratteri", "sintesi": "1-2 frasi semplici",
   "tema": uno tra ${TEMI.map((t) => '"' + t + '"').join(', ')},
   "per": [chi riguarda, scegliendo tra ${PERSONE.map((p) => '"' + p + '"').join(', ')}; [] se nessuno in particolare],
   "mln": milioni di euro stanziati SE il testo li indica per quell'articolo (numero), altrimenti null,
   "come_si_chiede": "se c'e' un contributo o un beneficio da chiedere: chi lo gestisce e come (bando, avviso, decreto) secondo il testo; altrimenti null"}],
 "nota": "solo se serve: una frase su cosa manca o va verificato (es. regole rinviate a un decreto), altrimenti null"}
Nelle "misure" metti gli articoli che contano per i cittadini (al massimo 25), salta quelli tecnici (norma finanziaria, entrata in vigore, abrogazioni) a meno che non siano importanti.`;

async function prepara(sb: any, l: any) {
  const testo = String(l.testo || '');
  if (testo.length < 400) throw new Error('Testo del disegno di legge non disponibile');
  const { out, model } = await gemini(PROMPT, `Disegno di legge n. ${l.ddl}: ${l.titolo || ''}\nApprovato dall'ARS il ${l.data}.\n\nTESTO:\n${testo.slice(0, 80000)}`);
  const misure = (Array.isArray(out?.misure) ? out.misure : []).slice(0, 30).map((m: any, i: number) => ({
    articolo: String(m?.articolo || '').slice(0, 20), titolo: String(m?.titolo || '').slice(0, 120), sintesi: String(m?.sintesi || '').slice(0, 500),
    tema: TEMI.includes(m?.tema) ? m.tema : null, per: (Array.isArray(m?.per) ? m.per : []).filter((p: any) => PERSONE.includes(p)),
    mln: typeof m?.mln === 'number' && isFinite(m.mln) ? m.mln : null, come_si_chiede: typeof m?.come_si_chiede === 'string' && m.come_si_chiede.trim() ? m.come_si_chiede.trim() : null, ordine: i,
  })).filter((m: any) => m.titolo && m.articolo);
  const bozza = {
    titolo_breve: typeof out?.titolo_breve === 'string' ? out.titolo_breve.trim().slice(0, 90) : null,
    breve: (Array.isArray(out?.breve) ? out.breve : []).filter((x: any) => typeof x === 'string' && x.trim()).slice(0, 4),
    misure, nota: typeof out?.nota === 'string' && out.nota.trim() ? out.nota.trim() : null,
    creata: new Date().toISOString(), modello: model,
  };
  const extra = { ...(l.extra || {}), bozza };
  await sb.from('ars_leggi').update({ extra }).eq('id', l.id);
  return bozza;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  const cron = (Deno.env.get('CRON_SECRET') || '').trim();
  let ok = !!token && !!cron && token === cron;
  if (!ok && token) {
    const { data: u } = await sb.auth.getUser(token);
    if (u?.user) {
      const { data: p } = await sb.from('profiles').select('role').eq('id', u.user.id).single();
      ok = p?.role === 'admin' || p?.role === 'editor';
    }
  }
  if (!ok) return json({ error: 'Non autorizzato' }, 403);
  let body: any = {};
  try { body = await req.json(); } catch { /* */ }
  try {
    if (body.legge) {
      const { data: l } = await sb.from('ars_leggi').select('id, ddl, titolo, data, testo, extra').eq('id', String(body.legge)).maybeSingle();
      if (!l) return json({ error: 'Legge non trovata' }, 404);
      return json({ ok: true, bozza: await prepara(sb, l) });
    }
    // lotto: leggi approvate con il testo, senza scheda pubblicata ne' bozza, senza misure
    const n = Math.min(Number(body.lotto) || 2, 4);
    const { data: leggi } = await sb.from('ars_leggi').select('id, ddl, titolo, data, testo, extra').eq('approvata', true).is('unita_a', null)
      .not('testo', 'is', null).is('extra->bozza', null).is('extra->scheda', null).order('data', { ascending: false }).limit(n * 3);
    const fatte: string[] = [], errori: string[] = [];
    const inizio = Date.now();
    for (const l of leggi || []) {
      if (fatte.length >= n || Date.now() - inizio > 100000) break;
      const { count } = await sb.from('ars_misure').select('id', { count: 'exact', head: true }).eq('legge_id', l.id);
      if (count) continue;
      try { await prepara(sb, l); fatte.push(l.id); } catch (e) { errori.push(`${l.id}: ${(e as Error).message}`); }
    }
    return json({ fatte, errori });
  } catch (e) {
    return json({ error: (e as Error).message }, 200);
  }
});
