import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { sb44 } from '@/api/supabaseEntities';
import PullToRefresh from '@/components/PullToRefresh';
import { CATEGORIES, getCategoryLabel } from '@/lib/categories';
import { useSiteContent } from '@/lib/useSiteContent';
import { useSEO } from '@/lib/useSEO';
import { useJsonLd } from '@/lib/useJsonLd';
import AdSlot from '@/components/AdSlot';
import Reveal from '@/components/Reveal';
import { ADS_ENABLED } from '@/lib/adsConfig';
import { Card, Lead, TrendBox, postImg, fmtDate, postLink, metaSource } from '@/components/redesign/Cards';
import { Newsletter, FollowStats } from '@/components/redesign/SideBoxes';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

const GD_CATS = ['comunicato', 'news_gd', 'proposta', 'approfondimento'];
const TOPICS = 'SPOPOLAMENTO · SANITÀ · TRASPORTI · LAVORO · SCUOLA · AREE INTERNE · DIRITTI · AMBIENTE ·';

function Featured({ post, isEvent, siteContent }) {
  const img = post.image_url;
  const date = isEvent ?
  post.date ? format(new Date(post.date), "d MMMM yyyy 'ore' HH:mm", { locale: it }) : '' :
  fmtDate(post.published_date);
  const label = isEvent ? 'Evento GD' : getCategoryLabel(siteContent, post.category);
  return (
    <div className="featured-wrap"><div className="wrap">
      <Link to={postLink({ ...post, _type: isEvent ? 'event' : undefined })} className="featured">
        <div className="featured-text">
          <span className="featured-label">In evidenza</span>
          <div className="chip-row"><span className="chip-blu">{label}</span>{!isEvent && post.source_name && <span className="chip-src">{post.source_name}</span>}</div>
          <h2>{post.title}</h2>
          <span className="date">{date}{isEvent && post.location ? ` · ${post.location}` : ''}</span>
          <span className="feat-cta">{isEvent ? "Scopri l'evento" : 'Leggi la notizia'} →</span>
        </div>
        <div className="featured-img"><img src={img} alt="" fetchpriority="high" /></div>
      </Link>
    </div></div>);
}

function EventsBox({ events }) {
  if (!events.length) return null;
  return (
    <div className="side-box">
      <div className="side-title">Prossimi eventi</div>
      <div style={{ display: 'grid', gap: 10 }}>
        {events.map((e) => {
          const d = new Date(e.date);
          return (
            <Link key={e.id} to={`/evento/${e.id}`} className="ev-mini">
              <div className="d">{format(d, 'dd')}<small>{format(d, 'MMM', { locale: it }).toUpperCase()}</small></div>
              <div><b>{e.title}</b><span>{e.location || ''}</span></div>
            </Link>);
        })}
      </div>
    </div>);
}

function NewsBlock({ kicker, title, to, lead, cards, side, siteContent, aside }) {
  if (!lead) return null;
  return (
    <div className="news-block">
      <div className="section-head-row">
        <div><span className="section-kicker">{kicker}</span><h2 className="section-title"><Link to={to}>{title}</Link></h2></div>
        <Link className="section-link" to={to}>Vedi tutto →</Link>
      </div>
      <div className="feed-layout">
        <div>
          <Lead post={lead} siteContent={siteContent} />
          {cards.length > 0 && <div className="mini-grid">{cards.map((p) => <Card key={p.id} post={p} siteContent={siteContent} />)}</div>}
        </div>
        <aside>{aside || <TrendBox posts={side} siteContent={siteContent} />}</aside>
      </div>
    </div>);
}

export default function Home() {
  const { data: siteContent } = useSiteContent();

  const postsQuery = useQuery({
    queryKey: ['home-posts'],
    queryFn: async () => {
      const [gd, ras] = await Promise.all([
      sb44.entities.Post.filter({ status: 'published', category: { $in: GD_CATS } }, '-published_date', 50),
      sb44.entities.Post.filter({ status: 'published', category: { $in: ['politica_nazionale', 'politica_regionale', 'rassegna_stampa'] } }, '-published_date', 100)]);
      return [...(gd || []), ...(ras || [])];
    },
    staleTime: 3 * 60 * 1000
  });

  const eventsQuery = useQuery({
    queryKey: ['home-events'],
    queryFn: () => sb44.entities.Event.filter({ date: { $gte: new Date().toISOString() } }, 'date', 50),
    staleTime: 3 * 60 * 1000
  });

  const loading = postsQuery.isLoading || eventsQuery.isLoading;

  const posts = useMemo(() => {
    const evs = (eventsQuery.data || []).map((e) => ({ ...e, _type: 'event' }));
    return [...(postsQuery.data || []), ...evs].
    filter((p) => p._type === 'event' || p.status !== 'draft').
    sort((a, b) => new Date(b._type === 'event' ? b.date : b.published_date || 0) - new Date(a._type === 'event' ? a.date : a.published_date || 0));
  }, [postsQuery.data, eventsQuery.data]);

  const refresh = async () => { await Promise.all([postsQuery.refetch(), eventsQuery.refetch()]); };

  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;
  const hasRealImage = (p) => !!postImg(p) && p.media_type !== 'video';
  const isImminentEvent = (p) => p._type === 'event' && new Date(p.date).getTime() - now <= 7 * DAY_MS;
  const isFreshComunicato = (p) => p._type !== 'event' && GD_CATS.includes(p.category) && now - new Date(p.published_date || 0).getTime() <= 2 * DAY_MS;
  const heroPost =
  posts.find((p) => isImminentEvent(p) && hasRealImage(p)) ||
  posts.find((p) => isFreshComunicato(p) && hasRealImage(p)) ||
  posts.find((p) => p._type !== 'event' && hasRealImage(p));
  const heroIsEvent = heroPost?._type === 'event';

  const gdPosts = posts.filter((p) => p._type !== 'event' && GD_CATS.includes(p.category) && p !== heroPost);
  const nazionale = posts.filter((p) => p.category === 'politica_nazionale' && p !== heroPost);
  const regionale = posts.filter((p) => p.category === 'politica_regionale' && p !== heroPost);
  const upcomingEvents = posts.filter((p) => p._type === 'event' && p !== heroPost).slice(0, 3);

  const team = [1, 2, 3, 4].
  map((i) => ({ slot: i, photo: siteContent?.[`team_${i}_photo`], prefix: siteContent?.[`team_${i}_prefix`], name: siteContent?.[`team_${i}_name`], caption: siteContent?.[`team_${i}_caption`] })).
  filter((t) => t.photo);

  return (
    <PullToRefresh onRefresh={refresh}>
      <div>
        <section className="hero" style={{ paddingTop: 70 }}>
          <div className="hero-glow" aria-hidden="true" />
          <div className="hero-inner">
            <span className="kicker">L'informazione dei Giovani Democratici delle Madonie</span>
            <h1>LE MADONIE<br /><span className="accent">NON SI</span><br />RACCONTANO<br />DA SOLE</h1>
            <div className="hero-actions">
              <Link to="/rassegna-stampa" className="btn-pill btn-blu">Leggi le notizie</Link>
              <a href="#partecipa" className="btn-pill btn-outline">Dì la tua</a>
            </div>
          </div>
        </section>
        <div className="marquee"><div className="marquee-track"><span>{TOPICS}</span><span>{TOPICS}</span></div></div>

        {loading ?
        <div className="featured-wrap"><div className="wrap"><div className="skel" style={{ height: 360 }} /></div></div> :
        heroPost && <Featured post={heroPost} isEvent={heroIsEvent} siteContent={siteContent} />}

        <section style={{ paddingTop: 40 }}><div className="wrap">
          {!loading &&
          <>
              <Reveal>
                <NewsBlock kicker="Dal circolo" title="GD MADONIE" to="/gd-madonie" siteContent={siteContent}
              lead={gdPosts[0]} cards={gdPosts.slice(1, 4)}
              aside={<><EventsBox events={upcomingEvents} /><Newsletter /><FollowStats /></>} />
              </Reveal>
              {ADS_ENABLED && <AdSlot slot="2333170743" />}
              <Reveal>
                <NewsBlock kicker="Dalla rassegna stampa" title="POLITICA NAZIONALE" to="/rassegna-stampa/nazionale" siteContent={siteContent}
              lead={nazionale[0]} cards={nazionale.slice(1, 4)} side={nazionale.slice(4, 8)} />
              </Reveal>
              {ADS_ENABLED && <AdSlot slot="5129407821" format="fluid" layoutKey="-gc+9-1l-2m+az" />}
              <Reveal>
                <NewsBlock kicker="Dalla rassegna stampa" title="POLITICA REGIONALE" to="/rassegna-stampa/regionale" siteContent={siteContent}
              lead={regionale[0]} cards={regionale.slice(1, 4)} side={regionale.slice(4, 8)} />
              </Reveal>
              {!heroPost && !gdPosts.length && !nazionale.length && !regionale.length &&
            <div style={{ textAlign: 'center', padding: '64px 0', opacity: .6 }}>Nessuna notizia trovata.</div>}
            </>}
        </div></section>

        {team.length > 0 &&
        <section className="persone-section" id="persone"><div className="wrap">
          <span className="section-kicker">Chi siamo</span>
          <h2 className="section-title"><Link to="/chi-siamo">LE PERSONE DIETRO<br />LE NOTIZIE</Link></h2>
          <div className="persone-grid">
            {team.slice(0, 2).map((t) =>
            <Link key={t.slot} to={`/in-evidenza/${t.slot}`} className="persona-card">
                <div className="persona-photo"><img src={t.photo} alt={t.name || ''} loading="lazy" /></div>
                <h3>{[t.prefix, t.name].filter(Boolean).join(' ') || 'Team'}</h3>
                {t.caption && <div className="ruolo">{t.caption}</div>}
                <span className="profilo">Vedi il profilo →</span>
              </Link>
            )}
          </div>
        </div></section>}

        <section className="cta-final" id="partecipa">
          <h2>PARTECIPA</h2>
          <p>Segnala una notizia, proponi un'inchiesta o entra nei Giovani Democratici delle Madonie.</p>
          <a href="mailto:gdmadonie@gmail.com" className="btn-pill">Scrivici</a>
        </section>
      </div>
    </PullToRefresh>);
}
