import { createClient } from 'npm:@supabase/supabase-js@2';

// ---------------------------------------------------------------------------
// rubriche-ai — le rubriche settimanali di News GD scritte dall'IA.
// Ogni articolo nasce come BOZZA (status 'draft', invisibile ai visitatori).
// Dal 22/11/2026 le bozze dei job automatici le pubblica subito la funzione
// pubblica-rubrica (controlli, copertina, email); quelle fatte con il pulsante
// del pannello Admin → Redazione → Rubriche IA restano da rileggere.
//
//  - "Il punto della settimana" (lunedi'): riassunto neutro delle 4-5 notizie
//    piu' importanti degli ultimi 7 giorni, in tre versioni:
//      ambito 'paesi'     → sezione Paesi (comuni delle Madonie)
//      ambito 'regionale' → Rassegna politica regionale + Rubrica Sicilia
//      ambito 'nazionale' → Rassegna politica nazionale
//  - "Focus Madonie" (venerdi'; fino al 22/11/2026 si chiamava "Dove nasci
//    conta", la chiave tipo 'dnc' / rubrica 'dove_nasci_conta' resta uguale):
//    l'IA guarda le notizie della settimana, sceglie il tema di cui si e'
//    parlato di piu' (sanita', scuola, trasporti...) e scrive un resoconto
//    neutro dei fatti su quel tema, paese per paese.
//  v3 (01/10/2026): niente commenti, "Perche' conta" o proposte del circolo.
//  v4 (05/10/2026): "Il punto" automatico saltato se ci sono poche notizie nuove.
//  v5 (10/10/2026): NIENTE DOPPIONI, mai. Ogni notizia usata in una rubrica
//    finisce nella tabella rubriche_notizie_usate e per 35 giorni non puo'
//    piu' essere usata da nessun'altra rubrica: cosi' il lunedi' e il venerdi'
//    hanno notizie diverse tra loro, e diverse di settimana in settimana.
//    Vale per i job automatici e per il pulsante manuale. Si scartano anche le
//    notizie con un titolo quasi uguale a una gia' usata (stesso paese, oppure
//    Sicilia e Italia insieme, perche' lo stesso fatto politico puo' stare in
//    tutte e due le rassegne), e all'IA si passa l'elenco dei fatti gia'
//    raccontati perche' non li riproponga nemmeno se arrivano da un altro
//    giornale. "Focus Madonie" non ripete il tema delle ultime due puntate.
//    Se le notizie nuove non bastano, la bozza NON viene creata: meglio nessuna
//    rubrica che una rubrica doppione. Se una bozza viene cancellata, le sue
//    notizie tornano disponibili.
//  v7-8 (16/10/2026): Gemini sovraccarico (503/429/500). Si riprova con attese
//    piu' lunghe e alternando il modello principale con due modelli di riserva
//    della stessa fascia economica; se non va comunque, l'errore mostrato nel
//    pannello e' una frase in italiano, non il JSON di Google.
//  v11 (22/11/2026): "Dove nasci conta" diventa "Focus Madonie".
//
// Chiamata: POST { tipo: 'punto' | 'dnc', ambito?: 'paesi'|'regionale'|'nazionale', auto?: true, prova?: true }
// Auth: CRON_SECRET (job automatici) oppure JWT di un admin.
// Con auto:true (dai job) lavora solo alle 7 ora italiana e non crea doppioni
// se la stessa rubrica e' gia' stata generata nelle ultime 20 ore.
// Con prova:true fa tutto tranne salvare: serve a vedere cosa sceglierebbe.
// ---------------------------------------------------------------------------

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!;
const GEMINI_MODEL = 'gemini-3.1-flash-lite';
const GEMINI_RISERVE = ['gemini-3.5-flash-lite', 'gemini-flash-lite-latest'];
const GIORNI = 7;
const GIORNI_MEMORIA = 35;
const NOME_FOCUS = 'Focus Madonie';

class Saltata extends Error {}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (d: unknown, status = 200) => Response.json(d, { status, headers: cors });

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const giornoIt = (d: Date) => {
  const p = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', day: 'numeric', month: 'numeric', year: 'numeric' }).formatToParts(d);
  const g = p.find((x) => x.type === 'day')!.value, m = Number(p.find((x) => x.type === 'month')!.value);
  return `${g} ${MESI[m - 1]}`;
};
const oraRoma = () => Number(new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', hour12: false }).format(new Date()));
const pulisci = (s: unknown, n = 99999) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

// --------------------------------- Gemini ---------------------------------
function estraiJson(t: string) {
  let s = t.trim();
  const f = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (f) s = f[1].trim();
  return JSON.parse(s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1));
}
const dorme = (ms: number) => new Promise((ok) => setTimeout(ok, ms));
// modello e attesa prima del tentativo: si alternano il principale e le riserve
const TENTATIVI: [string, number][] = [[GEMINI_MODEL, 0], [GEMINI_MODEL, 4000], [GEMINI_RISERVE[0], 1500], [GEMINI_RISERVE[1], 3000], [GEMINI_MODEL, 6000], [GEMINI_RISERVE[0], 6000]];
async function gemini(system: string, testo: string, temperature = 0.4) {
  let ultimo = '';
  for (const [model, attesa] of TENTATIVI) {
    if (attesa) await dorme(attesa);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
    let r: Response;
    try {
      r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: testo }] }],
          generationConfig: { responseMimeType: 'application/json', temperature },
        }),
        signal: AbortSignal.timeout(45000),
      });
    } catch (e) {
      ultimo = `${model}: ${(e as Error).message}`;
      continue;
    }
    if (r.ok) {
      const d = await r.json();
      return estraiJson((d.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text || '').join('\n'));
    }
    const err = await r.text();
    ultimo = `${model}: ${r.status}`;
    // sovraccarico o errore temporaneo: si riprova; una riserva puo' anche non essere disponibile (404)
    if ([429, 500, 503].includes(r.status) || (model !== GEMINI_MODEL && r.status === 404)) { console.warn('Gemini', ultimo, err.slice(0, 200)); continue; }
    throw new Error('Gemini ' + r.status + ' ' + err.slice(0, 200));
  }
  throw new Error(`L'IA di Google (Gemini) e' sovraccarica in questo momento: ho riprovato 6 volte, anche con due modelli di riserva. Di solito passa in pochi minuti, riprova piu' tardi. [${ultimo}]`);
}

// ------------------------------ regole di scrittura ------------------------
// v3 (01/10): su richiesta di Simone niente piu' commenti o proposte "del
// circolo": entrambe le rubriche sono resoconti neutri dei fatti della settimana.
const REGOLE_REDAZIONE = `Scrivi per "News GD", la sezione notizie del sito GD Madonie News. Sei un redattore di cronaca politica e amministrativa.

REGOLE FERREE:
1. Voce giornalistica neutra, in terza persona. NESSUN commento, giudizio, opinione, auspicio, richiesta o proposta. Niente prima persona plurale ("chiediamo", "riteniamo", "noi"). Non nominare mai i Giovani Democratici o GD Madonie.
2. Non inventare MAI fatti, numeri, nomi, date, cifre o dichiarazioni che non siano nel materiale fornito. Se un dato manca, non aggiungerlo.
3. Niente frasi di contorno o di valutazione ("e' fondamentale", "e' importante", "segna un passo", "resta da vedere", "una notizia positiva"): solo fatti.
4. Riporta cifre, date, nomi, luoghi e scadenze presenti nel materiale.
5. Niente hashtag, emoji, grassetti, elenchi puntati con simboli, markdown.
6. Non citare il nome dei giornali da cui arrivano le notizie.
7. Italiano semplice e diretto, frasi brevi, paragrafi separati da una riga vuota (\\n\\n).`;

// ------------------------------- raccolta notizie --------------------------
// fid = identificativo completo della notizia di partenza, usato dalla memoria
type Notizia = { id: string; fid: string; data: string; luogo: string; titolo: string; breve: string; testo: string };

async function notizie(sb: any, ambito: string): Promise<Notizia[]> {
  const da = new Date(Date.now() - GIORNI * 86400000).toISOString();
  if (ambito === 'paesi') {
    const [{ data: n }, { data: c }] = await Promise.all([
      sb.from('comuni_notizie').select('id, comune_slug, titolo, riassunto, tema, published_date').eq('stato', 'pubblicata').not('riassunto', 'is', null).gte('published_date', da).order('published_date', { ascending: false }).limit(150),
      sb.from('comuni').select('slug, nome'),
    ]);
    const nomi = new Map((c || []).map((x: any) => [x.slug, x.nome]));
    return (n || []).map((x: any) => ({ id: 'P' + x.id.slice(0, 8), fid: 'paesi:' + x.id, data: String(x.published_date).slice(0, 10), luogo: nomi.get(x.comune_slug) || x.comune_slug, titolo: x.titolo, breve: `[${x.tema || ''}] ${pulisci(x.riassunto, 300)}`, testo: pulisci(x.riassunto) }));
  }
  const cat = ambito === 'regionale' ? 'politica_regionale' : 'politica_nazionale';
  const { data: p } = await sb.from('posts').select('id, title, excerpt, content, published_date').eq('source_type', 'rassegna').eq('status', 'published').eq('category', cat).gte('published_date', da).order('published_date', { ascending: false }).limit(ambito === 'regionale' ? 300 : 400);
  const out: Notizia[] = (p || []).map((x: any) => ({ id: 'R' + x.id.slice(0, 8), fid: 'posts:' + x.id, data: String(x.published_date).slice(0, 10), luogo: ambito === 'regionale' ? 'Sicilia' : 'Italia', titolo: pulisci(x.title, 200), breve: pulisci(x.excerpt, 160), testo: pulisci(x.content || x.excerpt, 6000) }));
  if (ambito === 'regionale') {
    const { data: w } = await sb.from('sicilia_watch').select('id, title, excerpt, content, published_date').gte('published_date', da).order('published_date', { ascending: false }).limit(200);
    for (const x of w || []) out.push({ id: 'W' + x.id.slice(0, 8), fid: 'watch:' + x.id, data: String(x.published_date).slice(0, 10), luogo: 'Sicilia', titolo: pulisci(x.title, 200), breve: pulisci(x.excerpt, 160), testo: pulisci(x.content || x.excerpt, 6000) });
  }
  return out;
}

const elencoBreve = (l: Notizia[]) => l.map((n) => `${n.id} | ${n.data} | ${n.luogo} | ${n.titolo}${n.breve ? ' — ' + n.breve : ''}`).join('\n');
const elencoPieno = (l: Notizia[]) => l.map((n) => `### ${n.luogo} — ${n.data}\nTitolo: ${n.titolo}\nTesto: ${n.testo || n.breve || '(solo titolo)'}`).join('\n\n');

// ------------------------- memoria: niente doppioni -------------------------
const VUOTE = new Set(['della', 'delle', 'dello', 'degli', 'dalla', 'dalle', 'nella', 'nelle', 'sulla', 'sulle', 'alla', 'alle', 'con', 'per', 'dopo', 'dai', 'dei', 'del', 'che', 'una', 'uno', 'gli', 'tra', 'fra', 'sono', 'come', 'anche', 'piu', 'via', 'ecco', 'ora', 'sul', 'sui', 'nel', 'nei', 'dal', 'all', 'non', 'suo', 'sua', 'the']);
const norm = (s: unknown) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const parole = (s: unknown) => new Set(norm(s).split(' ').filter((w) => w.length > 2 && !VUOTE.has(w)));
// Sicilia e Italia si confrontano insieme (lo stesso fatto politico puo' stare in
// tutte e due le rassegne); i paesi solo con lo stesso paese (lo stesso bando in
// due comuni diversi sono due notizie diverse).
const politica = (l: string) => l === 'Sicilia' || l === 'Italia';
const gruppo = (l: string) => (politica(l) ? 'politica' : l);
// due titoli "quasi uguali": hanno in comune la gran parte delle parole che contano
function simili(a: Set<string>, b: Set<string>) {
  if (a.size < 3 || b.size < 3) return false;
  let comuni = 0;
  for (const w of a) if (b.has(w)) comuni++;
  const min = Math.min(a.size, b.size), unione = a.size + b.size - comuni;
  return comuni / unione >= 0.6 || (min >= 4 && comuni / min >= 0.8);
}

type Voce = { rubrica: string; luogo: string; titolo: string; n: string; p: Set<string> };
type Memoria = { ids: Set<string>; voci: Voce[]; temi: string[] };

// tutto quello che le rubriche hanno gia' usato negli ultimi 35 giorni
async function memoria(sb: any): Promise<Memoria> {
  const da = new Date(Date.now() - GIORNI_MEMORIA * 86400000).toISOString();
  const { data, error } = await sb.from('rubriche_notizie_usate').select('rubrica, fonte_id, luogo, titolo, tema, used_at').gte('used_at', da).order('used_at', { ascending: false }).limit(3000);
  if (error) throw new Error('Non riesco a leggere la memoria delle rubriche: ' + error.message);
  const ids = new Set<string>(), voci: Voce[] = [], temi: string[] = [];
  for (const r of data || []) {
    if (r.fonte_id) ids.add(String(r.fonte_id));
    voci.push({ rubrica: r.rubrica, luogo: String(r.luogo || ''), titolo: String(r.titolo || ''), n: norm(r.titolo), p: parole(r.titolo) });
    if (r.rubrica === 'dove_nasci_conta' && r.tema && !temi.includes(r.tema)) temi.push(r.tema);
  }
  return { ids, voci, temi };
}

function giaUsata(x: Notizia, m: Memoria) {
  if (m.ids.has(x.fid)) return true;
  const n = norm(x.titolo), p = parole(x.titolo), g = gruppo(x.luogo);
  return m.voci.some((u) => gruppo(u.luogo) === g && (u.n === n || simili(u.p, p)));
}

// toglie dalla scelta dell'IA le notizie che si ripetono tra loro (titolo quasi uguale)
function senzaRipetizioni(l: Notizia[]) {
  const out: Notizia[] = [];
  for (const x of l) {
    const p = parole(x.titolo);
    if (!out.some((y) => y.fid === x.fid || (gruppo(y.luogo) === gruppo(x.luogo) && simili(parole(y.titolo), p)))) out.push(x);
  }
  return out;
}

// elenco per l'IA dei fatti gia' raccontati, perche' non li riproponga con altre parole
function giaRaccontati(m: Memoria, luoghi: (l: string) => boolean) {
  const visti = new Set<string>(), righe: string[] = [];
  for (const u of m.voci) {
    if (!luoghi(u.luogo) || visti.has(u.luogo + '|' + u.n)) continue;
    visti.add(u.luogo + '|' + u.n);
    righe.push(`- ${u.luogo}: ${u.titolo}`);
    if (righe.length >= 70) break;
  }
  if (!righe.length) return '';
  return `\n\nFATTI GIA' RACCONTATI nelle rubriche delle ultime settimane. NON sceglierli di nuovo: una notizia che racconta uno di questi fatti va scartata anche se arriva da un altro giornale, ha un titolo diverso o aggiunge solo commenti e reazioni. E' ammessa solo se riporta uno sviluppo nuovo e concreto (un voto, una decisione, una cifra, una data che prima non c'erano).\n${righe.join('\n')}`;
}

// troppo poche notizie nuove: nei job la bozza si salta in silenzio, dal pulsante si spiega perche'
function pochi(auto: boolean, msg: string): never {
  if (auto) throw new Saltata(msg);
  throw new Error(msg + ' Se vuoi rifare una bozza gia\' creata, prima cancellala: le sue notizie tornano disponibili.');
}

// ---------------------------------- Il punto -------------------------------
const NOME_AMBITO: Record<string, string> = { paesi: 'Madonie', regionale: 'Sicilia', nazionale: 'Italia' };

async function ilPunto(sb: any, ambito: string, auto: boolean, mem: Memoria) {
  const raccolte = await notizie(sb, ambito);
  const soglia = ambito === 'paesi' ? 2 : 3;
  // via tutto quello che una rubrica (questa o un'altra) ha gia' usato
  const tutte = raccolte.filter((n) => !giaUsata(n, mem));
  if (tutte.length < soglia) pochi(auto, `Il punto ${NOME_AMBITO[ambito]}: su ${raccolte.length} notizie della settimana solo ${tutte.length} non sono gia' state usate nelle rubriche (ne servono almeno ${soglia}). Bozza non creata.`);

  // 1) scelta delle notizie (solo titoli e poche righe: costa poco)
  const criteri = ambito === 'paesi'
    ? 'Preferisci decisioni politiche e amministrative con effetti concreti per i cittadini (consigli comunali, bilanci, fondi ottenuti, opere, servizi, scuola, sanita\', elezioni). Scegli paesi DIVERSI tra loro. Evita avvisi di routine (nomine tecniche, concorsi interni, avvisi di gara minori, semplici convocazioni).'
    : ambito === 'regionale'
      ? 'Preferisci i fatti politici piu\' importanti della settimana in Sicilia (ARS, governo regionale, manovre e leggi, sanita\', trasporti, acqua, lavoro), in particolare quelli che toccano le aree interne e le Madonie. Scarta cronaca nera, fatti che riguardano una sola citta\' senza rilievo regionale, e i fatti di politica nazionale che non riguardano la Sicilia.'
      : 'Preferisci i fatti politici nazionali piu\' importanti della settimana (governo, Parlamento, leggi, manovra, lavoro, scuola, sanita\', diritti) e quelli che hanno effetti sul Sud e sulle aree interne. Scarta cronaca, gossip politico, notizie locali o di una sola regione o citta\', nomine di sindacati e associazioni, turismo e costume: se non e\' un fatto politico nazionale non sceglierlo.';
  const stessoAmbito = ambito === 'paesi' ? (l: string) => !politica(l) : politica;
  const scelta = await gemini(
    `Sei il caporedattore di GD Madonie News. Ti do l'elenco delle notizie della settimana, una per riga, con un codice all'inizio. Scegli fino a 8 notizie, le piu' importanti per "Il punto della settimana" (${NOME_AMBITO[ambito]}), in ordine di importanza (la piu' importante per prima). ${criteri} Se piu' righe raccontano lo stesso fatto, scegline una sola. Se le notizie davvero nuove e adatte sono poche, scegline poche: meglio una rubrica corta che una notizia gia' raccontata o fuori tema. Rispondi SOLO con JSON {"codici": ["...", "..."]}.`,
    elencoBreve(tutte) + giaRaccontati(mem, stessoAmbito), 0.2,
  );
  const codici: string[] = Array.isArray(scelta?.codici) ? scelta.codici.map(String) : [];
  const candidate = senzaRipetizioni(codici.map((c) => tutte.find((n) => n.id === c)).filter(Boolean) as Notizia[]);
  // per i paesi: un paese diverso per ogni notizia (se possibile)
  let scelte: Notizia[] = [];
  if (ambito === 'paesi') {
    const visti = new Set<string>();
    for (const n of candidate) if (!visti.has(n.luogo) && scelte.length < 5) { visti.add(n.luogo); scelte.push(n); }
    for (const n of candidate) if (scelte.length < 4 && !scelte.includes(n)) scelte.push(n);
  } else scelte = candidate.slice(0, 5);
  if (scelte.length < soglia) pochi(auto, `Il punto ${NOME_AMBITO[ambito]}: tolti i fatti gia' raccontati restano solo ${scelte.length} notizie nuove (ne servono almeno ${soglia}). Bozza non creata.`);

  // 2) scrittura
  const oggi = new Date(), inizio = new Date(Date.now() - GIORNI * 86400000);
  const periodo = `dal ${giornoIt(inizio)} al ${giornoIt(oggi)}`;
  const scritto = await gemini(
    `${REGOLE_REDAZIONE}

COMPITO: scrivi "Il punto della settimana" (${NOME_AMBITO[ambito]}, ${periodo}): un riassunto delle notizie piu' importanti della settimana, usando SOLO le notizie fornite, tutte e nello stesso ordine.
STRUTTURA del campo "body":
- Un paragrafo di apertura di 2-3 frasi che riassuma di cosa si e' parlato questa settimana${ambito === 'paesi' ? ' nei paesi delle Madonie' : ''}, citando i fatti principali.
- Poi un paragrafo per ogni notizia, fatto cosi' (con gli a capo esatti):
  prima riga: ${ambito === 'paesi' ? 'il nome del paese, un trattino e un titoletto di poche parole (es. "Petralia Sottana – Il rendiconto va al commissario")' : 'un titoletto di poche parole'}
  a capo, poi 3-5 frasi con i fatti: chi, cosa, quando, dove, cifre, date e prossimi passaggi se presenti nel materiale.
- Nessun paragrafo di commento finale.${ambito === 'paesi' ? ' Chiudi con una sola frase: "Tutte le notizie, paese per paese, sono nella sezione Paesi di GD Madonie News."' : ''}
Lunghezza totale: ${scelte.length >= 4 ? '400-700' : '250-450'} parole.
TITOLO: max 95 caratteri, informativo e neutro, inizia con "Il punto${ambito === 'paesi' ? ' sulle Madonie' : ambito === 'regionale' ? ' sulla Sicilia' : ' sull\'Italia'}:" seguito dai due fatti piu' importanti${ambito === 'paesi' ? ', con il nome dei paesi' : ''}.
Rispondi SOLO con JSON {"title": "...", "body": "..."}.`,
    `Notizie della settimana (${periodo}):\n\n${elencoPieno(scelte)}`, 0.4,
  );
  if (!scritto?.title || !scritto?.body) throw new Error('Risposta dell\'IA incompleta, riprova.');
  return { title: pulisci(scritto.title, 140), body: String(scritto.body).trim(), scelte, usate: scelte.map((n) => `${n.luogo}: ${n.titolo}`), tema: null as string | null };
}

// ------------------------------ Focus Madonie -------------------------------
const TEMI_DNC = ['Sanità', 'Scuola', 'Trasporti e strade', 'Acqua e servizi essenziali', 'Lavoro e giovani', 'Connessione digitale', 'Spopolamento e casa', 'Servizi sociali e anziani', 'Ambiente e territorio', 'Fondi e investimenti pubblici'];

async function doveNasciConta(sb: any, auto: boolean, mem: Memoria) {
  const [paesiTutte, siciliaTutte] = await Promise.all([notizie(sb, 'paesi'), notizie(sb, 'regionale')]);
  // via tutto quello che "Il punto" del lunedi' e le puntate precedenti hanno gia' usato
  const paesi = paesiTutte.filter((n) => !giaUsata(n, mem));
  const sicilia = siciliaTutte.filter((n) => !giaUsata(n, mem));
  const tutte = [...paesi, ...sicilia.slice(0, 180)];
  if (tutte.length < 5) pochi(auto, `${NOME_FOCUS}: su ${paesiTutte.length + siciliaTutte.length} notizie della settimana solo ${tutte.length} non sono gia' state usate nelle rubriche (ne servono almeno 5). Bozza non creata.`);

  // il tema non si ripete: fuori quelli delle ultime due puntate
  const temiFuori = mem.temi.slice(0, 2);
  const temiOk = TEMI_DNC.filter((t) => !temiFuori.includes(t));

  // 1) tema della settimana: quello di cui si e' parlato di piu'
  const scelta = await gemini(
    `Sei il caporedattore di GD Madonie News e curi la rubrica settimanale "${NOME_FOCUS}", un approfondimento sul tema di cui si e' parlato di piu' nella settimana nelle Madonie e in Sicilia. Ti do le notizie della settimana (righe con codice P = paesi delle Madonie, R/W = Sicilia). Conta quante notizie riguardano ciascuno di questi temi: ${temiOk.join(', ')}. Scegli il tema con PIU' notizie (a parita', quello con piu' notizie dei paesi delle Madonie).${temiFuori.length ? ` NON scegliere questi temi, gia' trattati nelle ultime puntate: ${temiFuori.join(', ')}.` : ''} Poi scegli da 3 a 8 notizie su quel tema, mettendo prima quelle dei paesi delle Madonie. Se piu' righe raccontano lo stesso fatto, scegline una sola. Se nessun tema ha almeno 3 notizie davvero nuove, rispondi con {"tema": "", "codici": []}. Rispondi SOLO con JSON {"tema": "...", "codici": ["..."]}.`,
    elencoBreve(tutte) + giaRaccontati(mem, (l) => l !== 'Italia'), 0.2,
  );
  const codici: string[] = Array.isArray(scelta?.codici) ? scelta.codici.map(String) : [];
  const scelte = senzaRipetizioni(codici.map((c) => tutte.find((n) => n.id === c)).filter(Boolean) as Notizia[]).slice(0, 8);
  const tema = TEMI_DNC.includes(scelta?.tema) ? scelta.tema : pulisci(scelta?.tema, 40);
  if (!tema || scelte.length < 3) pochi(auto, `${NOME_FOCUS}: questa settimana nessun tema nuovo ha almeno 3 notizie non ancora raccontate (trovate ${scelte.length}). Bozza non creata.`);
  if (temiFuori.includes(tema)) pochi(auto, `${NOME_FOCUS}: l'unico tema con abbastanza notizie e' "${tema}", gia' trattato nelle ultime puntate. Bozza non creata.`);

  // 2) scrittura: resoconto neutro dei fatti sul tema
  const scritto = await gemini(
    `${REGOLE_REDAZIONE}

COMPITO: scrivi la puntata settimanale di "${NOME_FOCUS}": un articolo che racconta tutto quello che e' successo questa settimana sul tema "${tema}", nelle Madonie e in Sicilia, usando SOLO le notizie fornite.
STRUTTURA del campo "body" (paragrafi separati da una riga vuota, niente titoletti):
1. Apertura: 2-3 frasi che dicono di cosa si e' parlato questa settimana su questo tema, partendo dal fatto piu' concreto.
2. I fatti: un paragrafo per ogni notizia o gruppo di notizie collegate, prima quelle dei paesi delle Madonie (nominando il paese) e poi quelle regionali, con tutte le cifre, date, nomi e scadenze presenti nel materiale.
3. Chiusura: 1-2 frasi che riepilogano i prossimi passaggi o le scadenze citate nelle notizie. Se nel materiale non ce ne sono, chiudi riassumendo i fatti principali. Nessun commento.
Lunghezza totale: ${scelte.length >= 5 ? '500-800' : '300-500'} parole.
TITOLO: max 95 caratteri, informativo e neutro, inizia con "${NOME_FOCUS}:" e nomina il tema${paesi.length ? ' e, se possibile, un paese' : ''}.
Rispondi SOLO con JSON {"title": "...", "body": "..."}.`,
    `Tema: ${tema}\n\nNotizie della settimana sul tema:\n\n${elencoPieno(scelte)}`, 0.3,
  );
  if (!scritto?.title || !scritto?.body) throw new Error('Risposta dell\'IA incompleta, riprova.');
  return { title: pulisci(scritto.title, 140), body: String(scritto.body).trim(), scelte, usate: scelte.map((n) => `${n.luogo}: ${n.titolo}`), tema: tema as string | null };
}

// ------------------------------------ main ----------------------------------
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
    const tipo = body?.tipo === 'dnc' ? 'dnc' : 'punto';
    const ambito = ['paesi', 'regionale', 'nazionale'].includes(body?.ambito) ? body.ambito : 'paesi';
    const rubrica = tipo === 'dnc' ? 'dove_nasci_conta' : `punto_${ambito}`;
    const auto = !!body?.auto, prova = !!body?.prova;

    if (auto && !prova) {
      // i job girano alle 5 e alle 6 UTC: si lavora solo quando in Italia sono le 7
      if (oraRoma() !== 7) return json({ saltato: 'non sono le 7 in Italia' });
      const { count } = await sb.from('posts').select('id', { count: 'exact', head: true }).eq('rubrica', rubrica).gte('created_at', new Date(Date.now() - 20 * 3600000).toISOString());
      if ((count || 0) > 0) return json({ saltato: 'gia\' generato oggi' });
    }

    const mem = await memoria(sb);
    const out = tipo === 'dnc' ? await doveNasciConta(sb, auto, mem) : await ilPunto(sb, ambito, auto, mem);
    const testo = out.body.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n');
    if (prova) return json({ prova: true, rubrica, title: out.title, tema: out.tema, notizie: out.usate, inizio: testo.slice(0, 500) });

    const primo = testo.split(/\n\s*\n/)[0] || testo;
    const { data: post, error } = await sb.from('posts').insert({
      title: out.title,
      content: testo,
      excerpt: primo.length > 220 ? primo.slice(0, 217) + '…' : primo,
      category: 'news_gd',
      source_type: 'gd_madonie',
      author: 'GD Madonie',
      status: 'draft',
      rubrica,
      published_date: new Date().toISOString(),
      media_type: 'image',
      media: [],
    }).select('id, title').single();
    if (error) throw new Error(error.message);

    // memoria: da adesso queste notizie non possono piu' uscire in un'altra rubrica
    const { error: errMem } = await sb.from('rubriche_notizie_usate').insert(out.scelte.map((n) => ({ rubrica, post_id: post.id, fonte_id: n.fid, luogo: n.luogo, titolo: n.titolo, tema: out.tema })));
    if (errMem) console.error('memoria rubriche non salvata', errMem.message);

    try {
      await sb.from('execution_logs').insert({
        run_date: new Date().toISOString(), total_found: out.usate.length, total_added: 1, status: errMem ? 'partial' : 'success',
        summary: `[Rubriche IA] bozza "${out.title}"`, details: [{ rubrica, notizie: out.usate, tema: out.tema || null, post_id: post.id, memoria: errMem ? 'non salvata: ' + errMem.message : 'ok' }],
      });
    } catch { /* */ }
    return json({ ok: true, post, rubrica, notizie: out.usate, tema: out.tema || null });
  } catch (e) {
    if (e instanceof Saltata) {
      try {
        await sb.from('execution_logs').insert({ run_date: new Date().toISOString(), total_found: 0, total_added: 0, status: 'success', summary: `[Rubriche IA] saltata: ${e.message}`.slice(0, 500), details: [] });
      } catch { /* */ }
      return json({ saltato: e.message });
    }
    console.error(e);
    try {
      await sb.from('execution_logs').insert({ run_date: new Date().toISOString(), total_found: 0, total_added: 0, status: 'error', summary: `[Rubriche IA] errore: ${(e as Error).message}`.slice(0, 500), details: [] });
    } catch { /* */ }
    return json({ error: (e as Error).message }, 200);
  }
});
