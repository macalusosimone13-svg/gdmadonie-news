import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useSEO } from '@/lib/useSEO';
import { CheckCircle2, Loader2 } from 'lucide-react';

// Pagina "Partecipa": modulo vero al posto della sola email. Le richieste
// finiscono nel pannello Admin (sezione "Richieste dal sito"). Si salva
// passando dalla funzione del database invia_richiesta_partecipa, che
// controlla i campi e limita gli invii ripetuti (anti-spam).

const TIPI = [
  { id: 'iscrizione', label: 'Voglio iscrivermi', hint: 'Entra nei Giovani Democratici delle Madonie.' },
  { id: 'segnalazione', label: 'Segnalo un problema', hint: 'Strade, trasporti, sanità, servizi del tuo comune.' },
  { id: 'proposta', label: 'Propongo una notizia', hint: 'Un tema, un\'inchiesta, un fatto da raccontare.' },
  { id: 'altro', label: 'Altro', hint: 'Qualsiasi altra cosa vuoi dirci.' },
];

const COMUNI = ['Alimena', 'Aliminusa', 'Blufi', 'Bompietro', 'Caltavuturo', 'Campofelice di Roccella', 'Castelbuono', 'Castellana Sicula', 'Cefalù', 'Collesano', 'Gangi', 'Geraci Siculo', 'Gratteri', 'Isnello', 'Lascari', 'Petralia Soprana', 'Petralia Sottana', 'Polizzi Generosa', 'Pollina', 'Resuttano', 'San Mauro Castelverde', 'Scillato', 'Sclafani Bagni', 'Valledolmo'];

const labelStyle = { display: 'block', fontWeight: 700, fontSize: 14, marginTop: 14 };

export default function Partecipa() {
  useSEO({
    title: 'Partecipa — GD Madonie News',
    description: 'Iscriviti ai Giovani Democratici Madonie, segnala un problema del tuo comune o proponi una notizia.',
    type: 'website'
  });

  const [tipo, setTipo] = useState('iscrizione');
  const [nome, setNome] = useState('');
  const [comune, setComune] = useState('');
  const [contatto, setContatto] = useState('');
  const [messaggio, setMessaggio] = useState('');
  const [consenso, setConsenso] = useState(false);
  const [trappola, setTrappola] = useState('');
  const [stato, setStato] = useState('idle'); // idle | invio | ok
  const [errore, setErrore] = useState('');

  const serveMessaggio = tipo !== 'iscrizione';

  const invia = async (e) => {
    e.preventDefault();
    setErrore('');
    if (!consenso) { setErrore('Per inviare serve il consenso al trattamento dei dati.'); return; }
    setStato('invio');
    try {
      const { data, error } = await supabase.rpc('invia_richiesta_partecipa', {
        p_tipo: tipo, p_nome: nome, p_comune: comune, p_contatto: contatto,
        p_messaggio: messaggio, p_consenso: consenso, p_trappola: trappola
      });
      if (error) throw error;
      if (!data?.ok) { setErrore(data?.error || 'Invio non riuscito. Riprova.'); setStato('idle'); return; }
      setStato('ok');
    } catch {
      setErrore('Invio non riuscito: controlla la connessione e riprova.');
      setStato('idle');
    }
  };

  return (
    <div className="rd-page">
      <div className="page-head"><div className="hero-glow" /><div className="wrap-wide">
        <span className="section-kicker">Giovani Democratici Madonie</span>
        <h1>PARTECIPA</h1>
        <p>Iscriviti al circolo, segnala un problema del tuo comune o proponi una notizia. Ti rispondiamo noi.</p>
      </div></div>

      <div className="wrap" style={{ maxWidth: 720, paddingTop: 36, paddingBottom: 72 }}>
        {stato === 'ok' ?
        <div className="side-box" style={{ textAlign: 'center', padding: '40px 24px' }}>
            <CheckCircle2 style={{ width: 48, height: 48, color: 'var(--acc)', margin: '0 auto 12px' }} />
            <h2 style={{ fontSize: 26, marginBottom: 8 }}>GRAZIE!</h2>
            <p style={{ opacity: .8, lineHeight: 1.5, margin: '0 auto 20px', maxWidth: '40ch' }}>
              Abbiamo ricevuto la tua richiesta. Ti ricontattiamo al più presto a {contatto}.
            </p>
            <Link to="/" className="btn-pill" style={{ background: 'var(--blu)', color: '#fff' }}>Torna al Feed</Link>
          </div> :

        <form onSubmit={invia} className="side-box" noValidate>
            <span style={{ ...labelStyle, marginTop: 0 }}>Perché ci scrivi?</span>
            <div role="radiogroup" aria-label="Motivo" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
              {TIPI.map((t) =>
            <button key={t.id} type="button" role="radio" aria-checked={tipo === t.id}
            onClick={() => setTipo(t.id)} style={{
              padding: '10px 16px', borderRadius: 999, fontWeight: 700, fontSize: 14, lineHeight: 1.2,
              border: `1.5px solid ${tipo === t.id ? 'var(--acc)' : 'rgba(128,128,128,.35)'}`,
              background: tipo === t.id ? 'var(--acc)' : 'transparent', color: tipo === t.id ? '#fff' : 'inherit'
            }}>{t.label}</button>
            )}
            </div>
            <p style={{ fontSize: 13, opacity: .7, margin: '8px 0 0' }}>{TIPI.find((t) => t.id === tipo)?.hint}</p>

            <label style={labelStyle} htmlFor="pt-nome">Nome e cognome</label>
            <input id="pt-nome" className="nl-input" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} autoComplete="name" required />

            <label style={labelStyle} htmlFor="pt-comune">Comune <span style={{ fontWeight: 400, opacity: .6 }}>(facoltativo)</span></label>
            <input id="pt-comune" className="nl-input" list="pt-comuni" value={comune} onChange={(e) => setComune(e.target.value)} maxLength={60} autoComplete="address-level2" />
            <datalist id="pt-comuni">{COMUNI.map((c) => <option key={c} value={c} />)}</datalist>

            <label style={labelStyle} htmlFor="pt-contatto">Email o telefono</label>
            <input id="pt-contatto" className="nl-input" value={contatto} onChange={(e) => setContatto(e.target.value)} maxLength={120} autoComplete="email" inputMode="email" required />

            <label style={labelStyle} htmlFor="pt-msg">Messaggio {!serveMessaggio && <span style={{ fontWeight: 400, opacity: .6 }}>(facoltativo)</span>}</label>
            <textarea id="pt-msg" className="nl-input" rows={5} value={messaggio} onChange={(e) => setMessaggio(e.target.value)} maxLength={2000}
          placeholder={tipo === 'segnalazione' ? 'Cosa succede, dove, da quanto tempo…' : tipo === 'iscrizione' ? 'Presentati in due righe, se vuoi.' : ''}
          style={{ resize: 'vertical', minHeight: 110 }} />

            {/* campo trappola per i bot: invisibile alle persone */}
            <input type="text" name="sito_web" value={trappola} onChange={(e) => setTrappola(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true"
          style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }} />

            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, lineHeight: 1.45, marginTop: 14, cursor: 'pointer' }}>
              <input type="checkbox" checked={consenso} onChange={(e) => setConsenso(e.target.checked)} style={{ marginTop: 3, width: 18, height: 18, flexShrink: 0 }} />
              <span>Acconsento al trattamento dei dati per essere ricontattato dai Giovani Democratici Madonie, come descritto nella <Link to="/privacy" style={{ color: 'var(--acc)', textDecoration: 'underline' }}>privacy policy</Link>.</span>
            </label>

            {errore && <p role="alert" style={{ color: '#c0392b', fontWeight: 600, fontSize: 14, margin: '14px 0 0' }}>{errore}</p>}

            <button type="submit" className="nl-btn" disabled={stato === 'invio'} style={{ marginTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {stato === 'invio' && <Loader2 className="w-4 h-4 animate-spin" />}
              {stato === 'invio' ? 'Invio…' : 'Invia'}
            </button>
          </form>
        }
      </div>
    </div>);
}
