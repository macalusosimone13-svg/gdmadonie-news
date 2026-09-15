import { useRef, useState, useEffect } from 'react';

// Anteprima video lazy per il feed: segnaposto nero finché la card non entra
// in viewport, poi carica solo i metadata (frame iniziale). Così non si
// scaricano i metadata di tutti i video della lista contemporaneamente.
export default function LazyVideo({ src, poster, className = '', videoClassName = '' }) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true);
        io.disconnect();
      }
    }, { rootMargin: '300px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={`bg-black overflow-hidden ${className}`}>
      {inView && <video src={src} poster={poster} muted playsInline preload={poster ? 'none' : 'metadata'} className={videoClassName} />}
    </div>
  );
}
