import { Link } from 'react-router-dom';
import { useLinkIndietro } from '@/lib/indietro';

// Link "torna a ..." (es. "Tutti i paesi", "Tutti i deputati"): se si arriva
// proprio da quella pagina, torna indietro nella cronologia, cosi' si
// ritrovano filtri e punto della pagina dove si era; altrimenti apre la
// pagina normalmente.
export default function LinkIndietro({ to, onClick, ...rest }) {
  const indietro = useLinkIndietro();
  return <Link to={to} onClick={(e) => { onClick?.(e); indietro(e, to); }} {...rest} />;
}
