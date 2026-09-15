import { useRef, useState, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Volume2, VolumeX, Maximize, Minimize, Play, Pause } from 'lucide-react';

const fmt = (s) => {
  if (!s || !isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

// Lettore video con controlli personalizzati (niente controlli nativi).
// Fullscreen CSS-based via un overlay stabile su body: il player viene
// portalizzato una sola volta in un container creato al mount e mai
// smontato, così entrando/uscendo dal fullscreen il nodo <video> non viene
// ricreato e la riproduzione non si blocca. L'overlay viene solo
// riposizionato (sopra lo slot nel carosello, o a tutta pagina in fullscreen).
export default function VideoPlayer({ src, poster, fit = false, natural = false, badge = null }) {
  const videoRef = useRef(null);
  const barRef = useRef(null);
  const dragging = useRef(false);
  const hideTimer = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [fs, setFs] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const slotRef = useRef(null);
  const overlayRef = useRef(null);
  const [hasOverlay, setHasOverlay] = useState(false);

  // Crea una volta sola un container stabile su body.
  useEffect(() => {
    const el = document.createElement('div');
    el.style.position = 'absolute';
    el.style.top = '0';
    el.style.left = '0';
    el.style.zIndex = '30';
    document.body.appendChild(el);
    overlayRef.current = el;
    setHasOverlay(true);
    return () => {el.remove();overlayRef.current = null;};
  }, []);

  // Sincronizza overlay <-> slot. Non-fullscreen: l'overlay viene posizionato
  // esattamente sopra lo slot e l'altezza dello slot segue quella del player
  // (così il layout del carosello non collassa). Fullscreen: overlay a tutta
  // pagina. Il player non viene mai spostato, quindi il video non si blocca.
  useLayoutEffect(() => {
    const overlay = overlayRef.current;
    const slot = slotRef.current;
    if (!hasOverlay || !overlay || !slot) return;

    const sync = () => {
      if (fs) {
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100vw';
        overlay.style.height = '100vh';
        overlay.style.height = '100dvh';
        overlay.style.zIndex = '100';
        return;
      }
      const r = slot.getBoundingClientRect();
      overlay.style.position = 'absolute';
      overlay.style.top = `${r.top + window.scrollY}px`;
      overlay.style.left = `${r.left + window.scrollX}px`;
      overlay.style.width = `${r.width}px`;
      overlay.style.height = natural ? 'auto' : `${r.height}px`;
      overlay.style.zIndex = '30';
      if (natural) {
        const h = overlay.offsetHeight;
        if (h && slot.style.height !== `${h}px`) slot.style.height = `${h}px`;
      }
    };

    sync();
    window.addEventListener('scroll', sync, true);
    window.addEventListener('resize', sync);
    // Defer a rAF per evitare il "ResizeObserver loop" warning: sync legge e
    // scrive layout (offsetHeight/boundingClientRect + altezza slot) e
    // farlo dentro la notifica del observer può innescare un loop.
    let raf = 0;
    const ro = new ResizeObserver(() => {
      if (raf) return;
      raf = requestAnimationFrame(() => {raf = 0;sync();});
    });
    ro.observe(overlay);
    return () => {
      window.removeEventListener('scroll', sync, true);
      window.removeEventListener('resize', sync);
      ro.disconnect();
    };
  }, [hasOverlay, fs, natural, fit]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {}); else v.pause();
  };

  const toggleMute = (e) => {
    e?.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  const seekTo = (clientX) => {
    const v = videoRef.current;
    const bar = barRef.current;
    if (!v || !bar || !duration) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    v.currentTime = ratio * duration;
    setCurrent(ratio * duration);
  };

  const onBarDown = (e) => {
    e.stopPropagation();
    dragging.current = true;
    try {e.currentTarget.setPointerCapture?.(e.pointerId);} catch {}
    seekTo(e.clientX);
  };
  const onBarMove = (e) => {
    if (!dragging.current) return;
    e.stopPropagation();
    seekTo(e.clientX);
  };
  const onBarUp = (e) => {
    if (!dragging.current) return;
    dragging.current = false;
    e.stopPropagation();
  };

  const toggleFullscreen = (e) => {
    e?.stopPropagation();
    setFs((f) => !f);
  };

  // Esc per uscire dal fullscreen; blocca lo scroll del body quando in fullscreen.
  useEffect(() => {
    if (!fs) return;
    const onKey = (e) => {if (e.key === 'Escape') setFs(false);};
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [fs]);

  const flash = () => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setShowControls(false);
    }, 2600);
  };

  useEffect(() => () => {if (hideTimer.current) clearTimeout(hideTimer.current);}, []);

  const remaining = Math.max(0, duration - current);
  const progress = duration ? current / duration * 100 : 0;

  const player =
  <div
    className={`bg-black overflow-hidden select-none ${fs ? 'w-full h-full flex items-center justify-center' : natural ? 'relative w-full flex justify-center' : 'relative w-full h-full'}`}
    onMouseMove={flash}
    onTouchStart={flash}>
    
      <video
      ref={videoRef}
      src={src}
      poster={poster}
      playsInline
      preload="auto"
      className={`bg-black ${fs ? 'max-w-full max-h-full object-contain' : natural ? 'w-full h-auto lg:w-auto lg:max-h-[80vh] lg:max-w-full' : `w-full h-full ${fit ? 'object-contain' : 'object-cover'}`}`}
      onClick={togglePlay}
      onTimeUpdate={(e) => {if (!dragging.current) setCurrent(e.target.currentTime);}}
      onLoadedMetadata={(e) => setDuration(e.target.duration)}
      onPlay={() => {setPlaying(true);flash();}}
      onPause={() => {setPlaying(false);setShowControls(true);}}
      onEnded={() => {setPlaying(false);setShowControls(true);}}
      onWaiting={() => {setBuffering(true);flash();}}
      onPlaying={() => setBuffering(false)}
      onCanPlay={() => setBuffering(false)} />
    

      {/* play/pause centrale (spinner durante il buffering) */}
      <button
      type="button"
      onClick={(e) => {e.stopPropagation();togglePlay();}}
      aria-label={playing ? 'Pausa' : 'Riproduci'}
      className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-white/90 backdrop-blur-sm text-foreground shadow-lg ring-1 ring-black/5 flex items-center justify-center transition-opacity ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      
        {playing ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-1" />}
      </button>

      {/* mute: alto-destra */}
      <button
      type="button"
      onClick={toggleMute}
      aria-label={muted ? 'Attiva audio' : 'Disattiva audio'}
      className={`absolute top-3 right-3 z-20 w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm text-foreground shadow-md ring-1 ring-black/5 flex items-center justify-center transition-opacity ${showControls ? 'opacity-100' : 'opacity-0'}`}>
      
        {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
      </button>

      {/* badge "Comunicato": sopra la timeline con controlli visibili, in basso quando sono nascosti */}
      {badge &&
    <span className={`absolute left-3 z-20 text-xs font-semibold px-2.5 py-1 rounded-full bg-primary text-white shadow-sm transition-all duration-200 ${showControls ? 'bottom-12' : 'bottom-3'}`}>{badge.label}</span>
    }

      {/* controlli basso: timeline + tempo + fullscreen */}
      <div className={`absolute bottom-0 inset-x-0 z-20 px-3 pb-2 pt-10 from-black/80 via-black/40 to-transparent transition-opacity ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white tabular-nums w-10">{fmt(current)}</span>
          <div
          ref={barRef}
          onPointerDown={onBarDown}
          onPointerMove={onBarMove}
          onPointerUp={onBarUp}
          onPointerCancel={onBarUp}
          className="relative flex-1 h-2 rounded-full bg-white/30 cursor-pointer touch-none">
          
            <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${progress}%` }} />
            <div className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-primary shadow ring-2 ring-white/70" style={{ left: `calc(${progress}% - 7px)` }} />
          </div>
          <span className="text-xs text-white tabular-nums w-12 text-right">-{fmt(remaining)}</span>
          <button
          type="button"
          onClick={toggleFullscreen}
          aria-label={fs ? 'Riduci' : 'Schermo intero'}
          className="w-8 h-8 rounded-full flex items-center justify-center text-white hover:bg-white/15">
          
            {fs ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>;


  return (
    <>
      <div ref={slotRef} className={natural ? 'w-full' : 'w-full h-full'} />
      {hasOverlay && createPortal(player, overlayRef.current)}
    </>);

}
