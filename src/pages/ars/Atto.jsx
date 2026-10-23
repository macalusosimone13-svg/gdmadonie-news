import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useSEO } from '@/lib/useSEO';
import { useJsonLd } from '@/lib/useJsonLd';
import CondividiRiga from '@/components/CondividiRiga';
import { AttoRiga, Avvisami, Caricamento, Segnala, Termine, TipoAtto } from '@/components/ars/ArsComuni';
import { MADONIE, SITE, TIPI, cognomi, fmtData, kDaSlug, linkAtto, linkLegge } from '@/lib/ars';

// Testo ufficiale diviso in paragrafi leggibili (premesso che / considerato che / per sapere...).
function Paragrafi({ testo }) {
  const pezzi = String(testo || '').split(/\s(?=(?:premesso che|considerato che|rilevato che|ritenuto che|atteso che|per sapere|impegna il Governo|si chiede|chiede)\b)/i);
  return <div className="ft">{pezzi.map((p, i) => <p key={i}>{p}</p>)}</div>;
}

const conPagina = (url, p) => (url ? `${url}${p ? `#page=${p}` : ''}` : null);

export default function Atto() {
  const { slug } = useParams();
  const k = kDaSlug(slug);
  const { data: a, isLoading } = useQuery({
    queryKey: ['ars-atto', k],
    enabled: !!k,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => (await supabase.from('ars_atti').select('*').eq('k', k).maybeSingle()).data,
  });
  const [sintesi, setSintesi] = useState(null);
  const [sintesiStato, setSintesiStato] = useState('');
  useEffect(() => {
    setSintesi(a?.sintesi || null);
    if (!a) return;
    if (a.sintesi && a.sintesi_at && new Date(a.sintesi_at) >= new Date(a.updated_at)) return;
    let vivo = true;
    setSintesiStato('carico');
    supabase.functions.invoke('ars-sintesi', { body: { k: a.k } })
      .then(({ data }) => { if (vivo) { if (data?.sintesi) setSintesi(data.sintesi); setSintesiStato(''); } })
      .catch(() => { if (vivo) setSintesiStato(''); });
    return () => { vivo = false; };
  }, [a]);

  const { data: extra } = useQuery({
    queryKey: ['ars-atto-extra', k],
    enabled: !!a,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const luogo = (a.luoghi || []).find((l) => MADONIE.includes(l) && l !== 'Madonie') || ((a.luoghi || []).includes('Madonie') ? 'Madonie' : null);
      const sedute = [a.seduta, a.risposta?.s, a.orale?.seduta].filter(Boolean);
      const [vicini, sed, legge] = await Promise.all([
        luogo ? supabase.from('ars_atti').select('k, tipo, n, titolo, data, firmatari, gruppo, luoghi, ha_risposta').contains('luoghi', [luogo]).neq('k', a.k).order('data', { ascending: false }).limit(4) : Promise.resolve({ data: [] }),
        sedute.length ? supabase.from('ars_sedute').select('n, data, odg_url, res_url').in('n', sedute) : Promise.resolve({ data: [] }),
        a.iter?.legge ? supabase.from('ars_leggi').select('id, unita_a').eq('id', a.iter.legge).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      return { luogo, vicini: vicini.data || [], sedute: Object.fromEntries((sed.data || []).map((s) => [s.n, s])), legge: legge.data };
    },
  });

  const titolo = a ? `${TIPI[a.tipo]} n. ${a.n}: ${a.titolo}` : '';
  const desc = a ? (sintesi?.breve || `${TIPI[a.tipo]} n. ${a.n} presentata all'ARS il ${fmtData(a.data)}${a.firmatari?.length ? ' da ' + cognomi(a.firmatari) : ''}: ${a.titolo}`).slice(0, 158) : '';
  useSEO({
    title: a ? `${a.titolo.slice(0, 80)}${a.titolo.length > 80 ? '…' : ''} — ${TIPI[a.tipo]} ARS n. ${a.n} — GD Madonie News` : 'Atto non trovato — GD Madonie News',
    description: desc, url: a ? `${SITE}${linkAtto(a.k)}` : undefined, type: 'article', noindex: !isLoading && !a,
  });
  useJsonLd(a ? {
    '@context': 'https://schema.org', '@type': 'Article', headline: titolo.slice(0, 110), datePublished: a.data, inLanguage: 'it-IT',
    url: `${SITE}${linkAtto(a.k)}`, description: desc, author: (a.firmatari || []).map((n) => ({ '@type': 'Person', name: n })),
    publisher: { '@type': 'Organization', name: 'GD Madonie News', url: SITE },
    isBasedOn: a.url_doc || undefined, about: (a.luoghi || []).map((l) => ({ '@type': 'Place', name: l })),
  } : null);

  if (!k) return <div className="empty">Indirizzo non valido. <Link to="/ars/domande">Vedi tutti gli atti</Link></div>;
  if (isLoading) return <Caricamento righe={3} alt={140} />;
  if (!a) return <div className="empty">Questo atto non è nel nostro archivio (o non è ancora stato pubblicato dall'ARS). <Link to="/ars/domande">Vedi tutti gli atti</Link></div>;

  const url = `${SITE}${linkAtto(a.k)}`;
  const orale = a.orale && ['svolta', 'parzialmente svolta'].includes(a.orale.stato) ? a.orale : null;
  const sedDoc = extra?.sedute || {};
  const linkRisp = a.risposta ? conPagina(a.risposta.u || (a.risposta.src === 'r' ? sedDoc[a.risposta.s]?.res_url : sedDoc[a.risposta.s]?.odg_url), a.risposta.p) : null;
  const linkOrale = orale ? conPagina(sedDoc[orale.seduta]?.res_url, orale.pagina) : null;
  const linkDoc = conPagina(a.url_doc, a.pagina);
  const comuni = (a.luoghi || []).filter((l) => l !== 'Madonie');

  return (
    <div className="view">
      <article className="atto">
        <Link to="/ars/domande" className="back"><ArrowLeft size={16} /> Tutte le domande e proposte</Link>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <TipoAtto tipo={a.tipo} n={a.n} />
          {a.ha_risposta && <span className="pill ok">Il Governo ha risposto</span>}
          {comuni.map((l) => <Link key={l} to={`/ars/domande?luogo=${encodeURIComponent(l)}&tipo=tutto`} className="pill plain" style={{ textDecoration: 'none' }}>{l}</Link>)}
        </div>
        <h1>{a.titolo}</h1>
        <p style={{ color: 'var(--a-muted)', fontSize: 15 }}>
          {a.data_presentazione && a.data_presentazione !== a.data ? `Presentata il ${fmtData(a.data_presentazione)} · ` : ''}
          {a.fonte === 'r' && !a.testo ? `Discussa in Aula il ${fmtData(a.data)}` : `Annunciata in Aula il ${fmtData(a.data)}`}{a.seduta ? ` (seduta n. ${a.seduta})` : ''}
        </p>
        {a.firmatari?.length > 0 &&
          <p style={{ fontSize: 15 }}><b>Presentata da:</b> {a.firmatari.map((f, i) => <span key={f}>{i > 0 && ', '}<Link to={`/ars/domande?firmatario=${encodeURIComponent(f)}&tipo=tutto`}>{f}</Link></span>)}{a.gruppo ? ` (${a.gruppo})` : ''}</p>}
        {a.iniziativa && <p style={{ fontSize: 15 }}><b>Iniziativa:</b> {a.iniziativa.replace(/^Iniziativa /, '')}</p>}
        {a.destinatari?.length > 0 && <p style={{ fontSize: 15 }}><b>Rivolta a:</b> {a.destinatari.join('; ')}</p>}
        {a.commissione && <p style={{ fontSize: 15 }}><b><Termine k="commissione">Commissione</Termine>:</b> {a.commissione}</p>}

        <section className="panel ai" aria-live="polite">
          <h2>In breve</h2>
          {sintesi?.breve ? <p>{sintesi.breve}</p> :
            sintesiStato === 'carico' ? <div className="thinking"><i /> Sto preparando una spiegazione semplice dal testo ufficiale…</div> :
              <p style={{ color: 'var(--a-muted)' }}>{a.testo ? 'Spiegazione non disponibile in questo momento: leggi il testo completo qui sotto.' : 'Di questo atto il documento dell\'ARS riporta solo il titolo.'}</p>}
          {sintesi?.chiede?.length > 0 && <>
            <div className="eyebrow">{a.tipo === 'D' ? 'Cosa propone' : a.tipo === 'M' ? "Cosa chiede all'Aula" : 'Cosa chiedono al Governo'}</div>
            <ul className="bullets">{sintesi.chiede.map((c) => <li key={c}>{c}</li>)}</ul></>}
          {sintesi?.breve && <p className="sources">Spiegazione scritta dall'intelligenza artificiale leggendo il testo ufficiale. Fa fede il documento dell'ARS.</p>}
        </section>

        {a.tipo === 'D' && a.iter &&
          <section className="panel">
            <h2>A che punto è</h2>
            {a.iter.stato === 'votato' ?
              <p>{a.iter.approvata ? '✓ Approvato' : 'Respinto'} dall'Aula il {fmtData(a.iter.data)}. {extra?.legge && <Link to={linkLegge(extra.legge.unita_a || extra.legge.id)}>Vai alla scheda della legge →</Link>}</p> :
              <p>In esame in commissione ({a.iter.commissione_nome}): ultima seduta il {fmtData(a.iter.data)}.</p>}
            {a.iter.commissione?.length > 0 &&
              <details className="fulltext"><summary>Le sedute in commissione ({a.iter.commissione.length})</summary>
                <ul className="odg">{a.iter.commissione.map(([d, c]) => <li key={d + c}>{fmtData(d)} · {c}</li>)}</ul></details>}
          </section>}

        {(a.risposta || orale) &&
          <section className="panel risp">
            <h2>La risposta del Governo</h2>
            {sintesi?.risposta && <p><b>In breve:</b> {sintesi.risposta}</p>}
            {a.risposta &&
              <div style={{ display: 'grid', gap: 8 }}>
                <span className="pill ok"><Termine k="risposta_scritta">Risposta scritta</Termine> · pubblicata il {fmtData(a.risposta.d)}</span>
                <details className="fulltext"><summary>Leggi la risposta</summary><Paragrafi testo={a.risposta.txt} /></details>
                {linkRisp && <a href={linkRisp} target="_blank" rel="noopener noreferrer" className="linkbtn">Documento ufficiale (pagina {a.risposta.p}) ↗</a>}
              </div>}
            {orale &&
              <div style={{ display: 'grid', gap: 8 }}>
                <span className="pill ok">Risposta in Aula · {fmtData(orale.data)}{orale.stato === 'parzialmente svolta' ? ' (in parte)' : ''}</span>
                <details className="fulltext"><summary>Leggi cosa è stato detto in Aula</summary><Paragrafi testo={orale.txt} /></details>
                {linkOrale && <a href={linkOrale} target="_blank" rel="noopener noreferrer" className="linkbtn">Resoconto della seduta (pagina {orale.pagina}) ↗</a>}
              </div>}
          </section>}

        {!a.risposta && !orale && a.tipo !== 'D' && a.tipo !== 'M' &&
          <section className="panel tint">
            <h2>La risposta del Governo</h2>
            {a.orale?.stato === 'trasformata' ?
              <p>Chiamata in Aula il {fmtData(a.orale.data)}: <Termine k="trasformata">trasformata in domanda con risposta scritta</Termine>. La risposta non è ancora stata pubblicata.</p> :
              a.orale?.stato === 'rinviata' ? <p>Chiamata in Aula il {fmtData(a.orale.data)} ma rinviata. Il Governo non ha ancora risposto.</p> :
                <p>Il Governo non ha ancora risposto (o la risposta non è ancora stata pubblicata dall'ARS).</p>}
            <Avvisami chiave={`atto:${a.k}`} etichetta="Avvisami quando risponde" compatto testo="Ti scriviamo appena il Governo risponde a questa domanda." />
          </section>}

        {a.testo &&
          <details className="fulltext">
            <summary>Il testo completo</summary>
            <Paragrafi testo={a.testo} />
          </details>}
        {linkDoc && <a href={linkDoc} target="_blank" rel="noopener noreferrer" className="btn ghost small">Documento ufficiale dell'ARS{a.pagina ? ` (pagina ${a.pagina})` : ''} ↗</a>}

        <CondividiRiga url={url} title={a.titolo} testoWa={`🏛️ *${a.titolo}*\n${TIPI[a.tipo]} n. ${a.n} all'ARS${a.ha_risposta ? ' · il Governo ha risposto' : ''}.\n\n${url}`} />
        <div className="sources">Fonte: Assemblea Regionale Siciliana, {a.fonte === 'r' ? 'resoconto' : a.fonte === 'a' ? 'allegato al resoconto' : 'ordine del giorno'} della seduta n. {a.seduta}. <Segnala pagina={linkAtto(a.k)} /></div>
      </article>

      {extra?.vicini?.length > 0 &&
        <section>
          <div className="sec-h"><h2>Altri atti su {extra.luogo === 'Madonie' ? 'le Madonie' : extra.luogo}</h2><Link to={`/ars/domande?luogo=${encodeURIComponent(extra.luogo)}&tipo=tutto`}>Tutti →</Link></div>
          <div className="grid2">{extra.vicini.map((x) => <AttoRiga key={x.k} a={x} />)}</div>
        </section>}
    </div>);
}
