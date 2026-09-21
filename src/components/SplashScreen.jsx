import { useEffect, useState } from 'react';

const SPLASH_KEY = 'mn_splash_seen';
const HOLD_MS = 2200;
const FADE_MS = 600;

// Splash del redesign: wordmark testuale blu/navy, coerente con l'header.
// Nessuna immagine (il vecchio logo aveva l'arancione) e nessuna lettura
// della configurazione salvata dall'admin.
export default function SplashScreen() {
  const [phase, setPhase] = useState('hold'); // 'hold' | 'fade' | 'done'

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SPLASH_KEY)) { setPhase('done'); return; }
      sessionStorage.setItem(SPLASH_KEY, '1');
    } catch (e) { /* storage non disponibile: mostra comunque */ }
    const t1 = setTimeout(() => setPhase('fade'), HOLD_MS);
    const t2 = setTimeout(() => setPhase('done'), HOLD_MS + FADE_MS);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (phase === 'done') return null;

  return (
    <div className={`mn-splash ${phase === 'fade' ? 'is-fading' : ''}`} aria-hidden="true">
      <div className="mn-splash-glow" />
      <div className="mn-splash-inner">
        <div className="mn-splash-logo">GD MADONIE<span>NEWS</span></div>
        <p className="mn-splash-tag">L'informazione dei Giovani Democratici delle Madonie</p>
      </div>
      <div className="mn-splash-bar"><i /></div>
    </div>
  );
}
