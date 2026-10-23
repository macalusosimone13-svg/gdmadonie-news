import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useSEO } from '@/lib/useSEO';
import { useJsonLd } from '@/lib/useJsonLd';
import { AttoRiga, Avvisami, Caricamento, Emiciclo, Segnala, Termine } from '@/components/ars/ArsComuni';
import { COMUNI, SITE, TIPI, fmtData, giornoMese, linkAtto, linkLegge, nomeCommissione, titoloLegge } from '@/lib/ars';

export function usePanoramica() {
  return useQuery({
    queryKey: ['ars-panoramica'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('ars_panoramica');
      if (error) throw error;
      return data;
    },
  });
}

const n = (x) => Number(x || 0).toLocaleString('it-IT');

export default function Panoramica() {
  useSEO({
    title: "ARS: leggi, voti e domande al Governo spiegati semplici — GD Madonie News",
    description: "Cosa decide l'Assemblea Regionale Siciliana: leggi approvate, voti in Aula, interrogazioni e risposte del Governo, commissioni. Aggiornato in automatico, con una ricerca che risponde a qualsiasi domanda.",
    url: `${SITE}/ars`,
  });
  useJsonLd({
    '@context': 'https://schema.org', '@type': 'CollectionPage', name: "Cosa decide l'ARS", url: `${SITE}/ars`, inLanguage: 'it-IT',
    about: { '@type': 'GovernmentOrganization', name: 'Assemblea Regionale Siciliana', url: 'https://www.ars.sicilia.it' },
    isPartOf: { '@type': 'WebSite', name: 'GD Madonie News', url: SITE },
  });
  const { data: p, isLoading } = usePanoramica();
  const [paese, setPaese] = useState('Madonie');
  const { data: locali } = useQuery({
    queryKey: ['ars-paese', paese],
    enabled: paese !== 'Madonie',
    staleTime: 5 * 60 * 1000,
    queryFn: async () => (await supabase.rpc('ars_per_paese', { nome: paese, limite: 6 })).data,
  });

  if (isLoading) return <div className="view"><Caricamento righe={4} alt={160} /></div>;
  if (!p) return <div className="empty">Non riesco a caricare i dati in questo momento. Riprova tra poco.</div>;
  const c = p.conteggi || {};
  const L = p.legge_in_evidenza;
  const ex = L?.extra || {};
  const listaLocale = paese === 'Madonie' ? p.madonie_recenti : locali?.atti;
  const prossime = [...(p.prossime_sedute || []).map((s) => ({ tipo: 'aula', d: s.data, s })), ...(p.prossime_commissioni || []).filter((x) => !x.disdetta).map((x) => ({ tipo: 'comm', d: x.data, x }))].sort((a, b) => a.d.localeCompare(b.d)).slice(0, 5);

  return (
    <div className="view">
      {L &&
        <section aria-labelledby="ultima-legge">
          <div className="sec-h"><h2 id="ultima-legge">L'ultima legge approvata</h2><Link to="/ars/leggi">Tutte le leggi →</Link></div>
          <Link to={linkLegge(L.id)} className="feature">
            <div className="txt">
              <span className="pill ok">✓ Approvata il {fmtData(L.data)}</span>
              <h3>{titoloLegge(L)}</h3>
              {L.titolo_breve && <p className="official">{L.titolo}</p>}
              {Array.isArray(ex.breve) && ex.breve.length > 0 && <ul className="bullets">{ex.breve.map((b) => <li key={b}>{b}</li>)}</ul>}
              <span className="btn" style={{ marginTop: 6 }}>{ex.breve ? 'Cosa cambia, articolo per articolo' : 'Apri la scheda'} →</span>
            </div>
            <div className="vote">
              <div className="eyebrow">Il voto finale in Aula</div>
              <Emiciclo si={L.favorevoli} no={L.contrari} ast={L.astenuti} />
              {ex.voto_nota && <p style={{ fontSize: 14, color: 'var(--a-muted)' }}>{ex.voto_nota}</p>}
            </div>
          </Link>
        </section>}

      <section className="doors" aria-label="Le sezioni">
        <Link to="/ars/leggi" className="door"><span className="big num">{n(c.leggi)}</span><h3>Leggi approvate</h3><p>Dal 2022 a oggi, con il voto e il percorso di ognuna.</p></Link>
        <Link to="/ars/domande" className="door"><span className="big num">{n((c.interrogazioni || 0) + (c.interpellanze || 0))}</span><h3>Domande al Governo</h3><p>Interrogazioni e interpellanze dei deputati.</p></Link>
        <Link to="/ars/domande?risposta=si" className="door"><span className="big num">{n(c.risposte)}</span><h3>Risposte del Governo</h3><p>Scritte o date a voce in Aula, collegate alla domanda.</p></Link>
        <Link to="/ars/aula" className="door"><span className="big num">{n((p.prossime_commissioni || []).length + (p.prossime_sedute || []).length)}</span><h3>In programma</h3><p>Prossime sedute dell'Aula e delle commissioni.</p></Link>
      </section>

      <section className="local" aria-labelledby="madonie">
        <div className="sec-h" style={{ marginBottom: 0 }}>
          <h2 id="madonie">Le <em>Madonie</em> all'ARS</h2>
          <Link to={`/ars/domande?luogo=${encodeURIComponent(paese)}`} style={{ color: 'var(--a-sky)' }}>Vedi tutti ({paese === 'Madonie' ? n(c.madonie) : n(locali?.totale)}) →</Link>
        </div>
        <p style={{ color: 'var(--a-on-navy-muted)' }}>Gli atti che nominano i nostri paesi, Piano Battaglia, il Parco o le strade delle Madonie. Scegli un paese:</p>
        <div className="towns" role="group" aria-label="Paese">
          {['Madonie', ...COMUNI].map((t) => <button key={t} type="button" aria-pressed={paese === t} onClick={() => setPaese(t)}>{t === 'Madonie' ? 'Tutte' : t}</button>)}
        </div>
        <div className="items">
          {(listaLocale || []).slice(0, 6).map((a) =>
            <Link key={a.k} to={linkAtto(a.k)} className="it">
              <small>{TIPI[a.tipo]} n. {a.n} · {fmtData(a.data, true)}</small>
              <strong>{a.titolo}</strong>
              {a.ha_risposta && <span>✓ Il Governo ha risposto</span>}
            </Link>)}
          {paese !== 'Madonie' && locali && !locali.atti?.length && <p style={{ color: 'var(--a-on-navy-muted)' }}>Ancora nessun atto dell'ARS che nomina {paese}. Se ne arriva uno, lo trovi qui.</p>}
        </div>
        <div><Avvisami chiave={`paese:${paese}`} etichetta={paese === 'Madonie' ? 'Avvisami quando l\'ARS parla delle Madonie' : `Avvisami quando l'ARS parla di ${paese}`}
          testo={`Ti scriviamo quando all'ARS viene presentato un atto che nomina ${paese === 'Madonie' ? 'le Madonie o uno dei nostri paesi' : paese}.`} /></div>
      </section>

      <section aria-labelledby="risposte">
        <div className="sec-h"><h2 id="risposte">Le ultime risposte del Governo</h2><Link to="/ars/domande?risposta=si">Tutte →</Link></div>
        <p className="sub">Quando un deputato fa una <Termine k="interrogazione">domanda</Termine>, l'assessore risponde per iscritto o in Aula. Qui trovi domanda e risposta insieme.</p>
        <div className="grid2">{(p.ultime_risposte || []).map((a) => <AttoRiga key={a.k} a={{ ...a, ha_risposta: true }} />)}</div>
      </section>

      {prossime.length > 0 &&
        <section aria-labelledby="prossime">
          <div className="sec-h"><h2 id="prossime">In programma</h2><Link to="/ars/aula">Calendario completo →</Link></div>
          <div className="sessions">
            {prossime.map((x) => {
              const g = giornoMese(x.d);
              return (
                <article key={x.tipo + (x.s?.n || x.x?.id)} className="ses">
                  <div className="date"><b className="num">{g?.g}</b><span>{g?.m}</span></div>
                  <div className="info">
                    {x.tipo === 'aula' ?
                      <><h3 className="plain">Seduta dell'Aula n. {x.s.n}</h3>
                        {x.s.odg?.length > 0 ? <ul className="odg">{x.s.odg.slice(0, 3).map((o) => <li key={o}>{o}</li>)}</ul> : <p style={{ color: 'var(--a-muted)' }}>Ordine del giorno non ancora pubblicato.</p>}</> :
                      <><h3 className="plain">{nomeCommissione(x.x.commissione)}</h3><p style={{ color: 'var(--a-muted)' }}>{x.x.odg.slice(0, 260)}{x.x.odg.length > 260 ? '…' : ''}</p></>}
                  </div>
                </article>);
            })}
          </div>
        </section>}

      <section aria-labelledby="ultimi">
        <div className="sec-h"><h2 id="ultimi">Gli ultimi atti presentati</h2><Link to="/ars/domande">Tutti →</Link></div>
        <div className="grid2">{(p.ultimi_atti || []).map((a) => <AttoRiga key={a.k} a={a} />)}</div>
      </section>

      <section className="how" aria-label="Come funziona">
        <div><b>Da dove arriva</b><p>Ogni 30 minuti leggiamo il sito ufficiale dell'ARS: ordini del giorno, <Termine k="resoconto">resoconti</Termine>, commissioni.</p></div>
        <div><b>Cosa trovi</b><p>{n(c.atti)} atti dal novembre 2022, {n(c.risposte)} risposte del Governo, {n(c.sedute)} sedute, {n(c.convocazioni)} riunioni di commissione.</p></div>
        <div><b>Le spiegazioni</b><p>I riassunti sono scritti dall'intelligenza artificiale dal testo ufficiale: per i dettagli apri sempre il documento.</p></div>
        <div><b>Neutrale</b><p>Qui solo fatti, senza commenti. Le nostre opinioni sono nelle News GD.</p></div>
      </section>
      <div className="sources">Fonte: Assemblea Regionale Siciliana (ars.sicilia.it). Il numero di ogni legge e la data di pubblicazione vanno controllati sulla Gazzetta ufficiale della Regione. <Segnala pagina="/ars" /></div>
    </div>);
}
