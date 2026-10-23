import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useSEO } from '@/lib/useSEO';
import { Caricamento, Segnala, Termine } from '@/components/ars/ArsComuni';
import { SITE, fmtData, giornoMese, oggiRoma } from '@/lib/ars';

export default function Aula() {
  useSEO({
    title: "Calendario dell'ARS: sedute dell'Aula e commissioni — GD Madonie News",
    description: "Quando si riunisce l'Assemblea Regionale Siciliana e di cosa si parla: prossime sedute dell'Aula, ordini del giorno, commissioni convocate. Aggiornato in automatico.",
    url: `${SITE}/ars/aula`,
  });
  const oggi = oggiRoma();
  const [comm, setComm] = useState('');
  const [mostraPassate, setMostraPassate] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['ars-aula', oggi],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const da = new Date(Date.now() - 21 * 86400_000).toISOString().slice(0, 10);
      const [fut, pas, conv] = await Promise.all([
        supabase.from('ars_sedute').select('n, data, giorni, odg, odg_url, res_url').gte('data', oggi).eq('tolta', false).order('data'),
        supabase.from('ars_sedute').select('n, data, giorni, odg, odg_url, res_url, provvisorio').lt('data', oggi).order('n', { ascending: false }).limit(8),
        supabase.from('ars_convocazioni').select('id, data, foglio, commissione, odg, disdetta').gte('data', da).eq('tolta', false).order('data').order('foglio'),
      ]);
      return { future: fut.data || [], passate: pas.data || [], conv: conv.data || [] };
    },
  });
  const commissioni = useMemo(() => [...new Set((data?.conv || []).map((c) => c.commissione))].sort(), [data]);
  if (isLoading) return <Caricamento righe={4} alt={120} />;
  const conv = (data?.conv || []).filter((c) => !comm || c.commissione === comm);
  const prossime = conv.filter((c) => c.data >= oggi);
  const recenti = conv.filter((c) => c.data < oggi).reverse();

  return (
    <div className="view">
      <section>
        <div className="sec-h"><h1 style={{ fontSize: 'clamp(26px,5vw,40px)', textTransform: 'uppercase', fontWeight: 900 }}>In Aula</h1></div>
        <p className="sub">Le sedute dell'Assemblea con l'<Termine k="odg">ordine del giorno</Termine>. Il <Termine k="resoconto">resoconto</Termine> arriva qualche giorno dopo.</p>
        <div className="sessions">
          {data.future.length === 0 && <div className="empty">Nessuna seduta dell'Aula ancora convocata nei prossimi giorni. Il calendario si aggiorna da solo.</div>}
          {data.future.map((s) => <Seduta key={s.n} s={s} futura />)}
        </div>
      </section>

      <section>
        <div className="sec-h"><h2>Le commissioni</h2></div>
        <p className="sub">Prima di arrivare in Aula, le proposte di legge passano dalle <Termine k="commissione">commissioni</Termine>. Qui ci sono le riunioni convocate.</p>
        <div className="filters" style={{ marginBottom: 12 }}>
          <label>Commissione
            <select value={comm} onChange={(e) => setComm(e.target.value)}>
              <option value="">Tutte</option>
              {commissioni.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        </div>
        <div className="convs">
          {prossime.length === 0 && <div className="empty">Nessuna riunione convocata nei prossimi giorni{comm ? ' per questa commissione' : ''}.</div>}
          {prossime.map((c) => <Conv key={c.id} c={c} />)}
        </div>
        {recenti.length > 0 &&
          <div style={{ marginTop: 14 }}>
            <button type="button" className="linkbtn" onClick={() => setMostraPassate((x) => !x)}>{mostraPassate ? 'Nascondi' : 'Mostra'} le riunioni delle ultime tre settimane ({recenti.length})</button>
            {mostraPassate && <div className="convs" style={{ marginTop: 10 }}>{recenti.map((c) => <Conv key={c.id} c={c} />)}</div>}
          </div>}
      </section>

      <section>
        <div className="sec-h"><h2>Le ultime sedute</h2></div>
        <div className="sessions">{data.passate.map((s) => <Seduta key={s.n} s={s} />)}</div>
      </section>
      <div className="sources">Fonte: calendario e convocazioni pubblicati sul sito dell'ARS (ars.sicilia.it, dati.ars.sicilia.it). <Segnala pagina="/ars/aula" /></div>
    </div>);
}

function Seduta({ s, futura }) {
  const g = giornoMese(s.data);
  const giorni = (s.giorni || []).length > 1 ? `${giornoMese(s.giorni[0])?.g}–${giornoMese(s.giorni[s.giorni.length - 1])?.g}` : g?.g;
  return (
    <article className="ses">
      <div className="date"><b className="num">{giorni}</b><span>{g?.m} {g?.a}</span></div>
      <div className="info">
        <h3 className="plain">Seduta n. {s.n}{futura ? '' : ` · ${fmtData(s.data)}`}</h3>
        {s.odg?.length > 0 ? <ul className="odg">{s.odg.slice(0, 6).map((o) => <li key={o}>{o}</li>)}</ul> : <p style={{ color: 'var(--a-muted)' }}>Ordine del giorno non ancora pubblicato.</p>}
        <div className="links">
          {s.odg_url && <a href={s.odg_url} target="_blank" rel="noopener noreferrer">Ordine del giorno (PDF) ↗</a>}
          {s.res_url && <a href={s.res_url} target="_blank" rel="noopener noreferrer">Resoconto{s.provvisorio ? ' provvisorio' : ''} ↗</a>}
        </div>
      </div>
    </article>);
}

function Conv({ c }) {
  return (
    <div className={`conv${c.disdetta ? ' off' : ''}`}>
      <div className="cd"><b>{fmtData(c.data)}</b><span>{c.commissione}</span></div>
      <p>{c.odg.replace(/^DISDETTA\s*/, '')}</p>
      {c.disdetta && <span className="pill warn">Annullata</span>}
    </div>);
}
