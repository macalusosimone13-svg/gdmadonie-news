import { createClient } from 'npm:@supabase/supabase-js@2';
import { AwsClient } from 'npm:aws4fetch@1';
import { copertinaPng } from './disegna.ts';

// ---------------------------------------------------------------------------
// pubblica-rubrica — pubblica DA SOLA una rubrica scritta dall'IA (22/11/2026).
// Simone: "deve fare il post in automatico senza che ci sia bisogno che io
// approvi". I job del lunedi' e del venerdi' alle 7 chiamano questa funzione,
// che fa scrivere la rubrica a rubriche-ai o ars-settimana e poi la pubblica.
// Il pulsante "genera adesso" del pannello continua invece a creare bozze da
// rivedere.
//
// Per ogni bozza:
//  1) controlli automatici al posto della rilettura: titolo con il nome della
//     rubrica, lunghezza giusta, nessuna voce "del circolo" (noi, chiediamo,
//     Giovani Democratici...), niente markdown o link. Se un controllo non
//     passa, la bozza RESTA BOZZA in Admin → Redazione → Rubriche IA e il
//     motivo finisce nel registro (execution_logs, "[Rubriche IA]").
//  2) copertina: la stessa grafica "solo titolo" del pannello (disegna.ts),
//     caricata su R2 come fa upload-image;
//  3) pubblicazione (status published, ora attuale);
//  4) email agli iscritti con notify-new-post, come quando pubblica Simone.
//
// Chiamate (auth CRON_SECRET o JWT admin):
//  - dai job pg_cron: POST { genera: { funzione: 'rubriche-ai'|'ars-settimana',
//    corpo: {...} } } → fa scrivere la rubrica (sempre con auto:true, quindi
//    solo alle 7 e senza doppioni) e, se la bozza nasce, la pubblica;
//  - a mano: POST { post_id } pubblica una bozza gia' scritta;
//  - POST { post_id, prova: true } fa i controlli e disegna la copertina, ma
//    non carica nulla e non pubblica: funziona anche su rubriche gia' uscite
//    (con carica: true carica la copertina su R2 e ne restituisce l'indirizzo).
// ---------------------------------------------------------------------------

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (d: unknown, status = 200) => Response.json(d, { status, headers: cors });
const SITO = 'https://www.gdmadonie-news.com';
const BUCKET = 'gdmadonie-images';

// inizio obbligatorio del titolo di ogni rubrica
const PREFISSI: Record<string, string[]> = {
  punto_paesi: ['Il punto sulle Madonie:'],
  punto_regionale: ['Il punto sulla Sicilia:'],
  punto_nazionale: ["Il punto sull'Italia:"],
  settimana_ars: ["La settimana all'ARS:"],
  dove_nasci_conta: ['Focus Madonie:'], // fino al 22/11/2026 "Dove nasci conta"
};

const apici = (s: string) => s.replace(/[’‘`´]/g, "'");
const parole = (s: string) => s.split(/\s+/).filter(Boolean).length;

export function controlla(post: { title: string; content: string; rubrica: string }) {
  const motivi: string[] = [];
  const titolo = apici(String(post.title || '').trim());
  const testo = apici(String(post.content || '').trim());
  const pref = PREFISSI[post.rubrica];
  if (!pref) motivi.push(`rubrica sconosciuta (${post.rubrica})`);
  else if (!pref.some((p) => titolo.toLowerCase().startsWith(p.toLowerCase()))) motivi.push(`il titolo non comincia con "${pref[0]}"`);
  if (titolo.length < 25 || titolo.length > 140) motivi.push(`titolo lungo ${titolo.length} caratteri`);
  const n = parole(testo);
  if (n < 180) motivi.push(`testo troppo corto (${n} parole)`);
  if (n > 1100) motivi.push(`testo troppo lungo (${n} parole)`);
  if (testo.split(/\n\s*\n/).filter((p) => p.trim()).length < 3) motivi.push('meno di tre paragrafi');
  // la frase finale "...nella sezione Paesi/ARS di GD Madonie News" e' prevista
  const tutto = (titolo + '\n' + testo).replace(/GD Madonie News/g, '');
  const vietate: [RegExp, string][] = [
    [/giovani democratici|\bGD\b/i, 'nomina i GD'],
    [/\b(noi|chiediamo|riteniamo|crediamo|proponiamo|auspichiamo|vogliamo|pensiamo)\b/i, 'parla in prima persona plurale'],
    [/\*\*|^#|`|\[[^\]]*\]\(|https?:\/\//m, 'contiene markdown o link'],
    [/[{}]|\b(undefined|null|NaN)\b/, 'contiene pezzi di codice'],
    [/\b(Leggi anche|Clicca qui|Fonte:)/i, 'contiene frasi di servizio'],
  ];
  for (const [re, m] of vietate) if (re.test(tutto)) motivi.push(m);
  return motivi;
}

async function caricaR2(png: Uint8Array) {
  const key = `uploads/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.png`;
  const endpoint = (Deno.env.get('R2_ENDPOINT') || '').replace(/\/$/, '');
  const client = new AwsClient({ accessKeyId: Deno.env.get('R2_ACCESS_KEY_ID')!, secretAccessKey: Deno.env.get('R2_SECRET_ACCESS_KEY')!, region: 'auto', service: 's3' });
  const firmata = await client.sign(`${endpoint}/${BUCKET}/${key}`, { method: 'PUT', headers: { 'Content-Type': 'image/png' }, body: png as unknown as BodyInit });
  const r = await fetch(firmata);
  if (!r.ok) throw new Error(`caricamento della copertina non riuscito (${r.status})`);
  return `${(Deno.env.get('R2_PUBLIC_URL') || '').replace(/\/$/, '')}/${key}`;
}

async function registro(sb: any, status: string, summary: string, details: unknown[] = []) {
  try { await sb.from('execution_logs').insert({ run_date: new Date().toISOString(), total_found: 1, total_added: status === 'success' ? 1 : 0, status, summary: summary.slice(0, 500), details }); } catch { /* */ }
}

// Pubblica una bozza di rubrica: controlli, copertina, pubblicazione, email.
async function pubblica(sb: any, id: string, prova: boolean, cron: string, carica = false) {
  const { data: post } = await sb.from('posts').select('id, title, content, rubrica, status, image_url').eq('id', id).maybeSingle();
  if (!post) return { error: 'Bozza non trovata' };
  if (!post.rubrica) return { error: 'Non e\' una rubrica' };
  if (post.status !== 'draft' && !prova) return { saltato: `gia' ${post.status}` };

  const motivi = controlla(post);
  if (motivi.length) {
    if (!prova) await registro(sb, 'partial', `[Rubriche IA] lasciata in bozza "${post.title}": ${motivi.join('; ')}`, [{ post_id: post.id, rubrica: post.rubrica, motivi }]);
    return { bozza: true, motivi };
  }

  try {
    if (prova) {
      const png = await copertinaPng(post.title);
      if (carica) return { prova: true, controlli: 'ok', copertina: await caricaR2(png) };
      return { prova: true, controlli: 'ok', copertina_byte: png.length };
    }
    let image = post.image_url as string | null;
    if (!image) image = await caricaR2(await copertinaPng(post.title));

    const media = [{ url: image, type: 'image', orientation: 'vertical' }];
    const { data: pubblicato, error } = await sb.from('posts')
      .update({ status: 'published', published_date: new Date().toISOString(), image_url: image, media_type: 'image', media_orientation: 'vertical', media })
      .eq('id', post.id).eq('status', 'draft').select('id, slug, title').maybeSingle();
    if (error) throw new Error(error.message);
    if (!pubblicato) return { saltato: 'la bozza e\' cambiata nel frattempo' };

    // email agli iscritti, come quando Simone pubblica dal pannello
    let email: unknown = null;
    try {
      const r = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/notify-new-post`, {
        method: 'POST', headers: { Authorization: `Bearer ${cron}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: post.id, app_url: SITO }), signal: AbortSignal.timeout(120000),
      });
      email = await r.json().catch(() => r.status);
    } catch (e) { email = 'non inviata: ' + (e as Error).message; }

    await registro(sb, 'success', `[Rubriche IA] pubblicata da sola "${post.title}"`, [{ post_id: post.id, rubrica: post.rubrica, link: `${SITO}/articolo/${pubblicato.slug || post.id}`, copertina: image, email }]);
    return { ok: true, post: pubblicato, copertina: image, email };
  } catch (e) {
    await registro(sb, 'error', `[Rubriche IA] non pubblicata, resta in bozza "${post.title}": ${(e as Error).message}`, [{ post_id: post.id, rubrica: post.rubrica }]);
    return { error: (e as Error).message, bozza: true };
  }
}

// funzioni che scrivono le rubriche, chiamate dai job con { genera: ... }
const AUTORI = new Set(['rubriche-ai', 'ars-settimana']);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const cron = (Deno.env.get('CRON_SECRET') || '').trim();
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
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

  // job automatico: prima fa scrivere la rubrica, poi la pubblica
  if (body?.genera) {
    const fn = String(body.genera.funzione || '');
    if (!AUTORI.has(fn)) return json({ error: 'funzione non ammessa' }, 400);
    let scritta: any;
    try {
      const r = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/${fn}`, {
        method: 'POST', headers: { Authorization: `Bearer ${cron}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...(body.genera.corpo || {}), auto: true }), signal: AbortSignal.timeout(300000),
      });
      scritta = await r.json().catch(() => ({ error: 'risposta non valida (' + r.status + ')' }));
    } catch (e) { scritta = { error: (e as Error).message }; }
    if (!scritta?.post?.id) return json({ scritta });
    return json({ scritta, pubblicazione: await pubblica(sb, scritta.post.id, false, cron) });
  }

  const out = await pubblica(sb, String(body?.post_id || ''), !!body?.prova, cron, !!body?.carica);
  return json(out, out.error === 'Bozza non trovata' ? 404 : 200);
});
