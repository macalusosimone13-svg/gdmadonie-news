import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useSEO } from '@/lib/useSEO';
import { Caricamento, Segnala } from '@/components/ars/ArsComuni';
import { SITE, fmtData, linkAtto } from '@/lib/ars';

export default function Deputati() {
  useSEO({
    title: "Chi ci rappresenta all'ARS: i deputati eletti nel collegio di Palermo — GD Madonie News",
    description: "I deputati regionali eletti nel collegio di Palermo, che comprende le Madonie: gruppo, incarichi e ultime domande presentate al Governo. E tutti i 70 deputati dell'ARS.",
    url: `${SITE}/ars/deputati`,
  });
  const [tutti, setTutti] = useState(false);
  const [gruppo, setGruppo] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['ars-deputati'],
    staleTime: 30 * 60 * 1000,
    queryFn: async () => (await supabase.from('ars_deputati').select('*').eq('in_carica', true).order('nome')).data || [],
  });
  const gruppi = useMemo(() => [...new Set((data || []).map((d) => d.gruppo_breve || d.gruppo).filter(Boolean))].sort(), [data]);
  if (isLoading) return <Caricamento righe={3} alt={180} />;
  const palermo = (data || []).filter((d) => d.palermo);
  const elenco = (data || []).filter((d) => !gruppo || (d.gruppo_breve || d.gruppo) === gruppo);

  return (
    <div className="view">
      <section>
        <div className="sec-h"><h1 style={{ fontSize: 'clamp(26px,5vw,40px)', textTransform: 'uppercase', fontWeight: 900 }}>Chi ci rappresenta</h1></div>
        <p className="sub">Le Madonie votano nel collegio di Palermo. Questi sono i {palermo.length} deputati regionali eletti qui e ancora in carica, con i loro incarichi e le ultime domande che hanno presentato al Governo.</p>
        <div className="deps">{palermo.map((d) => <Scheda key={d.nome} d={d} />)}</div>
      </section>
      <section>
        <div className="sec-h"><h2>Tutti i deputati ({(data || []).length})</h2><button type="button" className="linkbtn" onClick={() => setTutti((x) => !x)}>{tutti ? 'Nascondi' : 'Mostra'}</button></div>
        {tutti &&
          <>
            <div className="chips" role="group" aria-label="Gruppo" style={{ marginBottom: 12 }}>
              {['', ...gruppi].map((g) => <button key={g || 'tutti'} type="button" className="chip" aria-pressed={gruppo === g} onClick={() => setGruppo(g)}>{g || 'Tutti i gruppi'}</button>)}
            </div>
            <div className="deps">{elenco.map((d) => <Scheda key={d.nome} d={d} breve />)}</div>
          </>}
      </section>
      <div className="sources">Fonte: schede dei deputati sul sito dell'ARS, aggiornate ogni giorno. Mostriamo gli incarichi in corso, non classifiche: il numero di atti presentati non dice quanto lavora un deputato. <Segnala pagina="/ars/deputati" /></div>
    </div>);
}

function Scheda({ d, breve }) {
  const assessore = (d.ruoli || []).some((r) => /^Assessore/i.test(r));
  return (
    <article className="dep">
      <span className="pill plain">{d.gruppo_breve || d.gruppo || 'Gruppo non indicato'}</span>
      <h3 className="plain">{d.nome}</h3>
      <div style={{ fontSize: 14, color: 'var(--a-muted)' }}>{d.lista ? `Eletto nella lista ${d.lista}` : ''}{d.voti ? ` con ${Number(d.voti).toLocaleString('it-IT')} preferenze` : ''}{d.collegio && !d.palermo ? ` · collegio ${d.collegio}` : ''}</div>
      {(d.ruoli || []).length > 0 && <ul className="roles">{d.ruoli.slice(0, breve ? 2 : 4).map((r) => <li key={r}>{r}</li>)}</ul>}
      {assessore && <p style={{ fontSize: 13, color: 'var(--a-muted)' }}>Da assessore risponde alle domande dei deputati invece di presentarle.</p>}
      {!breve && (d.recenti || []).length > 0 &&
        <div className="recent">
          <span className="eyebrow">Ultime domande presentate</span>
          {d.recenti.map((a) => <Link key={a.k} to={linkAtto(a.k)}>{a.titolo}<span style={{ color: 'var(--a-muted)', fontWeight: 400 }}> · {fmtData(a.data, true)}</span></Link>)}
        </div>}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 14 }}>
        <Link to={`/ars/domande?firmatario=${encodeURIComponent(d.nome)}&tipo=tutto`} className="linkbtn">I suoi atti →</Link>
        {d.url && <a href={d.url} target="_blank" rel="noopener noreferrer" className="linkbtn">Scheda ufficiale ↗</a>}
      </div>
    </article>);
}
