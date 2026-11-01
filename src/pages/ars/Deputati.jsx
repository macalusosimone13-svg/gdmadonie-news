import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSEO } from '@/lib/useSEO';
import { Caricamento, Segnala } from '@/components/ars/ArsComuni';
import RigaScorrevole from '@/components/ars/RigaScorrevole';
import { SITE, fmtCollegio, fmtNum, iniziali } from '@/lib/ars';
import { useDeputati, incaricoPrincipale } from '@/lib/arsDeputati';

// /ars/deputati: i deputati in carica divisi per gruppo parlamentare.
// Ogni scheda e' tutta cliccabile e apre il profilo (/ars/deputato/<slug>).

const idGruppo = (g) => 'gruppo-' + String(g).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-');

export default function Deputati() {
  useSEO({
    title: "Deputati dell'ARS divisi per gruppo: chi ci rappresenta — GD Madonie News",
    description: "I 70 deputati dell'Assemblea Regionale Siciliana divisi per gruppo: collegio, preferenze, incarichi e tutti gli atti che hanno presentato. In evidenza gli eletti nel collegio di Palermo, che comprende le Madonie.",
    url: `${SITE}/ars/deputati`,
  });
  const [soloPalermo, setSoloPalermo] = useState(false);
  const [exAperti, setExAperti] = useState(false);
  const { data, isLoading } = useDeputati();

  const inCarica = useMemo(() => (data || []).filter((d) => d.in_carica), [data]);
  const ex = useMemo(() => (data || []).filter((d) => !d.in_carica), [data]);
  const visibili = soloPalermo ? inCarica.filter((d) => d.palermo) : inCarica;
  const gruppi = useMemo(() => {
    const m = new Map();
    for (const d of visibili) m.set(d.gruppoNome, [...(m.get(d.gruppoNome) || []), d]);
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], 'it'));
  }, [visibili]);

  if (isLoading) return <Caricamento righe={3} alt={180} />;
  const palermo = inCarica.filter((d) => d.palermo).length;
  const vai = (g) => document.getElementById(idGruppo(g))?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="view">
      <section>
        <div className="sec-h"><h1 style={{ fontSize: 'clamp(26px,5vw,40px)', textTransform: 'uppercase', fontWeight: 900 }}>Chi ci rappresenta</h1></div>
        <p className="sub">I {inCarica.length} deputati dell'Assemblea Regionale Siciliana, divisi per gruppo. Tocca una scheda per vedere incarichi, temi e tutti gli atti che ha presentato. Le Madonie votano nel collegio di Palermo: {palermo} deputati sono stati eletti qui.</p>
        <div className="chips" role="group" aria-label="Quali deputati mostrare" style={{ marginBottom: 12 }}>
          <button type="button" className="chip" aria-pressed={!soloPalermo} onClick={() => setSoloPalermo(false)}>Tutti<span className="c">{inCarica.length}</span></button>
          <button type="button" className="chip" aria-pressed={soloPalermo} onClick={() => setSoloPalermo(true)}>Eletti a Palermo (Madonie)<span className="c">{palermo}</span></button>
        </div>
        <RigaScorrevole className="dep-salti" aria-label="Vai a un gruppo" etichettaFreccia="Mostra gli altri gruppi">
          {gruppi.map(([g, lista]) => <button key={g} type="button" onClick={() => vai(g)}>{g} <span>{lista.length}</span></button>)}
        </RigaScorrevole>
      </section>

      {gruppi.map(([g, lista]) => (
        <section key={g} id={idGruppo(g)} className="dep-gruppo">
          <div className="sec-h"><h2>{g}</h2><span className="dep-conta">{lista.length} {lista.length === 1 ? 'deputato' : 'deputati'}</span></div>
          <div className="dep-grid">{lista.map((d) => <SchedaDeputato key={d.nome} d={d} />)}</div>
        </section>))}

      {ex.length > 0 &&
        <section>
          <div className="sec-h"><h2>Non più in carica ({ex.length})</h2><button type="button" className="linkbtn" onClick={() => setExAperti((x) => !x)}>{exAperti ? 'Nascondi' : 'Mostra'}</button></div>
          {exAperti && <div className="dep-grid">{ex.map((d) => <SchedaDeputato key={d.nome} d={d} conGruppo />)}</div>}
        </section>}

      <div className="sources">Fonte: schede dei deputati sul sito dell'ARS, aggiornate ogni giorno. Non facciamo classifiche: il numero di atti presentati non dice quanto lavora un deputato. <Segnala pagina="/ars/deputati" /></div>
    </div>);
}

export function SchedaDeputato({ d, conGruppo = false }) {
  const incarico = incaricoPrincipale(d.ruoli);
  return (
    <Link to={`/ars/deputato/${d.slug}`} className="dep-card" aria-label={`${d.nome}, ${d.gruppoNome}: apri il profilo`}>
      <span className="dep-avatar" aria-hidden="true">{iniziali(d.nome)}</span>
      <span className="dep-nome">{d.nome}</span>
      {conGruppo && <span className="pill plain">{d.gruppoNome}</span>}
      {d.palermo && d.in_carica && <span className="pill blue">Nostro collegio</span>}
      <span className="dep-dati">
        {fmtCollegio(d.collegio)}
        {d.voti ? <><br /><b>{fmtNum(d.voti)}</b> preferenze</> : null}
      </span>
      {incarico && <span className="dep-ruolo">{incarico}</span>}
      <span className="dep-vai">Vedi profilo →</span>
    </Link>);
}
