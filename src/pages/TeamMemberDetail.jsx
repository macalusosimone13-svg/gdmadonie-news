import { useParams, Link, useNavigate } from 'react-router-dom';
import { Instagram, Facebook, Twitter, Linkedin, Mail } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { sb44 } from '@/api/supabaseEntities';
import { useSiteContent } from '@/lib/useSiteContent';
import { useSEO } from '@/lib/useSEO';
import { useJsonLd } from '@/lib/useJsonLd';
import { Card } from '@/components/redesign/Cards';

// Il testo del profilo puo' avere titoletti ("## ...") e citazioni ("> ...").
// I titoletti diventano sezioni numerate.
function parseBio(bio) {
  if (!bio) return [];
  const blocks = bio.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  const sections = [];
  let cur = { title: null, items: [] };
  const push = () => { if (cur.title || cur.items.length) sections.push(cur); };
  for (const b of blocks) {
    if (b.startsWith('## ')) { push(); cur = { title: b.slice(3), items: [] }; } else
    if (b.startsWith('> ')) cur.items.push({ quote: b.slice(2) });else
    cur.items.push({ p: b });
  }
  push();
  return sections;
}

export default function TeamMemberDetail() {
  const { slot } = useParams();
  const navigate = useNavigate();
  const { data: content } = useSiteContent();

  const photo = content?.[`team_${slot}_photo`];
  const detailPhoto = content?.[`team_${slot}_detail_photo`] || photo;
  const prefix = content?.[`team_${slot}_prefix`];
  const name = content?.[`team_${slot}_name`];
  const caption = content?.[`team_${slot}_caption`];
  const bio = content?.[`team_${slot}_bio`];

  const rawEmail = content?.[`team_${slot}_email`];
  const socials = [
  { key: 'instagram', label: 'Instagram', icon: Instagram, url: content?.[`team_${slot}_instagram`] },
  { key: 'facebook', label: 'Facebook', icon: Facebook, url: content?.[`team_${slot}_facebook`] },
  { key: 'twitter', label: 'X / Twitter', icon: Twitter, url: content?.[`team_${slot}_twitter`] },
  { key: 'linkedin', label: 'LinkedIn', icon: Linkedin, url: content?.[`team_${slot}_linkedin`] },
  { key: 'email', label: 'Email', icon: Mail, url: rawEmail ? (rawEmail.startsWith('mailto:') ? rawEmail : `mailto:${rawEmail}`) : null }].
  filter((s) => s.url);

  const pageUrl = `https://www.gdmadonie-news.com/in-evidenza/${slot}`;
  useSEO({
    title: name ? `${name}${caption ? ` — ${caption}` : ''} — GD Madonie News` : 'GD Madonie News',
    description: caption || 'Giovani Democratici Madonie',
    image: detailPhoto,
    url: pageUrl,
    type: 'profile'
  });
  useJsonLd(name ? {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name,
    jobTitle: caption || undefined,
    image: detailPhoto || undefined,
    url: pageUrl,
    memberOf: { '@id': 'https://www.gdmadonie-news.com/#organization' },
    sameAs: socials.filter((s) => s.key !== 'email').map((s) => s.url)
  } : null);

  const otherProfiles = [1, 2, 3, 4].
  filter((i) => String(i) !== String(slot)).
  map((i) => ({ slot: i, photo: content?.[`team_${i}_detail_photo`] || content?.[`team_${i}_photo`], name: content?.[`team_${i}_name`], caption: content?.[`team_${i}_caption`] })).
  filter((t) => t.photo);

  const { data: ownPosts } = useQuery({
    queryKey: ['profile-own-posts', name],
    queryFn: () => name ? sb44.entities.Post.filter({ status: 'published', author: name }, '-published_date', 6) : Promise.resolve([]),
    enabled: !!name,
    staleTime: 5 * 60 * 1000
  });
  const { data: relatedNews } = useQuery({
    queryKey: ['profile-related-news', slot],
    queryFn: () => sb44.entities.Post.filter({ status: 'published', category: { $in: ['politica_regionale', 'politica_nazionale'] } }, '-published_date', 3),
    staleTime: 5 * 60 * 1000
  });

  if (!detailPhoto && !name) {
    return <div style={{ textAlign: 'center', padding: '80px 20px', opacity: .7 }}>Pagina non trovata. <Link to="/" style={{ color: 'var(--acc)', fontWeight: 800 }}>Torna alla home</Link></div>;
  }

  const sections = parseBio(bio);

  return (
    <div className="rd-page">
      <div className="prof-hero"><div className="hero-glow" /><div className="prof-hero-inner">
        <div className="prof-text">
          {prefix && <span className="kicker">{prefix}</span>}
          <h1>{(name || '').split(' ').map((w, i, a) => <span key={i}>{w}{i < a.length - 1 && <br />}</span>)}</h1>
          {caption && <span className="prof-role">{caption}</span>}
          {socials.length > 0 &&
          <div className="prof-pills">{socials.map((s) => <a key={s.key} href={s.url} target="_blank" rel="noopener noreferrer">{s.label}</a>)}</div>}
        </div>
        {detailPhoto && <div className="prof-photo"><img src={detailPhoto} alt={name || ''} /></div>}
      </div></div>

      <div className="wrap-wide">
        <div className="prof-body">
          <div>
            {sections.length > 0 ? sections.map((s, i) =>
            <div className="bio-sec" key={i}>
                {s.title && <h2><span className="num">{String(i + 1).padStart(2, '0')}</span>{s.title}</h2>}
                {s.items.map((it, j) => it.quote ?
              <blockquote key={j} style={{ borderLeft: '4px solid var(--acc)', margin: '0 0 14px', padding: '4px 0 4px 18px', fontSize: 20, lineHeight: 1.4, fontStyle: 'italic' }}>{it.quote}</blockquote> :
              <p key={j} style={{ whiteSpace: 'pre-line' }}>{it.p}</p>)}
              </div>
            ) :
            <div className="bio-empty"><h3>Il profilo è in preparazione</h3><p>{name} non ha ancora pubblicato la sua presentazione. Nel frattempo trovi qui sotto le sue notizie.</p></div>}
          </div>
          <aside className="prof-aside">
            {otherProfiles.length > 0 &&
            <div className="side-box"><div className="side-title">{content?.team_related_label || 'Altri profili'}</div>
                {otherProfiles.map((p) =>
              <Link key={p.slot} to={`/in-evidenza/${p.slot}`} className="mini-profile"><img src={p.photo} alt="" /><div><b>{p.name}</b><span>{p.caption}</span></div></Link>
              )}
              </div>}
          </aside>
        </div>

        {ownPosts && ownPosts.length > 0 &&
        <div className="sub-sec"><h2>Le sue notizie</h2><div className="mini-grid">{ownPosts.slice(0, 3).map((p) => <Card key={p.id} post={p} siteContent={content} />)}</div></div>}
        {relatedNews && relatedNews.length > 0 &&
        <div className="sub-sec" style={{ paddingBottom: 100 }}><h2>Potrebbero interessarti</h2><div className="mini-grid">{relatedNews.map((p) => <Card key={p.id} post={p} siteContent={content} />)}</div></div>}
      </div>
    </div>);
}
