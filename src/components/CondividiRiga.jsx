import { useState } from 'react';
import { Share2 } from 'lucide-react';

// Riga "Condividi" per le pagine dei paesi. Sul telefono: "Invia" (apre la
// condivisione del telefono: Instagram, Telegram...), WhatsApp, copia link.
// Da computer: WhatsApp, Facebook, copia link.
export default function CondividiRiga({ url, title, testoWa, label = 'Condividi' }) {
  const [copiato, setCopiato] = useState(false);
  const puoCondividere = typeof navigator !== 'undefined' && !!navigator.share;
  const wa = `https://wa.me/?text=${encodeURIComponent(testoWa || `${title}\n${url}`)}`;
  const fb = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;

  const copia = async () => {
    try { await navigator.clipboard.writeText(url); } catch {
      const t = document.createElement('textarea'); t.value = url; document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); } catch {} t.remove();
    }
    setCopiato(true); setTimeout(() => setCopiato(false), 2200);
  };
  const nativo = async () => {
    try { await navigator.share({ title, url }); } catch (e) { if (e?.name !== 'AbortError') copia(); }
  };

  return (
    <div className="share-row">
      <span className="share-label"><Share2 className="w-4 h-4" /> {label}</span>
      {puoCondividere && <button type="button" onClick={nativo} className="share-btn share-primary"><Share2 className="w-4 h-4" /> Invia</button>}
      <a href={wa} target="_blank" rel="noopener noreferrer" className={`share-btn${puoCondividere ? '' : ' share-primary'}`}>WhatsApp</a>
      {!puoCondividere && <a href={fb} target="_blank" rel="noopener noreferrer" className="share-btn">Facebook</a>}
      <button type="button" onClick={copia} className="share-btn">{copiato ? 'Link copiato ✓' : 'Copia link'}</button>
    </div>);
}
