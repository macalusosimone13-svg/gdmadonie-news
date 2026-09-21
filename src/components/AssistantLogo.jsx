// Logo dell'assistente: due cerchi che si incontrano (la comunità) e la scintilla nel mezzo.
export default function AssistantLogo({ size = 20, mono = false, className = '' }) {
  const a = mono ? 'currentColor' : '#0F1B3A';
  const b = mono ? 'currentColor' : '#2F5BD8';
  return (
    <svg className={className} width={size * 1.5} height={size} viewBox="0 0 120 80" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle className="al-a" cx="40" cy="40" r="34" fill={a} opacity={mono ? 0.55 : 1} />
      <circle cx="80" cy="40" r="34" fill={b} opacity={mono ? 0.55 : 0.85} />
      <path d="M60 22Q60 40 78 40Q60 40 60 58Q60 40 42 40Q60 40 60 22Z" fill="#fff" />
    </svg>
  );
}
