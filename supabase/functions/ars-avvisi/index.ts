import { createClient } from 'npm:@supabase/supabase-js@2';
import { emailHtml, inviaEmail, SITE } from './email.ts';

// ---------------------------------------------------------------------------
// ars-avvisi — iscrizione agli "Avvisami" della sezione ARS (doppia conferma
// via email), conferma e cancellazione. Le email con le novita' le manda
// ars-import quando arrivano atti, risposte o leggi nuove.
//  POST { azione: 'iscrivi', email, chiave: 'paese:Blufi' | 'atto:I2743' | 'leggi' }
//  POST { azione: 'conferma' | 'annulla', token }
// ---------------------------------------------------------------------------

const LUOGHI = ['Madonie', 'Alimena', 'Aliminusa', 'Blufi', 'Bompietro', 'Caccamo', 'Caltavuturo', 'Castelbuono', 'Castellana Sicula', 'Cefalù', 'Collesano', 'Gangi', 'Geraci Siculo', 'Gratteri', 'Isnello', 'Montemaggiore Belsito', 'Petralia Soprana', 'Petralia Sottana', 'Polizzi Generosa', 'Pollina', 'San Mauro Castelverde', 'Scillato', 'Sclafani Bagni', 'Piano Battaglia', 'SS 120'];
const NOMI: Record<string, string> = { I: 'interrogazione', P: 'interpellanza', M: 'mozione', D: 'disegno di legge' };
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (d: unknown, status = 200) => Response.json(d, { status, headers: cors });

function descrivi(chiave: string) {
  if (chiave === 'leggi') return 'nuove leggi approvate dall\'ARS';
  if (chiave.startsWith('paese:')) { const p = chiave.slice(6); return p === 'Madonie' ? 'nuovi atti dell\'ARS sulle Madonie' : `nuovi atti dell'ARS su ${p}`; }
  if (chiave.startsWith('atto:')) { const k = chiave.slice(5); return `risposta del Governo a ${NOMI[k[0]] || 'un atto'} n. ${k.slice(1)}`; }
  return chiave;
}
async function sha(s: string) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join('').slice(0, 24);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST' }, 405);
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  let b: any = {};
  try { b = await req.json(); } catch { /* */ }

  if (b.azione === 'conferma' || b.azione === 'annulla') {
    const token = String(b.token || '');
    if (!/^[0-9a-f]{20,64}$/.test(token)) return json({ ok: false, error: 'link non valido' }, 400);
    const { data: i } = await sb.from('ars_iscrizioni').select('id, chiave').eq('token', token).maybeSingle();
    if (!i) return json({ ok: false, error: 'link non valido' }, 404);
    const conferma = b.azione === 'conferma';
    await sb.from('ars_iscrizioni').update({ confermata: conferma, confermata_at: conferma ? new Date().toISOString() : null }).eq('id', i.id);
    return json({ ok: true, cosa: descrivi(i.chiave) });
  }

  if (b.azione !== 'iscrivi') return json({ ok: false, error: 'azione non valida' }, 400);
  if (b.trappola) return json({ ok: true });
  const email = String(b.email || '').trim().toLowerCase();
  const chiave = String(b.chiave || '');
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email) || email.length > 120) return json({ ok: false, error: 'Scrivi un indirizzo email valido.' });
  let valida = chiave === 'leggi' || (chiave.startsWith('paese:') && LUOGHI.includes(chiave.slice(6)));
  if (!valida && /^atto:[IPMD]\d{1,5}$/.test(chiave)) {
    const { data } = await sb.from('ars_atti').select('k').eq('k', chiave.slice(5)).maybeSingle();
    valida = !!data;
  }
  if (!valida) return json({ ok: false, error: 'Avviso non valido.' });

  // limite: 5 iscrizioni l'ora per indirizzo IP, 3 email di conferma al giorno per indirizzo email
  const ip = req.headers.get('cf-connecting-ip') || (req.headers.get('x-forwarded-for') || '').split(',')[0].trim();
  const iph = ip ? await sha('gdm' + ip) : null;
  const { count } = await sb.from('ars_cerca_log').select('id', { count: 'exact', head: true }).eq('iph', iph || '-').like('domanda', 'avvisi:%').gte('at', new Date(Date.now() - 3600_000).toISOString());
  if ((count || 0) >= 5) return json({ ok: false, error: 'Troppe richieste: riprova tra un po\'.' });
  const { count: perEmail } = await sb.from('ars_cerca_log').select('id', { count: 'exact', head: true }).eq('domanda', 'avvisi:' + await sha(email)).gte('at', new Date(Date.now() - 86400_000).toISOString());
  if ((perEmail || 0) >= 3) return json({ ok: false, error: 'Ti abbiamo già mandato diverse email di conferma oggi: controlla la posta (anche lo spam).' });
  await sb.from('ars_cerca_log').insert({ iph, domanda: 'avvisi:' + await sha(email) });

  const { data: esiste } = await sb.from('ars_iscrizioni').select('id, token, confermata').eq('email', email).eq('chiave', chiave).maybeSingle();
  if (esiste?.confermata) return json({ ok: true, gia: true });
  let token = esiste?.token;
  if (!esiste) {
    const { data: nuova, error } = await sb.from('ars_iscrizioni').insert({ email, chiave }).select('token').single();
    if (error) return json({ ok: false, error: 'Non è stato possibile iscriverti. Riprova.' });
    token = nuova.token;
  }
  const cosa = descrivi(chiave);
  const ok = await inviaEmail(email, 'Conferma il tuo avviso dalla sezione ARS', emailHtml({
    eyebrow: 'Conferma', titolo: 'Confermi questo avviso?', testo: `Hai chiesto di ricevere un'email per: ${cosa}. Se non sei stato tu, ignora questo messaggio.`,
    righe: [], bottone: { label: 'Sì, avvisami', link: `${SITE}/ars/avvisi?conferma=${token}` },
  }));
  if (!ok) return json({ ok: false, error: 'Non riesco a mandare l\'email di conferma in questo momento. Riprova più tardi.' });
  return json({ ok: true });
});
