import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useSEO } from '@/lib/useSEO';
import { useJsonLd } from '@/lib/useJsonLd';
import CondividiRiga from '@/components/CondividiRiga';
import RigaScorrevole from '@/components/ars/RigaScorrevole';
import { AttoRiga, Caricamento, Segnala, Termine } from '@/components/ars/ArsComuni';
import { SITE, fmtCollegio, fmtData, fmtNum } from '@/lib/ars';
import AvatarDeputato from '@/components/ars/AvatarDeputato';
import { useDeputati } from '@/lib/arsDeputati';

// /ars/deputato/<slug>: profilo di un deputato. Dati ufficiali dell'ARS:
// gruppo, lista, collegio, preferenze, incarichi e tutti gli atti che ha firmato.

const PER_PAGINA = 20;
const FILTRI = [
  ['tutto', 'Tutti', null],
  ['I', 'Interrogazioni', ['I']],
  ['P', 'Interpellanze', ['P']],
  ['M', 'Mozioni', ['M']],
  ['madonie', 'Sulle Madonie', null],
];

export default function Deputato() {
  const { slug } = useParams();
  const { data: tutti, isLoading } = useDeputati();
  const d = (tutti || []).find((x) => x.slug === slug);

  const { data: conti } = useQuery({
    queryKey: ['ars-deputato-conti', d?.nome],
    enabled: !!d,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('ars_deputato_conti', { p_nome: d.nome });
      if (error) throw error;
      return data;
    },
  });

  const [filtro, setFiltro] = useState('tutto');
  const [primo, setPrimo] = useState(false);
  const [pag, setPag] = useState(0);
  useEffect(() => { setPag(0); }, [filtro, primo, slug]);
  useEffect(() => { setFiltro('tutto'); setPrimo(false); }, [slug]);
  const f = FILTRI.find((x) => x[0] === filtro) || FILTRI[0];
  const { data: atti, isFetching } = useQuery({
    queryKey: ['ars-deputato-atti', d?.nome, filtro, primo, pag],
    enabled: !!d,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('ars_deputato_atti', {
        p_nome: d.nome, p_tipi: f[2], p_primo: primo, p_madonie: filtro === 'madonie', p_da: pag * PER_PAGINA, p_n: PER_PAGINA,
      });
      if (error) throw error;
      return { righe: data || [], tot: Number(data?.[0]?.totale || 0) };
    },
  });

  const url = `${SITE}/ars/deputato/${slug}`;
  const descr = d ? `${d.nome}, all'Assemblea Regionale Siciliana con ${d.gruppoNome}${d.collegio ? `, ${fmtCollegio(d.collegio).toLowerCase()}` : ''}${d.voti ? ` con ${fmtNum(d.voti)} preferenze` : ''}. Incarichi e tutti gli atti presentati: interrogazioni, interpellanze e mozioni.` : '';
  useSEO({
    title: d ? `${d.nome} — ARS, ${d.gruppoNome}: incarichi e atti presentati — GD Madonie News` : 'Deputato non trovato — GD Madonie News',
    description: descr, url: d ? url : undefined, noindex: !isLoading && !d,
  });
  useJsonLd(d ? {
    '@context': 'https://schema.org', '@type': 'ProfilePage', url,
    mainEntity: { '@type': 'Person', name: d.nome, image: d.foto_url || undefined, jobTitle: "Deputato dell'Assemblea Regionale Siciliana", affiliation: { '@type': 'Organization', name: d.gruppo || d.gruppoNome }, sameAs: d.url ? [d.url] : undefined },
  } : null);

  if (isLoading) return <Caricamento righe={3} alt={160} />;
  if (!d) return <div className="empty">Non troviamo questo deputato. <Link to="/ars/deputati">Vedi tutti i deputati</Link></div>;

  const pt = conti?.per_tipo || {};
  const assessore = (d.ruoli || []).some((r) => /^Assessore|^Presidente della Regione/i.test(r));
  const pagine = Math.ceil((atti?.tot || 0) / PER_PAGINA);
  const numeri = [
    ['I', 'Interrogazioni', 'interrogazione'],
    ['P', 'Interpellanze', 'interpellanza'],
    ['M', 'Mozioni', 'mozione'],
  ];

  return (
    <div className="view">
      <article className="dep-profilo">
        <Link to="/ars/deputati" className="back"><ArrowLeft size={16} /> Tutti i deputati</Link>
        <header className="dep-testa">
          <AvatarDeputato d={d} grande />
          <div className="dep-testa-txt">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span className="pill blue">{d.gruppoNome}</span>
              {!d.in_carica && <span className="pill warn">Non più in carica</span>}
              {d.palermo && d.in_carica && <span className="pill ok">Collegio delle Madonie</span>}
            </div>
            <h1>{d.nome}</h1>
            <p className="dep-sotto">
              {[d.collegio && <span key="c">{/^regional/i.test(d.collegio) ? <b>Listino regionale</b> : <>Collegio di <b>{d.collegio}</b></>}</span>,
                d.voti && <span key="v"><b>{fmtNum(d.voti)}</b> preferenze</span>,
                d.lista && <span key="l">Lista {d.lista}</span>].filter(Boolean)}
            </p>
            {d.gruppo && d.gruppo !== d.gruppoNome && <p className="dep-sotto">Gruppo parlamentare: {d.gruppo}</p>}
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              {d.url && <a href={d.url} target="_blank" rel="noopener noreferrer" className="linkbtn">Scheda ufficiale sul sito dell'ARS ↗</a>}
            </div>
          </div>
        </header>
      </article>

      <section className="dep-numeri" aria-label="Atti presentati">
        <div className="dep-num"><b>{conti ? conti.tot : '…'}</b><span>atti firmati</span><small>{conti ? `${conti.primo} come primo firmatario` : ''}</small></div>
        {numeri.map(([k, lab, term]) => (
          <div key={k} className="dep-num"><b>{conti ? (pt[k]?.tot || 0) : '…'}</b><span><Termine k={term}>{lab}</Termine></span>
            <small>{conti && k === 'I' ? `${pt.I?.risposta || 0} con risposta del Governo` : conti && pt[k]?.primo ? `${pt[k].primo} come primo firmatario` : ''}</small></div>))}
        <div className="dep-num"><b>{conti ? conti.madonie : '…'}</b><span>sulle Madonie</span><small>nominano un paese o le Madonie</small></div>
      </section>
      {assessore && <p className="sub" style={{ marginTop: -18 }}>Da membro del Governo regionale risponde alle domande dei deputati invece di presentarle: per questo i suoi atti sono pochi o nessuno.</p>}

      <div className="dep-due">
        {(d.ruoli || []).length > 0 &&
          <section className="panel">
            <h2>Incarichi</h2>
            <ul className="roles">{d.ruoli.map((r) => <li key={r}>{r}</li>)}</ul>
          </section>}
        {conti?.temi?.length > 0 &&
          <section className="panel">
            <h2>Di cosa si occupa</h2>
            <p style={{ fontSize: 14, color: 'var(--a-muted)' }}>I temi più frequenti tra i suoi atti già classificati.</p>
            <div className="dep-temi">{conti.temi.map((t) => <span key={t.tema} className="dep-tema">{t.tema}<b>{t.n}</b></span>)}</div>
            {conti.primo_atto && <p style={{ fontSize: 14, color: 'var(--a-muted)' }}>Atti dal {fmtData(conti.primo_atto)} al {fmtData(conti.ultimo_atto)}.</p>}
          </section>}
      </div>

      <section style={{ display: 'grid', gap: 12 }}>
        <div className="sec-h"><h2>I suoi atti</h2></div>
        <RigaScorrevole className="chips dep-filtri" role="group" aria-label="Tipo di atto" etichettaFreccia="Mostra altri filtri">
          {FILTRI.map(([k, lab]) => <button key={k} type="button" className="chip" aria-pressed={filtro === k} onClick={() => setFiltro(k)}>{lab}</button>)}
        </RigaScorrevole>
        <label className="dep-primo"><input type="checkbox" checked={primo} onChange={(e) => setPrimo(e.target.checked)} /> Solo quelli in cui è il primo firmatario</label>
        <span className="count" aria-live="polite" style={{ fontSize: 14, color: 'var(--a-muted)' }}>{atti ? `${fmtNum(atti.tot)} atti${pagine > 1 ? ` · pagina ${pag + 1} di ${pagine}` : ''}` : 'Cerco…'}</span>
        {!atti ? <Caricamento righe={5} /> :
          atti.tot === 0 ? <div className="empty">Nessun atto con questi filtri.</div> :
            <div className="rows" style={{ opacity: isFetching ? 0.6 : 1 }}>{atti.righe.map((a) => <AttoRiga key={a.k} a={a} />)}</div>}
        {pagine > 1 &&
          <div className="pager">
            <button type="button" className="btn ghost small" disabled={pag === 0} onClick={() => setPag((p) => p - 1)}>← Precedenti</button>
            <button type="button" className="btn ghost small" disabled={pag + 1 >= pagine} onClick={() => setPag((p) => p + 1)}>Successivi →</button>
          </div>}
      </section>

      <CondividiRiga url={url} title={`${d.nome} all'ARS: incarichi e atti presentati`} testoWa={`🏛️ *${d.nome}* all'ARS (${d.gruppoNome}): incarichi e tutti gli atti presentati.\n\n${url}`} />
      <div className="sources">Fonte: scheda del deputato sul sito dell'ARS e atti pubblicati negli allegati delle sedute (XVIII legislatura, dal 2022). Contiamo interrogazioni, interpellanze e mozioni firmate; i disegni di legge e i voti del singolo deputato non sono ancora nel nostro archivio. <Segnala pagina={`/ars/deputato/${slug}`} /></div>
    </div>);
}
