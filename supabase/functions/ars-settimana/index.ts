import { createClient } from 'npm:@supabase/supabase-js@2';

// ---------------------------------------------------------------------------
// ars-settimana — rubrica "La settimana all'ARS": ogni venerdi' una BOZZA di
// News GD (status 'draft', rubrica 'settimana_ars') con i fatti della
// settimana all'Assemblea Regionale Siciliana presi dall'archivio del sito:
// leggi approvate, atti sulle Madonie, risposte del Governo, cosa c'e' la
// settimana dopo. Simone la rilegge e la pubblica da Admin → Redazione →
// Rubriche IA. Se la settimana e' vuota la bozza non si crea.
// POST { auto?: true } — auth CRON_SECRET o JWT admin.
// ---------------------------------------------------------------------------

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!;
const MODELLI: [string, number][] = [['gemini-3.1-flash-lite', 0], ['gemini-3.1-flash-lite', 4000], ['gemini-3.5-flash-lite', 1500], ['gemini-flash-lite-latest', 3000], ['gemini-3.1-flash-lite', 6000]];
const MADONIE = ['Madonie', 'Alimena', 'Aliminusa', 'Blufi', 'Bompietro', 'Caccamo', 'Caltavuturo', 'Castelbuono', 'Castellana Sicula', 'Cefalù', 'Collesano', 'Gangi', 'Geraci Siculo', 'Gratteri', 'Isnello', 'Montemaggiore Belsito', 'Petralia Soprana', 'Petralia Sottana', 'Polizzi Generosa', 'Pollina', 'San Mauro Castelverde', 'Scillato', 'Sclafani Bagni'];
const TIPI: Record<string, string> = { I: 'Interrogazione', P: 'Interpellanza', M: 'Mozione', D: 'Disegno di legge' };
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
          generationConfig: { responseMimeType: 'application/json', temperature: 0.3 } }),
        signal: AbortSignal.timeout(60000),
      });
      if (r.ok) {
        const d = await r.json();
        return estraiJson((d.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text || '').join('\n'));
      }
      ultimo = `${model}: ${r.status}`;
      if (![429, 500, 503, 404].includes(r.status)) throw new Error('Gemini ' + r.status);
    } catch (e) { ultimo = `${model}: ${(e as Error).message}`; }
  }
  throw new Error(`L'IA di Google (Gemini) e' sovraccarica in questo momento, riprova piu' tardi. [${ultimo}]`);
}

const REGOLE = `Scrivi per "News GD", la sezione notizie del sito GD Madonie News. Sei un redattore di cronaca politica.
REGOLE FERREE:
1. Voce giornalistica neutra, in terza persona. NESSUN commento, giudizio, opinione, auspicio o proposta. Non nominare mai i Giovani Democratici o GD Madonie.
2. Non inventare MAI fatti, numeri, nomi, date o dichiarazioni che non siano nel materiale fornito.
3. Niente frasi di contorno o di valutazione: solo fatti.
4. Riporta cifre, date, nomi dei deputati, gruppi e luoghi presenti nel materiale.
5. Niente hashtag, emoji, grassetti, elenchi puntati con simboli, markdown.
6. Italiano semplice e diretto, frasi brevi, paragrafi separati da una riga vuota.
7. Spiega in poche parole i termini tecnici (interrogazione = domanda di un deputato al Governo regionale, ecc.).`;

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const dataIt = (d: string) => { const m = /^(\d{4})-(\d\d)-(\d\d)/.exec(d || ''); return m ? `${+m[3]} ${MESI[+m[2] - 1]}` : ''; };
const oraRoma = () => Number(new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', hour12: false }).format(new Date()));
const oggiRoma = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  try {
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
    const cron = (Deno.env.get('CRON_SECRET') || '').trim();
    let ok = !!token && !!cron && token === cron;
    if (!ok && token) {
      const { data: u } = await sb.auth.getUser(token);
      if (u?.user) {
        const { data: p } = await sb.from('profiles').select('role').eq('id', u.user.id).single();
        ok = p?.role === 'admin';
      }
    }
    if (!ok) return json({ error: 'Non autorizzato' }, 403);
    let body: any = {};
    try { body = await req.json(); } catch { /* */ }
    if (body.auto) {
      if (oraRoma() !== 7) return json({ saltato: 'non sono le 7 in Italia' });
      const { count } = await sb.from('posts').select('id', { count: 'exact', head: true }).eq('rubrica', 'settimana_ars').gte('created_at', new Date(Date.now() - 20 * 3600000).toISOString());
      if ((count || 0) > 0) return json({ saltato: 'gia\' generata oggi' });
    }

    const oggi = oggiRoma();
    const da = new Date(Date.now() - 7 * 86400000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });
    const fra = new Date(Date.now() + 8 * 86400000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });
    const [leggi, madonie, risposte, sedute, prossime, conv, totale] = await Promise.all([
      sb.from('ars_leggi').select('id, ddl, titolo, titolo_breve, data, favorevoli, contrari, astenuti, extra').eq('approvata', true).is('unita_a', null).gte('data', da).order('data'),
      sb.from('ars_atti').select('k, tipo, n, titolo, data, firmatari, gruppo, luoghi, sintesi').overlaps('luoghi', MADONIE).gte('data', da).order('data'),
      sb.from('ars_atti').select('k, tipo, n, titolo, firmatari, gruppo, luoghi, risposta, orale, sintesi').eq('ha_risposta', true).or(`risposta->>d.gte.${da},orale->>data.gte.${da}`).limit(40),
      sb.from('ars_sedute').select('n, data, odg').gte('data', da).lte('data', oggi).order('data'),
      sb.from('ars_sedute').select('n, data, odg').gt('data', oggi).lte('data', fra).eq('tolta', false).order('data'),
      sb.from('ars_convocazioni').select('data, commissione, odg').gt('data', oggi).lte('data', fra).eq('disdetta', false).eq('tolta', false).order('data').limit(20),
      sb.from('ars_atti').select('k', { count: 'exact', head: true }).gte('data', da),
    ]);
    const L = leggi.data || [], M = madonie.data || [], R = (risposte.data || []).filter((a: any) => (a.risposta?.d || '') >= da || ((a.orale?.data || '') >= da && ['svolta', 'parzialmente svolta'].includes(a.orale?.stato)));
    if (!L.length && !M.length && !R.length) {
      const msg = 'Settimana all\'ARS: nessuna legge, nessun atto sulle Madonie e nessuna risposta del Governo negli ultimi 7 giorni. Bozza non creata.';
      try { await sb.from('execution_logs').insert({ run_date: new Date().toISOString(), total_found: 0, total_added: 0, status: 'success', summary: `[Rubriche IA] saltata: ${msg}`, details: [] }); } catch { /* */ }
      return json({ saltato: msg });
    }
    const righe = (a: any) => `${TIPI[a.tipo]} n. ${a.n} (${dataIt(a.data || a.risposta?.d || a.orale?.data)})${a.firmatari?.length ? ', presentata da ' + a.firmatari.slice(0, 3).join(', ') + (a.firmatari.length > 3 ? ' e altri' : '') + (a.gruppo ? ` (${a.gruppo})` : '') : ''}: ${a.titolo}${a.sintesi?.breve ? '\n  In breve: ' + a.sintesi.breve : ''}`;
    const materiale = [
      `PERIODO: dal ${dataIt(da)} al ${dataIt(oggi)}. Atti presentati in tutto all'ARS in questi giorni: ${totale.count || 0}.`,
      L.length ? `LEGGI APPROVATE:\n${L.map((l: any) => `- ${dataIt(l.data)}: ${l.titolo_breve ? l.titolo_breve + ' — ' : ''}${l.titolo || 'ddl ' + l.ddl} (ddl ${l.ddl}; ${l.favorevoli ?? '?'} sì, ${l.contrari ?? 0} no, ${l.astenuti ?? 0} astenuti)${l.extra?.breve?.length ? '\n  ' + l.extra.breve.join(' ') : ''}`).join('\n')}` : 'LEGGI APPROVATE: nessuna.',
      M.length ? `ATTI CHE RIGUARDANO LE MADONIE:\n${M.map((a: any) => '- ' + righe(a) + ` [luoghi: ${(a.luoghi || []).join(', ')}]`).join('\n')}` : 'ATTI SULLE MADONIE: nessuno.',
      R.length ? `RISPOSTE DEL GOVERNO ARRIVATE:\n${R.slice(0, 12).map((a: any) => '- ' + righe(a) + (a.sintesi?.risposta ? '\n  Risposta in breve: ' + a.sintesi.risposta : '')).join('\n')}` : 'RISPOSTE DEL GOVERNO: nessuna.',
      (sedute.data || []).length ? `SEDUTE DELL'AULA: ${(sedute.data || []).map((s: any) => `n. ${s.n} del ${dataIt(s.data)}${s.odg?.length ? ' (' + s.odg.slice(0, 3).join('; ') + ')' : ''}`).join(' | ')}` : '',
      (prossime.data || []).length || (conv.data || []).length ? `LA PROSSIMA SETTIMANA:\n${(prossime.data || []).map((s: any) => `- Aula, seduta n. ${s.n} il ${dataIt(s.data)}${s.odg?.length ? ': ' + s.odg.slice(0, 2).join('; ') : ''}`).join('\n')}\n${(conv.data || []).slice(0, 8).map((c: any) => `- ${c.commissione}, ${dataIt(c.data)}: ${String(c.odg).slice(0, 200)}`).join('\n')}` : '',
    ].filter(Boolean).join('\n\n');

    const scritto = await gemini(`${REGOLE}

COMPITO: scrivi "La settimana all'ARS", il riepilogo settimanale di quello che e' successo all'Assemblea Regionale Siciliana, usando SOLO il materiale fornito.
STRUTTURA del campo "body" (paragrafi separati da una riga vuota, niente titoletti in maiuscolo):
1. Apertura: 2-3 frasi con i fatti piu' importanti della settimana (prima le leggi approvate, se ci sono).
2. Un paragrafo per ogni legge approvata: cosa prevede (solo se e' nel materiale) e come e' andato il voto.
3. "Dalle Madonie": un paragrafo che racconta gli atti che riguardano i nostri paesi, con il nome del paese, chi li ha presentati e cosa chiedono.
4. Le risposte del Governo piu' rilevanti (prima quelle sulle Madonie).
5. Chiusura: cosa c'e' in programma la prossima settimana (se nel materiale), poi la frase "Tutti gli atti, le leggi e le risposte del Governo sono nella sezione ARS di GD Madonie News."
Lunghezza: 350-700 parole. Salta le parti per cui non c'e' materiale.
TITOLO: max 95 caratteri, inizia con "La settimana all'ARS:" seguito dal fatto piu' importante.
Rispondi SOLO con JSON {"title": "...", "body": "..."}.`, materiale);
    if (!scritto?.title || !scritto?.body) throw new Error('Risposta dell\'IA incompleta, riprova.');
    const testo = String(scritto.body).replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
    const primo = testo.split(/\n\s*\n/)[0] || testo;
    const { data: post, error } = await sb.from('posts').insert({
      title: String(scritto.title).trim().slice(0, 140), content: testo, excerpt: primo.length > 220 ? primo.slice(0, 217) + '…' : primo,
      category: 'news_gd', source_type: 'gd_madonie', author: 'GD Madonie', status: 'draft', rubrica: 'settimana_ars',
      published_date: new Date().toISOString(), media_type: 'image', media: [],
    }).select('id, title').single();
    if (error) throw new Error(error.message);
    try {
      await sb.from('rubriche_notizie_usate').insert([...L.map((l: any) => ({ rubrica: 'settimana_ars', post_id: post.id, fonte_id: 'ars:' + l.id, luogo: 'Sicilia', titolo: l.titolo_breve || l.titolo || l.ddl, tema: null })),
        ...M.map((a: any) => ({ rubrica: 'settimana_ars', post_id: post.id, fonte_id: 'ars:' + a.k, luogo: (a.luoghi || [])[0] || 'Madonie', titolo: a.titolo, tema: null }))]);
    } catch { /* */ }
    try {
      await sb.from('execution_logs').insert({ run_date: new Date().toISOString(), total_found: L.length + M.length + R.length, total_added: 1, status: 'success', summary: `[Rubriche IA] bozza "${post.title}"`, details: [{ rubrica: 'settimana_ars', leggi: L.length, madonie: M.length, risposte: R.length, post_id: post.id }] });
    } catch { /* */ }
    return json({ ok: true, post, rubrica: 'settimana_ars', notizie: [...L.map((l: any) => 'Legge: ' + (l.titolo_breve || l.titolo)), ...M.map((a: any) => a.titolo)] });
  } catch (e) {
    try { await sb.from('execution_logs').insert({ run_date: new Date().toISOString(), total_found: 0, total_added: 0, status: 'error', summary: `[Rubriche IA] errore settimana ARS: ${(e as Error).message}`.slice(0, 500), details: [] }); } catch { /* */ }
    return json({ error: (e as Error).message }, 200);
  }
});
