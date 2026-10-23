import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { GLOSSARIO, TIPI, cognomi, fmtData, linkAtto } from '@/lib/ars';

// Pezzi comuni della sezione ARS.

// Parola del glossario: sottolineata, al tocco si apre la spiegazione.
export function Termine({ k, children }) {
  const [aperto, setAperto] = useState(false);
  const g = GLOSSARIO[k];
  if (!g) return children;
  return (
    <>
      <button type="button" className="term" onClick={() => setAperto(true)} aria-haspopup="dialog">{children}</button>
      {aperto && <Finestra titolo={g[0]} onClose={() => setAperto(false)}><p>{g[1]}</p></Finestra>}
    </>);
}

// Finestra in basso (sul telefono si raggiunge col pollice).
export function Finestra({ titolo, children, onClose, azioni }) {
  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <div className="ars">
      <div className="ars-overlay" onClick={onClose} />
      <div className="ars-pop" role="dialog" aria-modal="true" aria-label={titolo}>
        <div className="in">
          <b className="h">{titolo}</b>
          {children}
          <div className="row2">{azioni}<button type="button" className="btn ghost small" onClick={onClose}>Chiudi</button></div>
        </div>
      </div>
    </div>);
}

// Parola chiave del tipo di atto, con spiegazione al tocco.
const TIPO_KEY = { I: 'interrogazione', P: 'interpellanza', M: 'mozione', D: 'ddl' };
export function TipoAtto({ tipo, n }) {
  return <span className="pill blue"><Termine k={TIPO_KEY[tipo]}>{TIPI[tipo]}</Termine>{n ? ` n. ${n}` : ''}</span>;
}

// Riga di un atto negli elenchi.
export function AttoRiga({ a, mostraLuoghi = true }) {
  const risp = a.ha_risposta;
  const luoghi = (a.luoghi || []).filter((l) => l !== 'Madonie').slice(0, 3);
  return (
    <Link to={linkAtto(a.k)} className="row">
      <div className="top">
        <span className="pill blue">{TIPI[a.tipo]} n. {a.n}</span>
        {risp && <span className="pill ok">Il Governo ha risposto</span>}
        {mostraLuoghi && luoghi.map((l) => <span key={l} className="pill plain">{l}</span>)}
      </div>
      <b className="t">{a.titolo}</b>
      <div className="meta">{fmtData(a.data)}{a.firmatari?.length ? ` · ${cognomi(a.firmatari)}` : ''}{a.gruppo ? ` (${a.gruppo})` : ''}</div>
    </Link>);
}

// Emiciclo: un pallino per ogni seggio (70 all'ARS).
export function Emiciclo({ si = 0, no = 0, ast = 0, seggi = 70 }) {
  const rows = [10, 13, 15, 16, 16];
  const seats = [];
  rows.forEach((n, r) => {
    const R = 52 + r * 13;
    for (let i = 0; i < n; i++) {
      const a = Math.PI - (Math.PI * (i + 0.5)) / n;
      seats.push({ x: 150 + R * Math.cos(a), y: 140 - R * Math.sin(a), a });
    }
  });
  seats.sort((p, q) => q.a - p.a);
  const col = (i) => (i < si ? 'var(--a-ok)' : i < si + no ? 'var(--a-no)' : i < si + no + ast ? 'var(--a-warn)' : 'var(--a-seat)');
  return (
    <figure style={{ margin: 0, display: 'grid', gap: 10, justifyItems: 'center' }}>
      <svg className="hemi" viewBox="0 0 300 150" role="img" aria-label={`${si} favorevoli, ${no} contrari, ${ast} astenuti su ${seggi} deputati`}>
        {seats.slice(0, seggi).map((s, i) => <circle key={i} cx={s.x.toFixed(1)} cy={s.y.toFixed(1)} r="4.6" fill={col(i)} />)}
      </svg>
      <figcaption className="legend">
        <span><i className="dot" style={{ background: 'var(--a-ok)' }} /><b className="num">{si}</b> sì</span>
        <span><i className="dot" style={{ background: 'var(--a-no)' }} /><b className="num">{no}</b> no</span>
        <span><i className="dot" style={{ background: 'var(--a-warn)' }} /><b className="num">{ast}</b> astenuti</span>
      </figcaption>
    </figure>);
}

// "Avvisami": email quando succede qualcosa (nuovo atto su un paese, risposta del Governo, nuove leggi).
export function Avvisami({ chiave, etichetta, testo, compatto = false }) {
  const [aperto, setAperto] = useState(false);
  const [email, setEmail] = useState('');
  const [stato, setStato] = useState(null);
  const [trappola, setTrappola] = useState('');
  const invia = async (e) => {
    e.preventDefault();
    setStato('invio');
    try {
      const { data, error } = await supabase.functions.invoke('ars-avvisi', { body: { azione: 'iscrivi', email, chiave, trappola } });
      if (error || !data?.ok) throw new Error(data?.error || 'errore');
      setStato('ok');
    } catch (err) {
      setStato(err.message && err.message !== 'errore' ? err.message : 'Non è stato possibile iscriverti. Riprova tra poco.');
    }
  };
  return (
    <>
      <button type="button" className={`btn ${compatto ? 'ghost small' : 'ghost'}`} onClick={() => { setAperto(true); setStato(null); }}>🔔 {etichetta || 'Avvisami'}</button>
      {aperto &&
        <Finestra titolo="Avvisami" onClose={() => setAperto(false)}>
          {stato === 'ok' ?
            <p>Fatto. Ti abbiamo mandato un'email: apri il link per confermare. Senza conferma non riceverai nulla.</p> :
            <form onSubmit={invia} style={{ display: 'grid', gap: 10 }}>
              <p>{testo || 'Ti scriviamo una email quando succede qualcosa. Niente pubblicità, ti cancelli con un clic.'}</p>
              <input className="field" type="email" required placeholder="La tua email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" style={{ fontSize: 16 }} />
              <input type="text" tabIndex={-1} autoComplete="off" value={trappola} onChange={(e) => setTrappola(e.target.value)} style={{ position: 'absolute', left: '-9999px' }} aria-hidden="true" />
              <button className="btn" type="submit" disabled={stato === 'invio'}>{stato === 'invio' ? 'Invio…' : 'Iscrivimi'}</button>
              {stato && stato !== 'invio' && <p style={{ color: 'var(--a-no)' }}>{stato}</p>}
              <p style={{ fontSize: 13 }}>Usiamo l'email solo per questi avvisi. <Link to="/privacy">Privacy</Link></p>
            </form>}
        </Finestra>}
    </>);
}

// "Segnala un errore": finisce nella casella del pannello Admin.
export function Segnala({ pagina }) {
  const [aperto, setAperto] = useState(false);
  const [testo, setTesto] = useState('');
  const [contatto, setContatto] = useState('');
  const [trappola, setTrappola] = useState('');
  const [stato, setStato] = useState(null);
  const invia = async (e) => {
    e.preventDefault();
    setStato('invio');
    const { data, error } = await supabase.rpc('ars_segnala', { p_pagina: pagina || window.location.pathname, p_testo: testo, p_contatto: contatto || null, p_trappola: trappola || null });
    if (error || !data?.ok) setStato(data?.error || 'Non è stato possibile inviare. Riprova tra poco.');
    else setStato('ok');
  };
  return (
    <>
      <button type="button" className="linkbtn" onClick={() => { setAperto(true); setStato(null); }}>Hai trovato un errore? Segnalalo</button>
      {aperto &&
        <Finestra titolo="Segnala un errore" onClose={() => setAperto(false)}>
          {stato === 'ok' ? <p>Grazie! La redazione controlla e corregge. Le correzioni restano scritte nella pagina.</p> :
            <form onSubmit={invia} style={{ display: 'grid', gap: 10 }}>
              <p>Cosa non torna? (un titolo sbagliato, un paese che non c'entra, una data…)</p>
              <textarea className="field" rows={4} required minLength={5} value={testo} onChange={(e) => setTesto(e.target.value)} style={{ fontSize: 16 }} />
              <input className="field" placeholder="Email o telefono, se vuoi una risposta (facoltativo)" value={contatto} onChange={(e) => setContatto(e.target.value)} style={{ fontSize: 16 }} />
              <input type="text" tabIndex={-1} autoComplete="off" value={trappola} onChange={(e) => setTrappola(e.target.value)} style={{ position: 'absolute', left: '-9999px' }} aria-hidden="true" />
              <button className="btn" type="submit" disabled={stato === 'invio'}>{stato === 'invio' ? 'Invio…' : 'Invia'}</button>
              {stato && stato !== 'invio' && <p style={{ color: 'var(--a-no)' }}>{stato}</p>}
            </form>}
        </Finestra>}
    </>);
}

export function Caricamento({ righe = 3, alt = 90 }) {
  return <div className="rows" aria-busy="true">{Array.from({ length: righe }).map((_, i) => <div key={i} className="skel" style={{ minHeight: alt }} />)}</div>;
}

export function Fonte({ children }) {
  return <p className="sources">{children}</p>;
}
