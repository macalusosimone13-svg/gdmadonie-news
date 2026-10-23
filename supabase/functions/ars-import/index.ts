import { createClient } from 'npm:@supabase/supabase-js@2';
import { createRemoteJWKSet, jwtVerify } from 'npm:jose@5';
import { emailHtml, inviaEmail, SITE } from './email.ts';

// ---------------------------------------------------------------------------
// ars-import — riceve dall'aggiornamento automatico (GitHub Actions, ogni 30
// minuti) gli atti, le leggi, le sedute e le convocazioni letti dal sito
// dell'ARS e li scrive nel database con ars_import(). Poi manda gli "Avvisami":
//  - paese:<Nome>  → un nuovo atto dell'ARS nomina il paese
//  - atto:<k>      → il Governo ha risposto a quell'atto
//  - leggi         → l'ARS ha approvato una nuova legge
// Accesso: token OIDC di GitHub Actions (solo il workflow ars-aggiorna.yml del
// repository del sito, nessun segreto da custodire) oppure header x-ars-secret
// = ars_config.import_secret (per i caricamenti fatti a mano).
// POST { tabella: 'atti'|'leggi'|'sedute'|'convocazioni'|'deputati'|'meta'|'convocazioni_tolte'|'sedute_tolte', righe: [...], silenzioso?: true }
// POST { fine: true, riepilogo: {...} } → scrive l'ultimo controllo e il log.
// ---------------------------------------------------------------------------

const REPO = 'macalusosimone13-svg/gdmadonie-news';
const GITHUB_JWKS = createRemoteJWKSet(new URL('https://token.actions.githubusercontent.com/.well-known/jwks'));
async function daGithub(req: Request) {
  const tok = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!tok || tok.split('.').length !== 3) return false;
  try {
    const { payload } = await jwtVerify(tok, GITHUB_JWKS, { issuer: 'https://token.actions.githubusercontent.com', audience: 'ars-import' });
    return payload.repository === REPO && String(payload.workflow_ref || '').startsWith(`${REPO}/.github/workflows/ars-aggiorna.yml@`);
  } catch (e) {
    console.error('[oidc]', (e as Error).message);
    return false;
  }
}
const MADONIE = new Set(['Madonie', 'Alimena', 'Aliminusa', 'Blufi', 'Bompietro', 'Caccamo', 'Caltavuturo', 'Castelbuono', 'Castellana Sicula', 'Cefalù', 'Collesano', 'Gangi', 'Geraci Siculo', 'Gratteri', 'Isnello', 'Montemaggiore Belsito', 'Petralia Soprana', 'Petralia Sottana', 'Polizzi Generosa', 'Pollina', 'San Mauro Castelverde', 'Scillato', 'Sclafani Bagni', 'Piano Battaglia', 'Piano Zucchi', 'Gibilmanna', 'Parco delle Madonie', 'SS 120', 'SS 643', 'SS 286']);
const SLUG_TIPO: Record<string, string> = { I: 'interrogazione', P: 'interpellanza', M: 'mozione', D: 'ddl' };
const linkAtto = (k: string) => `${SITE}/ars/atto/${SLUG_TIPO[k[0]] || 'atto'}-${k.slice(1)}`;
const linkLegge = (id: string) => `${SITE}/ars/legge/${id.toLowerCase()}`;

const json = (d: unknown, status = 200) => Response.json(d, { status });
const TIPI: Record<string, string> = { I: 'Interrogazione', P: 'Interpellanza', M: 'Mozione', D: 'Disegno di legge' };
const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const dataIt = (d: string | null) => { const m = /^(\d{4})-(\d\d)-(\d\d)/.exec(d || ''); return m ? `${+m[3]} ${MESI[+m[2] - 1]} ${m[1]}` : ''; };

async function notifica(sb: any, chiave: string, rif: (x: any) => string, voci: any[], crea: (voci: any[]) => { subject: string; html: (annulla: string) => string }) {
  if (!voci.length) return 0;
  const { data: isc } = await sb.from('ars_iscrizioni').select('id, email, token').eq('chiave', chiave).eq('confermata', true);
  let inviate = 0;
  for (const i of isc || []) {
    const { data: gia } = await sb.from('ars_notifiche').select('rif').eq('iscrizione_id', i.id).in('rif', voci.map(rif));
    const visti = new Set((gia || []).map((g: any) => g.rif));
    const nuove = voci.filter((v) => !visti.has(rif(v)));
    if (!nuove.length) continue;
    const m = crea(nuove);
    const ok = await inviaEmail(i.email, m.subject, m.html(`${SITE}/ars/avvisi?annulla=${i.token}`));
    if (ok) {
      inviate++;
      await sb.from('ars_notifiche').insert(nuove.map((v) => ({ iscrizione_id: i.id, rif: rif(v) })));
    }
  }
  return inviate;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST' }, 405);
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  let ok = await daGithub(req);
  if (!ok) {
    const { data: cfg } = await sb.from('ars_config').select('valore').eq('chiave', 'import_secret').single();
    const segreto = req.headers.get('x-ars-secret') || '';
    ok = !!cfg?.valore && segreto === cfg.valore;
  }
  if (!ok) return json({ error: 'Non autorizzato' }, 403);

  let body: any = {};
  try { body = await req.json(); } catch { return json({ error: 'JSON non valido' }, 400); }

  if (body.fine) {
    const r = body.riepilogo || {};
    await sb.rpc('ars_import', { tabella: 'meta', righe: { ultimo_controllo: { at: new Date().toISOString(), ...r } } });
    try {
      await sb.from('execution_logs').insert({
        run_date: new Date().toISOString(), total_found: Number(r.atti_cambiati || 0), total_added: Number(r.atti_nuovi || 0),
        status: r.errori?.length ? 'partial' : 'success',
        summary: `[ARS] ${r.atti_nuovi || 0} atti nuovi, ${r.atti_cambiati || 0} aggiornati, ${r.leggi_cambiate || 0} leggi, ${r.sedute_nuove || 0} sedute nuove`.slice(0, 500),
        details: [r],
      });
    } catch { /* */ }
    return json({ ok: true });
  }

  const tabella = String(body.tabella || '');
  const righe = Array.isArray(body.righe) || (tabella === 'meta' && body.righe && typeof body.righe === 'object') ? body.righe : null;
  if (!righe) return json({ error: 'righe mancanti' }, 400);
  const { data, error } = await sb.rpc('ars_import', { tabella, righe });
  if (error) return json({ error: error.message }, 500);

  const avvisi: Record<string, number> = {};
  try {
    if (body.silenzioso) { /* caricamento iniziale: nessun avviso */ }
    else if (tabella === 'atti' && (data.nuovi.length || data.risposte.length)) {
      const chiavi = [...new Set([...data.nuovi, ...data.risposte])];
      const { data: atti } = await sb.from('ars_atti').select('k, tipo, n, titolo, data, luoghi').in('k', chiavi);
      const byK = new Map((atti || []).map((a: any) => [a.k, a]));
      // paesi nominati dai nuovi atti
      const perPaese = new Map<string, any[]>();
      for (const k of data.nuovi) {
        const a: any = byK.get(k); if (!a) continue;
        const luoghi = new Set<string>(a.luoghi || []);
        if ([...luoghi].some((l) => MADONIE.has(l))) luoghi.add('Madonie');
        for (const l of luoghi) { if (!perPaese.has(l)) perPaese.set(l, []); perPaese.get(l)!.push(a); }
      }
      for (const [paese, lista] of perPaese) {
        avvisi['paese:' + paese] = await notifica(sb, 'paese:' + paese, (a) => a.k, lista, (v) => ({
          subject: v.length > 1 ? `L'ARS parla di ${paese}: ${v.length} nuovi atti` : `L'ARS parla di ${paese}: ${v[0].titolo}`.slice(0, 140),
          html: (annulla) => emailHtml({ eyebrow: `Dall'ARS · ${paese}`, titolo: v.length > 1 ? `${v.length} nuovi atti dell'ARS nominano ${paese}` : `Un nuovo atto dell'ARS nomina ${paese}`,
            righe: v.map((a) => ({ titolo: a.titolo, sotto: `${TIPI[a.tipo]} n. ${a.n} · ${dataIt(a.data)}`, link: linkAtto(a.k) })), annulla }),
        }));
      }
      // risposte del Governo
      for (const k of data.risposte) {
        const a: any = byK.get(k); if (!a) continue;
        avvisi['atto:' + k] = await notifica(sb, 'atto:' + k, () => 'risposta:' + k, [a], () => ({
          subject: `Il Governo ha risposto: ${a.titolo}`.slice(0, 140),
          html: (annulla) => emailHtml({ eyebrow: `${TIPI[a.tipo]} n. ${a.n}`, titolo: 'Il Governo regionale ha risposto', testo: a.titolo,
            righe: [], bottone: { label: 'Leggi la risposta', link: linkAtto(a.k) }, annulla }),
        }));
      }
    }
    if (!body.silenzioso && tabella === 'leggi' && data.leggi_nuove.length) {
      const { data: leggi } = await sb.from('ars_leggi').select('id, ddl, titolo, data').in('id', data.leggi_nuove);
      avvisi.leggi = await notifica(sb, 'leggi', (l) => 'legge:' + l.id, leggi || [], (v) => ({
        subject: v.length > 1 ? `L'ARS ha approvato ${v.length} leggi` : `L'ARS ha approvato: ${v[0].titolo || 'ddl ' + v[0].ddl}`.slice(0, 140),
        html: (annulla) => emailHtml({ eyebrow: 'Leggi approvate', titolo: v.length > 1 ? `L'ARS ha approvato ${v.length} leggi` : 'L\'ARS ha approvato una legge',
          righe: v.map((l) => ({ titolo: l.titolo || `Disegno di legge n. ${l.ddl}`, sotto: `Ddl ${l.ddl} · voto finale del ${dataIt(l.data)}`, link: linkLegge(l.id) })), annulla }),
      }));
    }
  } catch (e) { console.error('avvisi', (e as Error).message); }

  return json({ ...data, nuovi: data.nuovi.length, risposte: data.risposte.length, leggi_nuove: data.leggi_nuove.length, avvisi });
});
