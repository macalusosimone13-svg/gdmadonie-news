import { useSEO } from '@/lib/useSEO';
import AssistantLogo from '@/components/AssistantLogo';
import AssistantChat from '@/components/AssistantChat';

export default function Assistant() {
  // Chat riservata a chi ha un account: niente titolo generico e fuori da Google.
  useSEO({
    title: 'Assistente eventi — GD Madonie News',
    description: 'Chiedi all\'assistente dei Giovani Democratici Madonie quali eventi sono in programma e registrati con una chat.',
    noindex: true
  });
  return (
    <div className="assist-page">
      <div className="assist-side">
        <div className="hero-glow" />
        <AssistantLogo size={64} className="assist-logo" />
        <span className="section-kicker">Chiedi al circolo</span>
        <h1>ASSISTENTE EVENTI</h1>
        <p>Scopri gli eventi e registrati con una chat.</p>
      </div>
      <div className="assist-card">
        <AssistantChat title="Assistente Eventi" />
      </div>
    </div>);

}
