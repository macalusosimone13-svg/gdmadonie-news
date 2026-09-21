import { Outlet, NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, LogIn, Sparkles, Instagram, Facebook, Send, Twitter, Youtube, Globe, Mail, Link as LinkIcon, ArrowUp, Menu, X } from 'lucide-react';
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
  const ddRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { config: ux } = useUxConfig();
  const backTarget = useBackTarget();

  useEffect(() => {
    getCurrentUser().then((u) => { setUser(u); }).catch(() => {}).finally(() => setAuthChecked(true));
  }, []);

  useEffect(() => {
    sb44.entities.SocialLink.list('sort_order', 50).then((data) => setSocialLinks((data || []).filter((l) => l.is_active))).catch(() => {});
  }, []);

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

  useEffect(() => { setMenuOpen(false); setNewsOpen(false); }, [location.pathname]);

  useEffect(() => {
    const onDoc = (e) => { if (ddRef.current && !ddRef.current.contains(e.target)) setNewsOpen(false); };
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
            {showNews &&
            <div className="nav-dropdown" ref={ddRef}>
                <NavLink to="/rassegna-stampa" className={linkCls}>News</NavLink>
                <span className="nav-dropdown-chevron" role="button" aria-label="Scegli tra GD Madonie, Nazionale o Regionale" onClick={(e) => { e.stopPropagation(); setNewsOpen((o) => !o); }}>▾</span>
                <div className={`nav-dropdown-menu ${newsOpen ? 'open' : ''}`}>
                  <a onClick={() => navigate('/gd-madonie')}>GD Madonie</a>
                  <a onClick={() => navigate('/rassegna-stampa/nazionale')}>Nazionale</a>
                  <a onClick={() => navigate('/rassegna-stampa/regionale')}>Regionale</a>
                </div>
              </div>
            }
            <NavLink to="/sondaggi" className={linkCls}>Sondaggi</NavLink>
            <NavLink to="/chi-siamo" className={linkCls}>Chi siamo</NavLink>
            {isAdmin && <NavLink to="/admin" className={linkCls}>Admin</NavLink>}
          </nav>
          <div className="header-actions">
            <NavLink to="/assistente" aria-label="Assistente eventi" title="Assistente eventi" className="icon-btn"><Sparkles size={19} /></NavLink>
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
        {showNews && <Link to="/rassegna-stampa">News</Link>}
        <Link className="sub" to="/gd-madonie">GD Madonie</Link>
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
