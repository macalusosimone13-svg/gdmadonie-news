import { Fragment, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useSEO } from '@/lib/useSEO';
import { useJsonLd } from '@/lib/useJsonLd';
import CondividiRiga from '@/components/CondividiRiga';
import { Avvisami, Caricamento, Emiciclo, Segnala, Termine } from '@/components/ars/ArsComuni';
import { SITE, fmtData, linkAtto, linkLegge, nomeCommissione, titoloLegge } from '@/lib/ars';

const PERSONE = ['Giovani', 'Famiglie', 'Studenti', 'Pazienti', 'Anziani e disabilità', 'Chi viaggia', 'Imprese', 'Agricoltori', 'Comuni'];
const REQ = { attesa: ['warn', 'Avviso non ancora uscito'], diretto: ['plain', 'Nessuna domanda da fare'], attiva: ['blue', 'Misura già attiva'] };
const fmtMln = (v) => (Number(v) % 1 === 0 ? Number(v).toLocaleString('it-IT') : Number(v).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) + ' mln';

export default function Legge() {
  const { id } = useParams();
  const { data, isLoading } = useQuery({
    queryKey: ['ars-legge', id],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data: l } = await supabase.from('ars_leggi').select('id, ddl, num, titolo, titolo_breve, data, seduta, approvata, favorevoli, contrari, astenuti, presenti, pagina, commissione, gurs, extra, manuale, unita_a, percorso').ilike('id', String(id || '')).maybeSingle();
      if (!l) return { l: null };
      const nums = [...new Set([l.num, ...(String(l.ddl).match(/\d{2,5}/g) || [])].filter(Boolean).map(Number))];
      const [m, d, s] = await Promise.all([
        supabase.from('ars_misure').select('id, ordine, articolo, tema, titolo, sintesi, mln, origine, locale, per, req_stato, req_testo, dettagli').eq('legge_id', l.id).eq('nascosta', false).order('ordine'),
        nums.length ? supabase.from('ars_atti').select('k, n, titolo, data, data_presentazione, iniziativa, commissione, iter, seduta').eq('tipo', 'D').in('n', nums) : Promise.resolve({ data: [] }),
        l.seduta ? supabase.from('ars_sedute').select('n, data, res_url, odg_url').eq('n', l.seduta).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      return { l, misure: m.data || [], ddl: d.data || [], seduta: s.data };
    },
  });
  const l = data?.l;
  const titolo = l ? titoloLegge(l) : '';
  const desc = l ? (l.extra?.breve?.[0] || `L'ARS ha approvato il ${fmtData(l.data)} il disegno di legge n. ${l.ddl}: ${l.titolo || ''}`).slice(0, 158) : '';
  useSEO({
    title: l ? `${titolo} — legge approvata dall'ARS il ${fmtData(l.data)} — GD Madonie News` : 'Legge non trovata — GD Madonie News',
    description: desc, url: l ? `${SITE}${linkLegge(l.id)}` : undefined, type: 'article', noindex: !isLoading && !l,
  });
  useJsonLd(l ? {
    '@context': 'https://schema.org', '@type': 'Legislation', name: l.titolo || titolo, alternateName: l.titolo_breve || undefined,
    legislationIdentifier: `ddl ${l.ddl}`, legislationDate: l.data, legislationJurisdiction: 'Regione Siciliana',
    legislationPassedBy: { '@type': 'GovernmentOrganization', name: 'Assemblea Regionale Siciliana' }, url: `${SITE}${linkLegge(l.id)}`, inLanguage: 'it-IT',
  } : null);

  if (isLoading) return <Caricamento righe={3} alt={160} />;
  if (!l) return <div className="empty">Questa legge non c'è (o il link è sbagliato). <Link to="/ars/leggi">Vedi tutte le leggi</Link></div>;
  if (l.unita_a) return <Navigate to={linkLegge(l.unita_a)} replace />;
  const ex = l.extra || {};
  const url = `${SITE}${linkLegge(l.id)}`;
  const resoconto = data.seduta?.res_url;

  // percorso: dal testo inserito a mano oppure ricostruito da commissioni e voto
  let percorso = ex.timeline;
  if (!percorso) {
    percorso = [];
    const pres = [l.percorso?.presentato, ...data.ddl.map((d) => d.data_presentazione || d.data)].filter(Boolean).sort()[0];
    if (pres) percorso.push({ quando: fmtData(pres), cosa: 'Il disegno di legge viene presentato all\'Assemblea.' });
    const viste = new Set();
    const comm = [];
    for (const [dd, c] of [...(l.percorso?.commissione || []), ...data.ddl.flatMap((d) => d.iter?.commissione || [])]) {
      if ((!l.data || dd <= l.data) && !viste.has(dd + c)) { viste.add(dd + c); comm.push([dd, c]); }
    }
    comm.sort((a, b) => a[0].localeCompare(b[0]));
    if (comm.length) {
      const nomi = [...new Set(comm.map((x) => x[1]))];
      percorso.push({ quando: comm.length > 1 ? `${fmtData(comm[0][0])} – ${fmtData(comm[comm.length - 1][0])}` : fmtData(comm[0][0]), cosa: `Esame in commissione (${nomi.join(', ')}): ${comm.length} ${comm.length === 1 ? 'seduta' : 'sedute'}.` });
    }
    percorso.push({ quando: fmtData(l.data), cosa: `Voto finale in Aula: ${l.approvata ? 'approvata' : 'respinta'}.` });
    if (l.approvata) percorso.push({ quando: l.gurs ? 'Pubblicata' : 'Da verificare', cosa: l.gurs ? `Pubblicata sulla Gazzetta ufficiale: ${l.gurs}.` : 'Pubblicazione sulla Gazzetta ufficiale della Regione (GURS): da quel giorno è legge. Il numero della legge è sul sito della Gazzetta.', da_fare: !l.gurs });
  }

  return (
    <div className="view">
      <article className="law-head">
        <Link to="/ars/leggi" className="back"><ArrowLeft size={16} /> Tutte le leggi</Link>
        <span className={`pill ${l.approvata ? 'ok' : 'warn'}`}>{l.approvata ? `✓ Approvata dall'ARS il ${fmtData(l.data)}` : `Respinta il ${fmtData(l.data)}`}</span>
        <h1>{titolo}</h1>
        {l.titolo_breve && l.titolo && <p style={{ color: 'var(--a-muted)' }}>Titolo ufficiale: {l.titolo}</p>}
        <p style={{ color: 'var(--a-muted)', fontSize: 14 }}><Termine k="ddl">Disegno di legge</Termine> n. {l.ddl}{l.commissione ? ` · ${nomeCommissione(l.commissione)}` : ''}{l.seduta ? ` · seduta n. ${l.seduta}` : ''}</p>
        <CondividiRiga url={url} title={titolo} testoWa={`🏛️ *${titolo}*\nL'ARS l'ha approvata il ${fmtData(l.data)}: cosa cambia, spiegato semplice.\n\n${url}`} />
      </article>

      <div className="law-grid">
        <div style={{ display: 'grid', gap: 20, minWidth: 0 }}>
          {Array.isArray(ex.breve) && ex.breve.length > 0 &&
            <section className="panel"><h2>In breve</h2><ul className="bullets">{ex.breve.map((b) => <li key={b}>{b}</li>)}</ul></section>}
          {Array.isArray(ex.approvate) && ex.approvate.length > 0 &&
            <section className="panel"><h2>Le cifre principali</h2>
              <ul className="bullets">{ex.approvate.map(([t, v]) => <li key={t}><span><b>{v}</b> · {t}</span></li>)}</ul></section>}
          {data.misure.length > 0 && <Misure misure={data.misure} />}
          {ex.scheda?.ia && <p className="sources">Spiegazione preparata con l'intelligenza artificiale dal testo del disegno di legge arrivato in Aula, riletta dalla redazione prima della pubblicazione. Il testo approvato può essere stato modificato in Aula con gli emendamenti: fa fede la legge pubblicata sulla Gazzetta ufficiale.</p>}
          {data.misure.length === 0 && !ex.breve?.length &&
            <section className="panel tint">
              <h2>Cosa contiene</h2>
              <p>{l.titolo || titolo}</p>
              <p style={{ color: 'var(--a-muted)', fontSize: 15 }}>La spiegazione articolo per articolo arriva quando il testo definitivo è disponibile. Intanto puoi leggere il testo votato nel resoconto ufficiale della seduta.</p>
              {resoconto && <a className="btn ghost small" href={`${resoconto}`} target="_blank" rel="noopener noreferrer">Resoconto della seduta (sito ARS)</a>}
            </section>}
          {Array.isArray(ex.settori) && ex.settori.length > 0 && <Settori settori={ex.settori} fonte={ex.settori_fonte} />}
          {ex.nota && <div className="note"><b>Da sapere</b><span>{ex.nota}</span></div>}
        </div>
        <aside style={{ display: 'grid', gap: 20, minWidth: 0 }}>
          {l.favorevoli != null &&
            <section className="panel" style={{ justifyItems: 'center', textAlign: 'center' }}>
              <h2>Il voto finale</h2>
              <Emiciclo si={l.favorevoli} no={l.contrari || 0} ast={l.astenuti || 0} />
              {ex.voto_nota && <p style={{ fontSize: 14, color: 'var(--a-muted)' }}>{ex.voto_nota}</p>}
              {l.presenti != null && <p style={{ fontSize: 14, color: 'var(--a-muted)' }}>Presenti: {l.presenti} su 70 deputati.</p>}
            </section>}
          <section className="panel">
            <h2>Il percorso</h2>
            <ol className="timeline">
              {percorso.map((t, i) =>
                <li key={i} className={t.da_fare ? 'todo' : ''}><span className="mk">{t.da_fare ? '…' : i + 1}</span><div><time>{t.quando}</time><p>{t.cosa}</p></div></li>)}
            </ol>
          </section>
          {data.ddl.length > 0 &&
            <section className="panel">
              <h2>I documenti</h2>
              {data.ddl.map((d) => <Link key={d.k} to={linkAtto(d.k)} className="linkbtn">Disegno di legge n. {d.n}: scheda →</Link>)}
              {resoconto && <a className="linkbtn" href={resoconto} target="_blank" rel="noopener noreferrer">Resoconto della seduta del voto ↗</a>}
            </section>}
          <section className="panel tint">
            <h2>Seguila</h2>
            <p style={{ fontSize: 15 }}>Ricevi un'email quando l'ARS approva una nuova legge.</p>
            <Avvisami chiave="leggi" etichetta="Avvisami" compatto />
          </section>
        </aside>
      </div>
      <div className="sources">Fonte: resoconti ufficiali dell'Assemblea Regionale Siciliana. Il numero della legge e la data di pubblicazione vanno controllati sulla Gazzetta ufficiale della Regione. <Segnala pagina={linkLegge(l.id)} /></div>
    </div>);
}

function Misure({ misure }) {
  const [persona, setPersona] = useState('Tutti');
  const [tema, setTema] = useState('Tutti');
  const [ordine, setOrdine] = useState('soldi');
  const [aperta, setAperta] = useState(null);
  const temi = useMemo(() => [...new Set(misure.map((m) => m.tema).filter(Boolean))], [misure]);
  const conta = (p) => misure.filter((m) => (m.per || []).includes(p)).length;
  let lista = misure.filter((m) => (persona === 'Tutti' || (m.per || []).includes(persona)) && (tema === 'Tutti' || m.tema === tema));
  lista = [...lista].sort((a, b) => (ordine === 'soldi' ? (b.mln || 0) - (a.mln || 0) : a.ordine - b.ordine));
  return (
    <section style={{ display: 'grid', gap: 14 }}>
      <div className="persona">
        <h2>Cosa c'è per te</h2>
        <div className="pgrid" role="group" aria-label="Per chi">
          {['Tutti', ...PERSONE].filter((p) => p === 'Tutti' || conta(p) > 0).map((p) =>
            <button key={p} type="button" className="pbtn" aria-pressed={persona === p} onClick={() => setPersona(p)}>{p}<span className="c">{p === 'Tutti' ? misure.length : conta(p)}</span></button>)}
        </div>
      </div>
      <div className="toolbar">
        <div className="chips" role="group" aria-label="Tema">
          {['Tutti', ...temi].map((t) => <button key={t} type="button" className="chip" aria-pressed={tema === t} onClick={() => setTema(t)}>{t}</button>)}
        </div>
        <div className="seg" role="group" aria-label="Ordina">
          <button type="button" aria-pressed={ordine === 'soldi'} onClick={() => setOrdine('soldi')}>Più soldi</button>
          <button type="button" aria-pressed={ordine === 'articolo'} onClick={() => setOrdine('articolo')}>Per articolo</button>
        </div>
      </div>
      <div className="arts">
        {lista.length === 0 && <div className="empty">Nessuna misura con questi filtri.</div>}
        {lista.map((m) => {
          const r = REQ[m.req_stato] || REQ.diretto;
          const open = aperta === m.id;
          return (
            <article key={m.id} className="art">
              <button type="button" aria-expanded={open} onClick={() => setAperta(open ? null : m.id)}>
                <span className="no">ART. {m.articolo}</span>
                <span style={{ minWidth: 0 }}>
                  <span className="t" style={{ display: 'block' }}>{m.titolo}</span>
                  <span className="s" style={{ display: 'block' }}>{m.sintesi}</span>
                  <span className="meta"><span className={`pill ${r[0]}`}>{r[1]}</span>{m.tema && <span className="pill plain">{m.tema}</span>}{m.locale && <span className="pill ok">Riguarda le Madonie</span>}</span>
                </span>
                {m.mln != null && <span className="amt num">{fmtMln(m.mln)}<small>{m.origine}</small></span>}
              </button>
              {open &&
                <div className="body">
                  {(m.dettagli || []).length > 0 && <dl className="kv">{m.dettagli.map((d) => <Fragment key={d.k}><dt>{d.k}</dt><dd>{d.v}</dd></Fragment>)}</dl>}
                  {m.req_testo && <div className="req"><b>Come si chiede:</b> <span>{m.req_testo}</span></div>}
                </div>}
            </article>);
        })}
      </div>
    </section>);
}

function Settori({ settori, fonte }) {
  const max = Math.max(...settori.map((s) => s.mln));
  return (
    <section className="panel">
      <h2>Dove vanno i soldi</h2>
      <div className="bars">
        {settori.map((s) =>
          <div key={s.nome} className="bar"><span className="lab">{s.nome}</span><span className="track"><span className="fill" style={{ width: `${(s.mln / max) * 100}%`, display: 'block' }} /></span><span className="val num">{fmtMln(s.mln)}</span></div>)}
      </div>
      {fonte && <p className="sources">{fonte}</p>}
    </section>);
}
