import { useNavigate } from 'react-router-dom';
import { CONFINI, COSTA, MADONIE_W, MADONIE_H } from '@/lib/mappeMadonie';

// Mappe disegnate dei comuni delle Madonie (stile: confini con tratto scuro,
// comuni vicini tratteggiati, il paese in blu). Tutto in SVG dentro il sito:
// nessun servizio di mappe esterno, pesa pochi KB.

function Tratteggio({ id, passo }) {
  return (
    <pattern id={id} patternUnits="userSpaceOnUse" width={passo} height={passo} patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2={passo} stroke="currentColor" strokeOpacity=".32" strokeWidth={passo * 0.2} />
    </pattern>);
}

// Mappa di un singolo paese: inquadrata sul suo territorio, con i comuni
// confinanti tratteggiati attorno e la costa.
export function MappaPaese({ slug, nome, className = '' }) {
  const sel = CONFINI[slug];
  if (!sel) return null;
  const [x0, y0, x1, y1] = sel.b;
  const lato = Math.max(x1 - x0, y1 - y0) * 1.45;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const u = lato / 100;
  const id = `tratteggio-${slug}`;
  return (
    <svg className={`mappa-paese ${className}`} viewBox={`${(cx - lato / 2).toFixed(1)} ${(cy - lato / 2).toFixed(1)} ${lato.toFixed(1)} ${lato.toFixed(1)}`} role="img" aria-label={`Mappa del territorio di ${nome}`}>
      <defs>
        <Tratteggio id={id} passo={u * 1.6} />
        {/* i comuni attorno sfumano verso i bordi, cosi' la mappa non sembra un ritaglio */}
        <radialGradient id={`${id}-sfuma`}>
          <stop offset="55%" stopColor="#fff" />
          <stop offset="100%" stopColor="#000" />
        </radialGradient>
        <mask id={`${id}-maschera`} maskUnits="userSpaceOnUse" x={cx - lato / 2} y={cy - lato / 2} width={lato} height={lato}>
          <rect x={cx - lato / 2} y={cy - lato / 2} width={lato} height={lato} fill={`url(#${id}-sfuma)`} />
        </mask>
      </defs>
      <g mask={`url(#${id}-maschera)`}>
        <path d={COSTA} fill="none" stroke="currentColor" strokeWidth={u * 0.4} />
        {Object.entries(CONFINI).filter(([s]) => s !== slug).map(([s, c]) =>
          <path key={s} d={c.d} fill={`url(#${id})`} stroke="currentColor" strokeOpacity=".5" strokeWidth={u * 0.35} strokeLinejoin="round" />)}
      </g>
      <path d={sel.d} className="mappa-sel" strokeWidth={u * 0.7} strokeLinejoin="round" />
    </svg>);
}

// Mappa di tutte le Madonie: ogni comune si puo' toccare per aprire la sua pagina.
export function MappaMadonie({ nomi = {}, className = '' }) {
  const navigate = useNavigate();
  const pad = 30;
  return (
    <svg className={`mappa-paese mappa-madonie ${className}`} viewBox={`${-pad} ${-pad} ${MADONIE_W + pad * 2} ${MADONIE_H + pad * 2}`} role="img" aria-label="Mappa dei comuni delle Madonie">
      <defs><Tratteggio id="tratteggio-madonie" passo={9} /></defs>
      <path d={COSTA} fill="none" stroke="currentColor" strokeWidth="2" />
      {Object.entries(CONFINI).map(([s, c]) =>
        <path key={s} d={c.d} className="mappa-comune" fill="url(#tratteggio-madonie)" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"
          tabIndex={0} role="link" aria-label={nomi[s] || s}
          onClick={() => navigate(`/paesi/${s}`)}
          onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/paesi/${s}`); }}>
          <title>{nomi[s] || s}</title>
        </path>)}
    </svg>);
}
