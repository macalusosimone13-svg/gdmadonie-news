import AssistantLogo from '@/components/AssistantLogo';
import { Outlet, NavLink, Link, useLocation } from 'react-router-dom';
import { ArrowLeft, LogIn, Instagram, Facebook, Send, Twitter, Youtube, Globe, Mail, Link as LinkIcon, ArrowUp, Menu, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { getCurrentUser } from '@/lib/supabaseAuth';
import { sb44 } from '@/api/supabaseEntities';
import UserAvatar from '@/components/UserAvatar';
import { useBackTarget } from '@/lib/backTarget';
import { useUxConfig } from '@/lib/UxConfigContext';

// Pagine gia' riprogettate col nuovo stile: hanno il loro contenitore.
// Le altre restano nel contenitore stretto di prima finche' non le migro.
const REDESIGNED = ['/', '/rassegna-stampa', '/gd-madonie', '/chi-siamo', '/in-evidenza', '/sondaggi', '/articolo', '/post', '/assistente', '/impostazioni', '/privacy', '/termini', '/evento', '/admin'];

const SOCIAL_ICONS = { instagram: Instagram, facebook: Facebook, telegram: Send, twitter: Twitter, youtube: Youtube, website: Globe, email: Mail, custom: LinkIcon };

export default function Layout() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [socialLinks, setSocialLinks] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [newsOpen, setNewsOpen] = useState(false);
  const [gdOpen, setGdOpen] = useState(false);
  const ddRef = useRef(null);
  const gdRef = useRef(null);
  const location = useLocation();
  const { config: ux } = useUxConfig();
  const backTarget = useBackTarget();

  useEffect(() => {
    getCurrentUser().then((u) => { setUser(u); }).catch(() => {}).finally(() => setAuthChecked(true));
  }, []);

  useEffect(() => {
    sb44.entities.SocialLink.list('sort_order', 50).then((data) => setSocialLinks((data || []).filter((l) => l.is_active))).catch(() => {});
  }, []);

  // Scheda d'identita' del sito per Google (Organization + WebSite), uguale
  // su ogni pagina: aiuta Google a capire chi siamo e puo' far comparire il
  // nome "GD Madonie News" nei risultati di ricerca invece del solo
  // indirizzo. Stesso meccanismo gia' usato per la scheda NewsArticle dei
  // singoli articoli (PostDetail.jsx), inserito una sola volta qui.
  useEffect(() => {
    const SCRIPT_ID = 'ld-json-organization';
    const data = {
      '@context': 'https://schema.org',
      '@graph': [
      {
        '@type': 'Organization',
        name: 'Giovani Democratici Madonie',
        url: 'https://www.gdmadonie-news.com',
        logo: 'https://www.gdmadonie-news.com/favicon-512.png',
        sameAs: (socialLinks || []).map((l) => l.url).filter(Boolean)
      },
      {
        '@type': 'WebSite',
        name: 'GD Madonie News',
        url: 'https://www.gdmadonie-news.com'
      }]

    };
    let el = document.getElementById(SCRIPT_ID);
    if (!el) {
      el = document.createElement('script');
      el.type = 'application/ld+json';
      el.id = SCRIPT_ID;
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(data);
  }, [socialLinks]);

  // Il sito e' una single-page app: a ogni cambio di rotta si manda a mano un
  // evento di visualizzazione pagina a Google Analytics.
  useEffect(() => {
    if (typeof window.gtag !== 'function') return;
    window.gtag('event', 'page_view', {
      page_path: location.pathname + location.search,
      page_location: window.location.href,
      page_title: document.title
    });
  }, [location.pathname, location.search]);

  useEffect(() => { setMenuOpen(false); setNewsOpen(false); setGdOpen(false); }, [location.pathname]);

  useEffect(() => {
    const onDoc = (e) => {
      if (ddRef.current && !ddRef.current.contains(e.target)) setNewsOpen(false);
      if (gdRef.current && !gdRef.current.contains(e.target)) setGdOpen(false);
    };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  const isAdmin = user?.role === 'admin' || user?.role === 'editor';
  const redesigned = REDESIGNED.some((r) => (r === '/' ? location.pathname === '/' : location.pathname.startsWith(r)));
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  const linkCls = ({ isActive }) => (isActive ? 'active' : '');
  const showNews = ux.show_rassegna !== false;

  return (
    <div className="rd min-h-screen flex flex-col" style={{ background: 'var(--crema)' }}>
      {ux.show_banner && ux.banner_text && <div className="banner">{ux.banner_text}</div>}
      <header className="site" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="header-inner">
          {location.pathname !== '/' && <Link to={location.pathname.startsWith('/evento') ? '/gd-madonie' : (/^\/(post|articolo)\//.test(location.pathname) && backTarget) || '/'} className={`back-feed ${/^\/(post|articolo|evento)\//.test(location.pathname) ? 'always' : ''}`} aria-label={/^\/(post|articolo|evento)\//.test(location.pathname) ? 'Torna alla sezione' : 'Torna al Feed'}><ArrowLeft size={20} /></Link>}
          <Link to="/" className="logo" aria-label="GD Madonie News - Feed">
            {(location.pathname.startsWith('/rassegna-stampa') || location.pathname.startsWith('/articolo') || (location.pathname.startsWith('/post/') && backTarget && backTarget !== '/gd-madonie'))
              ? <div className="logo-text logo-news-only"><b>NEWS</b></div>
              : <div className="logo-text">GD MADONIE<span>NEWS</span></div>}
          </Link>
          <nav className="main-nav" aria-label="Navigazione principale">
            <NavLink to="/" end className={linkCls}>Feed</NavLink>
            <div className="nav-dropdown" ref={gdRef}>
              <NavLink to="/gd-madonie" className={linkCls}>GD Madonie</NavLink>
              <span className="nav-dropdown-chevron" role="button" aria-label="Scegli tra Comunicati, News GD o Eventi" onClick={(e) => { e.stopPropagation(); setGdOpen((o) => !o); }}>▾</span>
              <div className={`nav-dropdown-menu ${gdOpen ? 'open' : ''}`}>
                <Link to="/gd-madonie?tab=comunicati">Comunicati</Link>
                <Link to="/gd-madonie?tab=news">News GD</Link>
                <Link to="/gd-madonie?tab=eventi">Eventi</Link>
              </div>
            </div>
            {showNews &&
            <div className="nav-dropdown" ref={ddRef}>
                <NavLink to="/rassegna-stampa" className={linkCls}>News</NavLink>
                <span className="nav-dropdown-chevron" role="button" aria-label="Scegli tra Nazionale o Regionale" onClick={(e) => { e.stopPropagation(); setNewsOpen((o) => !o); }}>▾</span>
                <div className={`nav-dropdown-menu ${newsOpen ? 'open' : ''}`}>
                  <Link to="/rassegna-stampa/nazionale">Nazionale</Link>
                  <Link to="/rassegna-stampa/regionale">Regionale</Link>
                </div>
              </div>
            }
            <NavLink to="/sondaggi" className={linkCls}>Sondaggi</NavLink>
            <NavLink to="/chi-siamo" className={linkCls}>Chi siamo</NavLink>
            {isAdmin && <NavLink to="/admin" className={linkCls}>Admin</NavLink>}
          </nav>
          <div className="header-actions">
            <NavLink to="/assistente" aria-label="Assistente eventi" title="Assistente eventi" className="icon-btn assist-btn"><AssistantLogo size={24} /></NavLink>
            {authChecked && user ?
            <NavLink to="/impostazioni" aria-label="Impostazioni account" title="Impostazioni" className="icon-btn" style={{ background: 'none' }}>
                <UserAvatar user={user} src={user?.image_url} size={40} />
              </NavLink> :
            authChecked ?
            <NavLink to="/login" aria-label="Accedi" className="login-pill hide-sm"><LogIn size={16} /> Accedi</NavLink> :
            null}
            <button className="burger" aria-label="Menu" onClick={() => setMenuOpen((o) => !o)}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button>
          </div>
        </div>
      </header>
      <div className={`mobile-menu ${menuOpen ? 'open' : ''}`}>
        <Link to="/">Feed</Link>
        <Link to="/gd-madonie">GD Madonie</Link>
        <Link className="sub" to="/gd-madonie?tab=comunicati">Comunicati</Link>
        <Link className="sub" to="/gd-madonie?tab=news">News GD</Link>
        <Link className="sub" to="/gd-madonie?tab=eventi">Eventi</Link>
        {showNews && <Link to="/rassegna-stampa">News</Link>}
        <Link className="sub" to="/rassegna-stampa/nazionale">Nazionale</Link>
        <Link className="sub" to="/rassegna-stampa/regionale">Regionale</Link>
        <Link to="/sondaggi">Sondaggi</Link>
        <Link to="/chi-siamo">Chi siamo</Link>
        {isAdmin && <Link to="/admin">Admin</Link>}
        {authChecked && !user && <Link to="/login">Accedi</Link>}
      </div>

      <main className={redesigned ? 'flex-1 w-full' : 'flex-1 w-full max-w-2xl lg:max-w-screen-xl mx-auto px-4 pb-12 py-5'} style={{ minWidth: 0 }}>
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="wrap-wide">
          <div className="footer-top">
            <Link to="/" className="logo"><div className="logo-text">GD MADONIE<span>NEWS</span></div></Link>
            <nav className="footer-nav">
              <Link to="/">Feed</Link>
              <Link to="/gd-madonie">GD Madonie</Link>
              <Link to="/rassegna-stampa">News</Link>
              <Link to="/sondaggi">Sondaggi</Link>
              <Link to="/chi-siamo">Chi siamo</Link>
              <Link to="/privacy">Privacy</Link>
              <Link to="/termini">Termini</Link>
            </nav>
          </div>
          {socialLinks.length > 0 &&
          <div className="footer-social" style={{ marginBottom: 26 }}>
              {socialLinks.map((l) => {
              const Icon = SOCIAL_ICONS[l.icon] || SOCIAL_ICONS[l.platform] || LinkIcon;
              const href = l.platform === 'email' ? (l.url.startsWith('mailto:') ? l.url : `mailto:${l.url}`) : l.url;
              return <a key={l.id} href={href} target="_blank" rel="noopener noreferrer" aria-label={l.label || l.platform}><Icon size={17} /></a>;
            })}
            </div>
          }
          <div className="footer-bottom">© {new Date().getFullYear()} Giovani Democratici Madonie</div>
        </div>
        <button onClick={scrollToTop} aria-label="Torna su" className="to-top"><ArrowUp size={20} /></button>
      </footer>
    </div>);

}
