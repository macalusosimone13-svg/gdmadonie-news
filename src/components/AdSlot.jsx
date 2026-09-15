import { useEffect, useRef } from 'react';

// format="auto" -> annuncio display classico (usato in Rassegna/Articolo).
// format="fluid" + layoutKey -> annuncio nativo "in-feed", si integra nella
// lista di contenuti (usato nel feed della Home).
export default function AdSlot({ slot = '0000000000', format = 'auto', layoutKey, className = '' }) {
  const ref = useRef(null);

  useEffect(() => {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {}
  }, []);

  const isFluid = format === 'fluid';

  return (
    <div className={`w-full overflow-hidden ${className}`} aria-label="Pubblicità">
      <ins
        ref={ref}
        className="adsbygoogle"
        style={{ display: 'block', minHeight: isFluid ? undefined : 90 }}
        data-ad-client="ca-pub-2127033257720549"
        data-ad-slot={slot}
        data-ad-format={format}
        {...(isFluid ? { 'data-ad-layout-key': layoutKey } : { 'data-full-width-responsive': 'true' })}
      />
    </div>);

}
