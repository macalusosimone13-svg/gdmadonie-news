import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { sb44 } from '@/api/supabaseEntities';
import { Instagram, Facebook, Mail, Send, Twitter, Youtube, Globe, Link as LinkIcon } from 'lucide-react';
import { loadSiteContent, getContent } from '@/lib/siteContent';
import { useSEO } from '@/lib/useSEO';
import { sized, fallbackTo } from '@/lib/imgSize';

const SOCIAL_ICONS = { instagram: Instagram, facebook: Facebook, telegram: Send, twitter: Twitter, youtube: Youtube, website: Globe, email: Mail, custom: LinkIcon };
const TOPICS = ['Aree interne', 'Spopolamento', 'Sanità territoriale', 'Infrastrutture digitali', 'Gestione faunistica', 'Politica locale e regionale'];
const isEmpty = (v) => !v || !String(v).trim() || String(v).trim() === '—';

export default function ChiSiamo() {
  const [content, setContent] = useState(null);
  const [links, setLinks] = useState([]);

  useEffect(() => {loadSiteContent().then(setContent);}, []);
  useEffect(() => {
    sb44.entities.SocialLink.list('sort_order', 50).then((data) => setLinks((data || []).filter((l) => l.is_active))).catch(() => {});
  }, []);

  useSEO({
    title: 'Chi siamo — GD Madonie News',
    description: 'Giovani Democratici Madonie: organigramma, contatti e social.',
    type: 'website'
  });

  // Foto e pagina profilo: si collegano cercando, tra le schede "in evidenza",
  // quella con lo stesso nome indicato nell'organigramma.
  const slotFor = (nome) => {
    if (isEmpty(nome)) return null;
    for (const i of [1, 2, 3, 4]) {
      const n = content?.[`team_${i}_name`];
      if (n && n.trim().toLowerCase() === nome.trim().toLowerCase()) return { slot: i, photo: content?.[`team_${i}_detail_photo`] || content?.[`team_${i}_photo`] };
    }
    return null;
  };

  const organigramma = [
  { ruolo: 'Segretario', nome: getContent(content, 'org_segretario') },
  { ruolo: 'Vicesegretario', nome: getContent(content, 'org_vicesegretario') },
  { ruolo: 'Resp. Comunicazione', nome: getContent(content, 'org_resp_comunicazione') },
  { ruolo: 'Tesoriere', nome: getContent(content, 'org_tesoriere') }];

  const emailLink = links.find((l) => l.platform === 'email');
  const mailHref = emailLink ? (emailLink.url.startsWith('mailto:') ? emailLink.url : `mailto:${emailLink.url}`) : 'mailto:gdmadonie@gmail.com';

  return (
    <div className="rd-page">
      <div className="page-head"><div className="hero-glow" /><div className="wrap-wide">
        <span className="section-kicker">Giovani Democratici Madonie</span>
        <h1>CHI SIAMO</h1>
      </div></div>
      <div className="wrap-wide" style={{ paddingTop: 44 }}>
        <p className="intro-big" style={{ whiteSpace: 'pre-line' }}>{getContent(content, 'gd_description')}</p>
        <div className="topic-row">{TOPICS.map((t) => <span key={t} className="topic">{t}</span>)}</div>

        <section style={{ paddingTop: 56 }}>
          <span className="section-kicker">Il circolo</span>
          <h2 className="section-title">ORGANIGRAMMA</h2>
          <div className="org-grid">
            {organigramma.map((o) => {
              const s = slotFor(o.nome);
              if (isEmpty(o.nome)) return (
                <div key={o.ruolo} className="org-card empty"><div className="org-photo">—</div><div className="org-info"><div className="org-role">{o.ruolo}</div><div className="org-name">Da assegnare</div></div></div>);
              const inner = <>
                <div className="org-photo">{s?.photo ? <img src={sized(s.photo, 500)} onError={fallbackTo(s.photo)} alt="" loading="lazy" /> : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem', fontFamily: 'Rubik', fontWeight: 900, color: 'var(--chiaro)' }}>{o.nome.trim()[0]}</div>}</div>
                <div className="org-info"><div className="org-role">{o.ruolo}</div><div className="org-name">{o.nome}</div>{s && <span className="org-link">Vedi il profilo →</span>}</div>
              </>;
              return s ? <Link key={o.ruolo} to={`/in-evidenza/${s.slot}`} className="org-card">{inner}</Link> : <div key={o.ruolo} className="org-card">{inner}</div>;
            })}
          </div>
        </section>

        <section style={{ paddingTop: 56 }}><div className="split-2">
          <div><span className="section-kicker">Dove trovarci</span><h2 className="section-title">CONTATTI<br />E SOCIAL</h2></div>
          <div className="contact-list" style={{ marginTop: 0 }}>
            {links.length === 0 && <p style={{ opacity: .6 }}>Nessun contatto configurato.</p>}
            {links.map((l) => {
              const Icon = SOCIAL_ICONS[l.icon] || SOCIAL_ICONS[l.platform] || LinkIcon;
              const href = l.platform === 'email' ? (l.url.startsWith('mailto:') ? l.url : `mailto:${l.url}`) : l.url;
              const [k, ...rest] = (l.label || l.platform || '').split(' ');
              return (
                <a key={l.id} href={href} target="_blank" rel="noopener noreferrer" className="contact-row">
                  <b><Icon size={13} style={{ display: 'inline', marginRight: 6, verticalAlign: '-2px' }} />{l.platform}</b><span>{l.label}</span>
                </a>);
            })}
          </div></div></section>

        <div className="cta-band"><div><h2>VUOI SCRIVERE CON NOI?</h2><p>Cerchiamo sempre nuove voci per raccontare il territorio delle Madonie. Se vuoi proporre un articolo, un'iniziativa o entrare a far parte del circolo, scrivici.</p></div><a href={mailHref} className="btn-pill">Scrivici</a></div>
        <div style={{ height: 90 }} />
      </div>
    </div>);
}
