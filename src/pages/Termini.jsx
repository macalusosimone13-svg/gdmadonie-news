import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSEO } from '@/lib/useSEO';

export default function Termini() {
  useSEO({
    title: 'Termini di Servizio — GD Madonie News',
    description: 'Termini e condizioni di utilizzo di GD Madonie News.',
    type: 'website'
  });

  return (
    <div>
      <div className="page-head"><div className="hero-glow" /><div className="wrap-wide">
        <span className="section-kicker">Giovani Democratici Madonie</span>
        <h1>TERMINI DI SERVIZIO</h1>
      </div></div>
      <div className="wrap" style={{ maxWidth: 820, paddingTop: 36, paddingBottom: 72 }}>
      <div className="prose prose-sm max-w-none text-foreground space-y-4 leading-relaxed legal-text">
        <p><em>Ultimo aggiornamento: 05/09/2026</em></p>
        <h2 className="text-lg font-semibold">Natura del sito</h2>
        <p>GD Madonie News è un sito di informazione gestito da Giovani Democratici Madonie che pubblica comunicati ed eventi propri e aggrega, a scopo informativo, notizie politiche da fonti terze tramite feed RSS pubblici, con link diretto alla fonte originale.</p>
        <h2 className="text-lg font-semibold">Contenuti di terze parti</h2>
        <p>Gli articoli contrassegnati con il nome della testata di provenienza restano di proprietà dei rispettivi editori. GD Madonie News non ne rivendica la paternità e riporta solo titolo ed estratto, rimandando all'articolo completo sul sito originale.</p>
        <h2 className="text-lg font-semibold">Limitazione di responsabilità</h2>
        <p>GD Madonie News non è responsabile per l'accuratezza dei contenuti pubblicati da fonti terze aggregate.</p>
      </div>
      </div>
    </div>
  );
}
