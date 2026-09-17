import { useEffect, useState } from 'react';

const SPLASH_KEY = 'mn_splash_seen';
const HOLD_MS = 2000;
const FADE_MS = 600;

const DEFAULTS = {
  logo_url: 'https://pub-1b641aacf1b949cfadd9ca8ab453df1b.r2.dev/legacy/2026-09-16/f1422048-c330-4a0a-8892-0a85294ff01b.png',
  background_color: '#0F1B3A',
  show_title: true,
  show_subtitle: true,
  title: 'Madonie News',
  subtitle: 'Giovani Democratici Madonie',
  logo_size: 140,
};

export default function SplashScreen() {
  const [phase, setPhase] = useState('hold'); // 'hold' | 'fade' | 'done'
  const [cfg, setCfg] = useState(DEFAULTS);

  useEffect(() => {
    if (sessionStorage.getItem(SPLASH_KEY)) {
      setPhase('done');
      return;
    }
    sessionStorage.setItem(SPLASH_KEY, '1');

    // Carica la configurazione salvata dall'admin (lettura pubblica)
    import('@/api/supabaseEntities')
      .then(({ sb44 }) => sb44.entities.SplashConfig.list('-updated_date', 1))
      .then((d) => {
        const c = (d || [])[0];
        if (c) {
          setCfg({
            logo_url: c.logo_url || DEFAULTS.logo_url,
            background_color: c.background_color || DEFAULTS.background_color,
            show_title: c.show_title !== false,
            show_subtitle: c.show_subtitle !== false,
            title: c.title || DEFAULTS.title,
            subtitle: c.subtitle || DEFAULTS.subtitle,
            logo_size: Number(c.logo_size) || DEFAULTS.logo_size,
          });
        }
      })
      .catch(() => {});

    const t1 = setTimeout(() => setPhase('fade'), HOLD_MS);
    const t2 = setTimeout(() => setPhase('done'), HOLD_MS + FADE_MS);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (phase === 'done') return null;

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-opacity duration-[600ms] ease-out"
      style={{ opacity: phase === 'fade' ? 0 : 1, background: cfg.background_color }}
    >
      {cfg.logo_url && (
        <img
          src={cfg.logo_url}
          alt="Logo"
          className="object-contain mb-6"
          style={{ width: cfg.logo_size, height: cfg.logo_size }}
        />
      )}
      <div className="flex flex-col items-center gap-1.5 text-center px-6">
        {cfg.show_title && (
          <h1 className="text-2xl font-extrabold tracking-tight text-white">{cfg.title}</h1>
        )}
        {cfg.show_subtitle && (
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/70">{cfg.subtitle}</p>
        )}
      </div>
      <div className="absolute bottom-10 flex items-center gap-2 text-white/70">
        <div className="w-1.5 h-1.5 rounded-full bg-white/80 animate-pulse" />
        <span className="text-xs font-medium tracking-wide">Caricamento…</span>
      </div>
    </div>
  );
}
