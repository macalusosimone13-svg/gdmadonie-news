import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { fmtData } from '@/lib/ars';
import { linkNotizia } from '@/lib/paesiLink';
import RigaScorrevole from '@/components/ars/RigaScorrevole';

const collegamento = (f) => (f.fonte === 'paese' && f.id.includes('/') ? linkNotizia(f.id.split('/')[0], { id: f.id.split('/')[1], titolo: f.titolo }) : f.link);

// "Chiedi all'ARS": casella nella fascia blu + risposta scritta dall'IA con le fonti.
export const SUGGERITE = [
  ['Ultime leggi', "Quali leggi ha approvato l'ARS di recente e cosa cambiano per i cittadini?"],
  ['Sanità e ospedali', "Cosa si sta facendo all'ARS su ospedali, pronto soccorso e liste d'attesa?"],
  ['Giovani e lavoro', 'Ci sono misure per i giovani e per il lavoro nelle ultime leggi regionali?'],
  ['Strade e trasporti', "Cosa ha deciso l'ARS su strade e trasporti pubblici in Sicilia?"],
  ['Acqua e siccità', "Cosa è stato fatto all'ARS sulla crisi dell'acqua e sulla rete idrica?"],
  ['Bonus e contributi', 'Ci sono bonus o contributi della Regione per famiglie e imprese?'],
  ['Prossime sedute', 'Quali commissioni si riuniscono nei prossimi giorni e di cosa parlano?'],
];

export function CasellaChiedi({ onChiedi, iniziale = '' }) {
  const [q, setQ] = useState(iniziale);
  useEffect(() => { setQ(iniziale); }, [iniziale]);
  const invia = (e) => { e.preventDefault(); if (q.trim().length > 2) onChiedi(q.trim()); };
  return (
    <div className="ask">
      <form onSubmit={invia} role="search">
        <span className="spark" aria-hidden="true">IA</span>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chiedi qualsiasi cosa sull'ARS…" aria-label="Chiedi qualsiasi cosa sull'ARS" autoComplete="off" enterKeyHint="search" maxLength={300} />
        <button type="submit">Chiedi</button>
      </form>
      <RigaScorrevole className="sugg" aria-label="Domande di esempio" etichettaFreccia="Mostra altre domande di esempio">
        {SUGGERITE.map(([lab, dom]) => <button key={lab} type="button" onClick={() => { setQ(dom); onChiedi(dom); }}>{lab}</button>)}
      </RigaScorrevole>
    </div>);
}

export function Risposta({ domanda, onChiudi }) {
  const [stato, setStato] = useState({ caricamento: true });
  const ref = useRef(null);
  useEffect(() => {
    if (!domanda) return;
    let vivo = true;
    setStato({ caricamento: true });
    ref.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    supabase.functions.invoke('ars-cerca', { body: { domanda } })
      .then(({ data, error }) => { if (vivo) setStato(error ? { errore: true } : { dati: data }); })
      .catch(() => { if (vivo) setStato({ errore: true }); });
    return () => { vivo = false; };
  }, [domanda]);
  if (!domanda) return null;
  const d = stato.dati;
  return (
    <section className="answer" ref={ref} aria-live="polite" style={{ scrollMarginTop: 90 }}>
      <div className="q">Hai chiesto: {domanda}</div>
      {stato.caricamento && <div className="thinking"><i /> Cerco in tutti gli atti dell'ARS, nelle risposte del Governo e nelle notizie del sito…</div>}
      {stato.errore && <p className="txt">Non riesco a rispondere in questo momento. Riprova tra poco, oppure cerca negli elenchi qui sotto.</p>}
      {d && (
        <>
          {d.limite && <p className="txt">Hai fatto molte domande di seguito: per qualche minuto ti mostro solo i documenti trovati, senza la risposta scritta.</p>}
          {d.risposta && <p className="txt">{d.risposta}</p>}
          {!d.risposta && !d.limite && d.fonti?.length > 0 && <p className="txt">Ecco i documenti più vicini alla tua domanda.</p>}
          {d.fonti?.length > 0 && (
            <>
              <div className="eyebrow">Le fonti{d.risposta ? ' usate per rispondere' : ''}</div>
              <div className="srcs">
                {d.fonti.map((f) =>
                  <Link key={f.fonte + f.id} to={collegamento(f)} className={`src${f.usata ? ' usata' : ''}`}>
                    <small>{f.etichetta}{f.data ? ' · ' + fmtData(f.data, true) : ''}</small>
                    <b>{f.titolo}</b>
                    {f.fonte === 'atto' && f.risposta && <span>Il Governo ha risposto</span>}
                  </Link>)}
              </div>
            </>)}
          <div className="foot">
            <span>Risposta scritta in automatico dall'intelligenza artificiale leggendo i documenti ufficiali: controlla sempre le fonti.</span>
            <button type="button" className="linkbtn" onClick={onChiudi}>Chiudi</button>
          </div>
        </>)}
    </section>);
}
