import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSEO } from '@/lib/useSEO';

export default function Privacy() {
  useSEO({
    title: 'Privacy Policy — GD Madonie News',
    description: 'Informativa sulla privacy di GD Madonie News.',
    type: 'website'
  });

  return (
    <div>
      <div className="page-head"><div className="hero-glow" /><div className="wrap-wide">
        <span className="section-kicker">Giovani Democratici Madonie</span>
        <h1>PRIVACY POLICY</h1>
      </div></div>
      <div className="wrap" style={{ maxWidth: 820, paddingTop: 36, paddingBottom: 72 }}>
      <div className="prose prose-sm max-w-none text-foreground space-y-4 leading-relaxed legal-text">
        <p><em>Ultimo aggiornamento: [05/09/26]</em></p>

        <h2 className="text-lg font-semibold">Titolare del trattamento</h2>
        <p>Il titolare del trattamento dei dati raccolti tramite questo sito è Giovani Democratici Madonie, contattabile all'indirizzo [gdmadonie@gmail.com].</p>

        <h2 className="text-lg font-semibold">Dati raccolti</h2>
        <p>Il sito raccoglie dati forniti volontariamente dall'utente in fase di registrazione (nome, email) e dati di navigazione tramite cookie tecnici e, se attivi, cookie pubblicitari di terze parti (Google AdSense).</p>

        <h2 className="text-lg font-semibold">Google AdSense e cookie di terze parti</h2>
        <p>Questo sito utilizza Google AdSense per mostrare pubblicità. Google e i suoi partner possono utilizzare cookie per personalizzare gli annunci in base alle visite precedenti dell'utente su questo sito o su altri siti web. Puoi disattivare la pubblicità personalizzata visitando le <a href="https://adssettings.google.com/" target="_blank" rel="noopener noreferrer" className="text-primary underline">Impostazioni annunci di Google</a>.</p>

        <h2 className="text-lg font-semibold">Google Analytics</h2>
        <p>Il sito utilizza Google Analytics per raccogliere statistiche anonime e aggregate sulle visite (pagine viste, provenienza, dispositivo utilizzato), al fine di comprendere come viene usato il sito e migliorarlo. Puoi impedire la raccolta di questi dati installando il <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer" className="text-primary underline">componente aggiuntivo per la disattivazione di Google Analytics</a>.</p>

        <h2 className="text-lg font-semibold">Finalità del trattamento</h2>
        <p>I dati sono trattati per consentire la registrazione e l'accesso all'area riservata, l'invio di notifiche relative a nuovi contenuti ed eventi, e per finalità statistiche e pubblicitarie.</p>

        <h2 className="text-lg font-semibold">Diritti dell'utente</h2>
        <p>L'utente può cancellare in autonomia il proprio account e i dati collegati in qualsiasi momento dalla sezione del proprio profilo, tramite l'opzione "Elimina account". Per richieste di accesso o rettifica dei dati, può scrivere a gdmadonie@gmail.com.</p>
      </div>
      </div>
    </div>
  );
}
