import { Children, useCallback, useEffect, useRef, useState } from 'react';

// Riga orizzontale che, quando non c'e' spazio per tutte le voci (telefono),
// si scorre col dito e lo fa capire: sfumatura e freccia sul lato dove ci sono
// altre voci. Se le voci stanno tutte (computer) non mostra nulla di extra.
export default function RigaScorrevole({ as: Tag = 'div', className = '', children, etichettaFreccia = 'Mostra altre voci', chiave = '', ...rest }) {
  const quante = Children.count(children);
  const ref = useRef(null);
  const [lati, setLati] = useState({ sx: false, dx: false });

  const aggiorna = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setLati({ sx: el.scrollLeft > 4, dx: max - el.scrollLeft > 4 });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    // la voce attiva (es. la scheda aperta) deve essere visibile
    const attiva = el.querySelector('.on, [aria-current="page"]');
    if (attiva && el.scrollWidth > el.clientWidth) {
      el.scrollLeft = Math.max(0, attiva.offsetLeft - el.offsetLeft - 24);
    }
    aggiorna();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(aggiorna) : null;
    ro?.observe(el);
    window.addEventListener('resize', aggiorna);
    return () => { ro?.disconnect(); window.removeEventListener('resize', aggiorna); };
  }, [aggiorna, quante, chiave]);

  const scorri = (dir) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.7), behavior: 'smooth' });
  };

  return (
    <div className={`scorri${lati.sx ? ' piu-sx' : ''}${lati.dx ? ' piu-dx' : ''}`}>
      <Tag ref={ref} className={className} onScroll={aggiorna} {...rest}>{children}</Tag>
      {lati.sx && <button type="button" className="scorri-freccia sx" aria-label="Torna alle voci precedenti" onClick={() => scorri(-1)}>‹</button>}
      {lati.dx && <button type="button" className="scorri-freccia dx" aria-label={etichettaFreccia} onClick={() => scorri(1)}>›</button>}
    </div>);
}
