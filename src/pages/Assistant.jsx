import AssistantChat from '@/components/AssistantChat';

export default function Assistant() {
  return (
    <div>
      <div className="page-head"><div className="hero-glow" /><div className="wrap-wide">
        <span className="section-kicker">Chiedi al circolo</span>
        <h1>ASSISTENTE EVENTI</h1>
        <p>Scopri gli eventi e registrati con una chat.</p>
      </div></div>
      <div className="wrap" style={{ maxWidth: 820, paddingTop: 30, paddingBottom: 72 }}>
        <AssistantChat title="Assistente Eventi" />
      </div>
    </div>);

}
