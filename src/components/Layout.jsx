// force retransform: chunk invalidate
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Home, Newspaper, Settings, LogIn, Sparkles, ChevronDown, Users, Instagram, Facebook, Send, Twitter, Youtube, Globe, Mail, Link as LinkIcon, ArrowUp, BarChart2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { getCurrentUser } from '@/lib/supabaseAuth';
import { sb44 } from '@/api/supabaseEntities';
import { Image } from '@/components/ui/image';
import UserAvatar from '@/components/UserAvatar';
import { useUxConfig } from '@/lib/UxConfigContext';
import { useSiteContent } from '@/lib/useSiteContent';
import { getContent } from '@/lib/siteContent';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';

export default function Layout() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [socialLinks, setSocialLinks] = useState([]);
  const navigate = useNavigate();
  const location = useLocation();
  const { config: ux } = useUxConfig();
  const { data: siteContent } = useSiteContent();
  const logoUrl = getContent(siteContent, 'site_logo_url');

  useEffect(() => {
    getCurrentUser().then((u) => { setUser(u); }).catch(() => {}).finally(() => setAuthChecked(true));
  }, []);

  useEffect(() => {
    sb44.entities.SocialLink.list('sort_order', 50).then((data) => setSocialLinks((data || []).filter((l) => l.is_active))).catch(() => {});
  }, []);

  // Il sito è una single-page app: React Router cambia pagina senza mai
  // ricaricarla, quindi Google Analytics (che per sua natura misura i
  // ricaricamenti completi) vedrebbe solo la primissima pagina aperta.
  // Ad ogni cambio di rotta si manda quindi manualmente un evento di
  // visualizzazione pagina, così ogni sezione visitata viene contata.
  useEffect(() => {
    if (typeof window.gtag !== 'function') return;
    window.gtag('event', 'page_view', {
      page_path: location.pathname + location.search,
      page_location: window.location.href,
      page_title: document.title
    });
  }, [location.pathname, location.search]);

  // Home ha un hero a tutto schermo: header sempre trasparente. Scorrendo
  // verso il basso, anche di poco, sparisce subito; ricompare solo quando si
  // torna proprio in cima alla pagina (non ad ogni piccolo risalire).
  const isHome = location.pathname === '/';
  useEffect(() => {
    if (!isHome) {setHidden(false);return;}
    const TOP_THRESHOLD = 20;
    const onScroll = () => {
      const y = window.scrollY;
      setHidden(y > TOP_THRESHOLD);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [isHome]);

  const isAdmin = user?.role === 'admin' || user?.role === 'editor';
  const headerSolid = !isHome;

  // Header trasparente in home: una leggera sfumatura di colore dietro logo e
  // pulsanti aiuta il contrasto quando la foto sotto è chiara, senza rendere
  // l'header un blocco pieno.
  const hexToRgba = (hex, alpha) => {
    const m = (hex || '').replace('#', '');
    if (m.length < 6) return `rgba(0,0,0,${alpha})`;
    const r = parseInt(m.slice(0, 2), 16);
    const g = parseInt(m.slice(2, 4), 16);
    const b = parseInt(m.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  };
  const showGlow = !headerSolid && ux.header_glow_enabled !== false;
  const glowColor = ux.header_glow_color || '#000000';

  // Freccina accanto a "Rassegna": apre due sole scelte, Nazionale e
  // Regionale, mostrate come pillole tonde (stile segmented control iOS).
  // Cliccare la voce "Rassegna" stessa porta invece a tutte le fonti.
  const rassegnaOptions = [
  { to: '/rassegna-stampa/nazionale', label: 'Nazionale' },
  { to: '/rassegna-stampa/regionale', label: 'Regionale' }];

  const navItems = [
  { to: '/', icon: Home, label: 'Feed', end: true }];
  if (ux.show_rassegna !== false) navItems.push({ to: '/rassegna-stampa', icon: Newspaper, label: 'News' });
  navItems.push({ to: '/sondaggi', icon: BarChart2, label: 'Sondaggi' });
  navItems.push({ to: '/chi-siamo', icon: Users, label: 'Chi siamo' });
  if (isAdmin) navItems.push({ to: '/admin', icon: Settings, label: 'Admin' });
  // Su telefono "Chi siamo" e' gia' nel footer subito sotto: ripeterlo anche
  // nel menu in alto occupa spazio prezioso senza aggiungere nulla di nuovo.
  const mobileNavItems = navItems.filter((i) => i.to !== '/chi-siamo');

  const SOCIAL_ICONS = { instagram: Instagram, facebook: Facebook, telegram: Send, twitter: Twitter, youtube: Youtube, website: Globe, email: Mail, custom: LinkIcon };
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {ux.show_banner && ux.banner_text &&
      <div className="bg-primary text-primary-foreground text-center text-sm py-2 px-4">{ux.banner_text}</div>
      }
      <header className={`${isHome ? 'fixed' : 'sticky'} top-0 left-0 right-0 z-40 text-[hsl(var(--header-fg))] pt-safe no-select transition-transform duration-300 ${headerSolid ? 'shadow-md bg-[hsl(var(--header-bg))]' : 'bg-transparent'} ${isHome && hidden ? '-translate-y-full' : 'translate-y-0'}`}>
        {showGlow &&
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 pointer-events-none backdrop-blur-sm"
          style={{ backgroundImage: `linear-gradient(to bottom, ${hexToRgba(glowColor, 0.55)}, ${hexToRgba(glowColor, 0.15)} 70%, transparent)` }} />

        }
        <div className="max-w-2xl lg:max-w-screen-xl mx-auto px-4">
          <div className="h-16 flex items-center justify-between">
          <NavLink to="/" className="flex items-center gap-3 no-select">
            <Image src={logoUrl} fittingType="fit" alt="" className="w-14 h-14 rounded-full overflow-hidden flex-shrink-0" />
            <div className="leading-tight">
              <span className="font-semibold tracking-tight text-lg">Madonie News</span>
              <span className="block text-sm opacity-80 font-normal">Giovani Democratici Madonie</span>
            </div>
          </NavLink>
          <nav className="hidden lg:flex items-center gap-1" aria-label="Navigazione principale">
            {navItems.map(({ to, icon: Icon, image, label, end }) =>
              to === '/rassegna-stampa' ?
              <div key={to} className="flex items-center">
                <NavLink
                  to={to}
                  aria-label={label}
                  className={({ isActive }) =>
                  `inline-flex items-center gap-1.5 pl-3 pr-1 py-2 rounded-l-full text-sm font-medium transition-colors no-select ${isActive ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/15 hover:text-white'}`
                  }>

                  <Icon className="w-4 h-4" /> {label}
                </NavLink>
                <DropdownMenu>
                  <DropdownMenuTrigger aria-label="Scegli tra rassegna Nazionale o Regionale" className="flex items-center justify-center pr-3 pl-1 py-2 text-white/80 hover:bg-white/15 hover:text-white transition-colors no-select outline-none rounded-r-full">
                    <ChevronDown className="w-3.5 h-3.5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center" className="flex flex-row gap-1.5 p-1.5 rounded-full w-auto">
                    {rassegnaOptions.map((o) =>
                    <DropdownMenuItem key={o.to} onClick={() => navigate(o.to)} className="rounded-full px-3.5 py-2 text-sm font-medium justify-center cursor-pointer">
                        {o.label}
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div> :

              <NavLink
                key={to}
                to={to}
                end={end}
                aria-label={label}
                className={({ isActive }) =>
                `inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium transition-colors no-select ${isActive ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/15 hover:text-white'}`
                }>
              {image ?
                <Image src={image} fittingType="fit" alt="" className="w-4 h-4" /> :
                <Icon className="w-4 h-4" />}
              {label}
            </NavLink>

              )}
          </nav>
          <div className="flex items-center gap-2">
            <NavLink to="/assistente" aria-label="Assistente eventi" className="flex items-center justify-center w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 transition-colors no-select" title="Assistente eventi">
              <Sparkles className="w-5 h-5" />
            </NavLink>
            {authChecked && user ?
              <NavLink to="/impostazioni" aria-label="Impostazioni account" className="flex items-center justify-center w-11 h-11 rounded-full hover:ring-2 hover:ring-white/40 transition no-select" title="Impostazioni">
              <UserAvatar user={user} src={user?.image_url} size={36} className="ring-2 ring-white/30" />
            </NavLink> :
              authChecked ?
              <NavLink to="/login" aria-label="Accedi" className="flex items-center gap-1.5 text-xs bg-white/15 px-3 py-2.5 rounded-full hover:bg-white/25 transition-colors min-h-[44px] no-select">
                <LogIn className="w-4 h-4" /> Accedi
              </NavLink> :
              null}
          </div>
        </div>
        <nav className="lg:hidden flex gap-2 justify-center overflow-x-auto scrollbar-hide touch-pan-x pb-2 pt-1" aria-label="Navigazione principale">
          {mobileNavItems.map(({ to, icon: Icon, image, label, end }) =>
            to === '/rassegna-stampa' ?
            <div key={to} className="shrink-0 flex items-center">
              <NavLink
                to={to}
                aria-label={label}
                className={({ isActive }) =>
                `inline-flex items-center gap-1.5 pl-3.5 pr-1 py-2 rounded-l-full text-sm font-medium transition-colors no-select ${isActive ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/15 hover:text-white'}`
                }>

                <Icon className="w-4 h-4" /> {label}
              </NavLink>
              <DropdownMenu>
                <DropdownMenuTrigger aria-label="Scegli tra rassegna Nazionale o Regionale" className="flex items-center justify-center pr-3.5 pl-1 py-2 rounded-r-full text-white/80 hover:bg-white/15 hover:text-white transition-colors no-select outline-none">
                  <ChevronDown className="w-3.5 h-3.5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="flex flex-row gap-1.5 p-1.5 rounded-full w-auto">
                  {rassegnaOptions.map((o) =>
                  <DropdownMenuItem key={o.to} onClick={() => navigate(o.to)} className="rounded-full px-3.5 py-2 text-sm font-medium justify-center cursor-pointer">
                      {o.label}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div> :

            <NavLink
              key={to}
              to={to}
              end={end}
              aria-label={label}
              className={({ isActive }) =>
              `shrink-0 whitespace-nowrap inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium transition-colors no-select ${isActive ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/15 hover:text-white'}`
              }>
            {image ?
              <Image src={image} fittingType="fit" alt="" className="w-4 h-4" /> :
              <Icon className="w-4 h-4" />}
            {label}
          </NavLink>

            )}
        </nav>
      </div>
      </header>
      <main className={`flex-1 max-w-2xl lg:max-w-screen-xl mx-auto w-full px-4 pb-12 ${isHome ? '' : 'py-5'}`}>
        <Outlet />
      </main>
      <footer className="bg-slate-900 text-slate-300 pt-12 pb-8 px-4">
        <div className="max-w-2xl lg:max-w-screen-xl mx-auto flex flex-col items-center gap-6 text-center">
          <div className="flex items-center gap-3">
            <Image src={logoUrl} fittingType="fit" alt="" className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0" />
            <span className="text-white font-semibold tracking-tight">Madonie News</span>
          </div>
          {socialLinks.length > 0 &&
          <div className="flex items-center gap-4">
            {socialLinks.map((l) => {
              const Icon = SOCIAL_ICONS[l.icon] || SOCIAL_ICONS[l.platform] || LinkIcon;
              const href = l.platform === 'email' ? l.url.startsWith('mailto:') ? l.url : `mailto:${l.url}` : l.url;
              return (
                <a key={l.id} href={href} target="_blank" rel="noopener noreferrer" aria-label={l.label || l.platform} className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
                  <Icon className="w-4 h-4 text-white" />
                </a>);

            })}
          </div>
          }
          <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs font-semibold uppercase tracking-wide">
            <NavLink to="/chi-siamo" className="hover:text-white transition-colors">Chi siamo</NavLink>
            <NavLink to="/gd-madonie" className="hover:text-white transition-colors">Redazione</NavLink>
            <NavLink to="/rassegna-stampa" className="hover:text-white transition-colors">News</NavLink>
            <NavLink to="/privacy" className="hover:text-white transition-colors">Privacy</NavLink>
            <NavLink to="/termini" className="hover:text-white transition-colors">Termini</NavLink>
          </nav>
          <div className="w-full border-t border-white/10 pt-5 text-xs text-slate-500">
            © {new Date().getFullYear()} Giovani Democratici Madonie
          </div>
        </div>
        <button onClick={scrollToTop} aria-label="Torna su" className="fixed bottom-5 right-5 w-11 h-11 rounded-full text-primary-foreground shadow-lg flex items-center justify-center hover:opacity-90 transition-opacity z-30 bg-[#0f1b3a]">
          <ArrowUp className="w-5 h-5" />
        </button>
      </footer>
    </div>);

}
