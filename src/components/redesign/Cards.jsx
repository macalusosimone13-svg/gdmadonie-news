import { useState } from 'react';
import { sized, fallbackTo } from '@/lib/imgSize';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { CATEGORIES, getCategoryLabel } from '@/lib/categories';

const RSS_DEFAULT_COVER = 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800&q=80';

// Immagine da mostrare in una card: per i video si usa la copertina (poster),
// cosi' la griglia resta leggera; l'immagine segnaposto delle testate si ignora.
export function postImg(p) {
  if (!p) return null;
  if (p.media_type === 'video') return p.poster_url || null;
  if (!p.image_url || p.image_url === RSS_DEFAULT_COVER) return null;
  return p.image_url;
}

// Immagini verticali (locandine, slide dei caroselli, card grafiche): nella
// notizia grande si vede l'immagine intera, nelle card piccole si rimpicciolisce
// per intero su uno sfondo sfocato fatto con la stessa immagine, invece di
// essere tagliata. Si parte dal dato salvato e si conferma a immagine caricata.
const savedPortrait = (p) => (p?.media?.[0]?.orientation || p?.media_orientation) === 'vertical' && p?.media_type !== 'video';
export function usePortrait(post) {
  const [portrait, setPortrait] = useState(() => savedPortrait(post));
  const onLoad = (e) => {
    const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
    if (w && h) setPortrait(h > w * 1.05);
  };
  return [portrait, onLoad];
}

export const fmtDate = (d) => {
  try { return d ? format(new Date(d), 'd MMMM yyyy', { locale: it }) : ''; } catch { return ''; }
};

export const postLink = (p) => (p._type === 'event' ? `/evento/${p.id}` : `/articolo/${p.slug || p.id}`);
export const metaSource = (p, siteContent) => p.source_name || p.author || getCategoryLabel(siteContent, p.category);

export function Card({ post, siteContent }) {
  const img = postImg(post);
  const [portrait, onLoad] = usePortrait(post);
  return (
    <Link to={postLink(post)} className={`article-card${img ? '' : ' noimg'}${img && portrait ? ' portrait' : ''}`}>
      {img && <div className="card-media">{portrait && <span className="card-media-bg" aria-hidden="true" style={{ backgroundImage: `url("${sized(img, 120)}")` }} />}<img src={sized(img, 640)} onError={fallbackTo(img)} onLoad={onLoad} alt="" loading="lazy" decoding="async" />{post.media_type === 'video' && <span className="vid-badge">▶</span>}</div>}
      <div className="card-body">
        <div className="meta-line">{metaSource(post, siteContent)} <span className="d">· {fmtDate(post.published_date)}</span></div>
        <h3>{post.title}</h3>
        {post.excerpt && <p>{post.excerpt}</p>}
      </div>
    </Link>);
}

export function Lead({ post, siteContent, wide, label }) {
  const img = postImg(post);
  const cat = CATEGORIES[post.category];
  const [portrait, onLoad] = usePortrait(post);
  return (
    <Link to={postLink(post)} className={`lead${img ? '' : ' noimg'}${wide ? ' wide' : ''}${img && portrait ? ' portrait' : ''}`}>
      <div className="lead-text">
        <div className="chip-row"><span className="chip-blu">{label || getCategoryLabel(siteContent, post.category) || cat?.label}</span></div>
        <h3>{post.title}</h3>
        <div className="meta-line">{metaSource(post, siteContent)} <span className="d">· {fmtDate(post.published_date)}</span></div>
        {post.excerpt && <p>{post.excerpt}</p>}
      </div>
      {img && <div className="lead-media">{portrait && <span className="card-media-bg" aria-hidden="true" style={{ backgroundImage: `url("${sized(img, 120)}")` }} />}<img src={sized(img, 1000)} onError={fallbackTo(img)} onLoad={onLoad} alt="" loading="lazy" decoding="async" /></div>}
    </Link>);
}

export function TrendBox({ posts, siteContent, title = 'In tendenza' }) {
  if (!posts.length) return null;
  return (
    <div className="side-box">
      <div className="side-title">{title}</div>
      {posts.map((p, i) =>
      <Link key={p.id} to={postLink(p)} className="trend-item">
          <span className="trend-num">{i + 1}</span>
          <div><h4>{p.title}</h4><span className="src">{metaSource(p, siteContent)}</span></div>
        </Link>
      )}
    </div>);
}
