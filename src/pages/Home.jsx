import { Fragment, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { sb44 } from '@/api/supabaseEntities';
import { Calendar, Instagram, Facebook, Twitter, Youtube, Globe, Send, Link as LinkIcon, Mail, Loader2, Check, FileText, CalendarDays, Share2 } from 'lucide-react';
import EventCard from '@/components/EventCard';
import PostCardSkeleton from '@/components/PostCardSkeleton';
import PullToRefresh from '@/components/PullToRefresh';
import { CATEGORIES, getCategoryLabel } from '@/lib/categories';
import { useSiteContent } from '@/lib/useSiteContent';
import { useSEO } from '@/lib/useSEO';
import { useJsonLd } from '@/lib/useJsonLd';
import { useUxConfig } from '@/lib/UxConfigContext';
import { Image } from '@/components/ui/image';
import LazyVideo from '@/components/LazyVideo';
import SourceBadge from '@/components/SourceBadge';
import AdSlot from '@/components/AdSlot';
import Reveal from '@/components/Reveal';
import { ADS_ENABLED } from '@/lib/adsConfig';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

const SOCIAL_ICONS = { instagram: Instagram, facebook: Facebook, telegram: Send, twitter: Twitter, youtube: Youtube, website: Globe, custom: LinkIcon };

function NewsletterSignup() {
  const { config: ux } = useUxConfig();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle');
  const cardStyle = ux.team_cards_bg_color ? { backgroundColor: ux.team_cards_bg_color } : undefined;

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim() || status === 'saving') return;
    setStatus('saving');
    try {
      const res = await fetch('/functions/subscribeNewsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() })
      });
      if (!res.ok) throw new Error('failed');
      setStatus('done');
    } catch {
      setStatus('error');
    }
  };

  return (
    <div style={cardStyle} className={`relative overflow-hidden rounded-2xl p-5 space-y-3 border border-border ${cardStyle ? '' : 'bg-card'}`}>
      <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/10 to-transparent" />
      <div className="relative flex items-center gap-2">
        <Mail className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-bold uppercase tracking-wide text-foreground">Iscriviti alla newsletter</h3>
      </div>
      <p className="relative text-xs text-muted-foreground leading-relaxed">Lascia la tua email: ti scriviamo solo quando pubblichiamo un nuovo comunicato o c'è un evento in programma.</p>
      {status === 'done' ?
      <p className="relative text-sm font-semibold text-foreground flex items-center gap-1.5"><Check className="w-4 h-4 text-primary" /> Controlla la tua email per confermare!</p> :

      <form onSubmit={submit} className="relative space-y-2">
          <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="La tua email"
          className="w-full text-base px-3 py-2.5 rounded-lg text-foreground bg-background border border-border placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />

          <button type="submit" disabled={status === 'saving'} className="w-full text-sm font-semibold px-3 py-2.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-70 flex items-center justify-center gap-1.5">
            {status === 'saving' && <Loader2 className="w-4 h-4 animate-spin" />}
            Iscrivimi
          </button>
          {status === 'error' && <p className="text-xs text-red-600">Qualcosa non ha funzionato, riprova.</p>}
        </form>
      }
    </div>);

}

function FollowUs() {
  const { config: ux } = useUxConfig();
  const cardStyle = ux.team_cards_bg_color ? { backgroundColor: ux.team_cards_bg_color } : undefined;
  const [shareState, setShareState] = useState('idle');
  const { data: socialLinks } = useQuery({
    queryKey: ['gd-social-links'],
    queryFn: () => sb44.entities.SocialLink.filter({ is_active: true }, 'sort_order', 10),
    staleTime: 10 * 60 * 1000
  });

  const shareSite = async () => {
    const url = window.location.origin;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Madonie News', url });
        return;
      } catch (err) {
        if (err?.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareState('copied');
      setTimeout(() => setShareState('idle'), 2000);
    } catch {
      setShareState('error');
      setTimeout(() => setShareState('idle'), 2000);
    }
  };

  if ((!socialLinks || socialLinks.length === 0)) return null;

  return (
    <div style={cardStyle} className={`relative overflow-hidden rounded-2xl p-5 space-y-3 border border-border ${cardStyle ? '' : 'bg-card'}`}>
      <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/10 to-transparent" />
      <h3 className="relative text-sm font-bold uppercase tracking-wide text-foreground">Seguici</h3>
      <div className="relative flex gap-2.5 flex-wrap items-center">
        {socialLinks.map((l) => {
        const Icon = SOCIAL_ICONS[l.icon] || SOCIAL_ICONS[l.platform] || LinkIcon;
        return (
          <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer" aria-label={l.label || l.platform} className="w-11 h-11 rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground flex items-center justify-center transition-colors">
              <Icon className="w-[18px] h-[18px]" />
            </a>);

      })}
        <button type="button" onClick={shareSite} aria-label="Condividi il sito" title="Condividi il sito" className="w-11 h-11 rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground flex items-center justify-center transition-colors">
          <Share2 className="w-[18px] h-[18px]" />
        </button>
      </div>
      {shareState === 'copied' && <p className="relative text-xs text-emerald-600">Link copiato!</p>}
      {shareState === 'error' && <p className="relative text-xs text-red-600">Non sono riuscito a copiare il link.</p>}
    </div>);

}

function FollowAndStats() {
  const { config: ux } = useUxConfig();
  const cardStyle = ux.team_cards_bg_color ? { backgroundColor: ux.team_cards_bg_color } : undefined;
  const { data: stats } = useQuery({
    queryKey: ['gd-stats'],
    queryFn: async () => {
      const [comunicati, eventi] = await Promise.all([
      sb44.entities.Post.filter({ status: 'published', source_type: 'gd_madonie' }, '-published_date', 200),
      sb44.entities.Event.list('-date', 200)]
      );
      return { comunicati: comunicati.length, eventi: eventi.length };
    },
    staleTime: 10 * 60 * 1000
  });

  const hasStats = stats && (stats.comunicati > 0 || stats.eventi > 0);

  return (
    <aside className="hidden lg:block space-y-6">
      <NewsletterSignup />
      <FollowUs />
      {hasStats &&
      <div style={cardStyle} className={`relative overflow-hidden rounded-2xl p-5 border border-border ${cardStyle ? '' : 'bg-card'}`}>
          <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/10 to-transparent" />
          <div className="relative grid grid-cols-2 divide-x divide-border">
            <div className="flex flex-col items-center gap-1.5 pr-2">
              <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center"><FileText className="w-4 h-4" /></div>
              <p className="text-2xl font-serif font-bold text-foreground leading-none">{stats.comunicati}</p>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Comunicati</p>
            </div>
            <div className="flex flex-col items-center gap-1.5 pl-2">
              <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center"><CalendarDays className="w-4 h-4" /></div>
              <p className="text-2xl font-serif font-bold text-foreground leading-none">{stats.eventi}</p>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Eventi</p>
            </div>
          </div>
        </div>
      }
    </aside>);

}

const SECTION_COLORS = {
  politica_nazionale: { text: 'text-blue-700', bar: 'border-blue-700', groupHover: 'group-hover:text-blue-700', hover: 'hover:text-blue-700' },
  politica_regionale: { text: 'text-sky-600', bar: 'border-sky-600', groupHover: 'group-hover:text-sky-600', hover: 'hover:text-sky-600' }
};

function PostThumb({ post, className }) {
  if (post.media_type === 'video') {
    return <LazyVideo src={post.image_url} poster={post.poster_url} className={className} videoClassName="w-full h-full object-cover" />;
  }
  return <Image src={post.image_url} fittingType="fill" alt={post.title} className={className} />;
}

function GdMadonieSection({ posts, events, siteContent }) {
  const { config: ux } = useUxConfig();
  const { data: miniStats } = useQuery({
    queryKey: ['gd-stats'],
    queryFn: async () => {
      const [comunicati, eventi] = await Promise.all([
      sb44.entities.Post.filter({ status: 'published', source_type: 'gd_madonie' }, '-published_date', 200),
      sb44.entities.Event.list('-date', 200)]
      );
      return { comunicati: comunicati.length, eventi: eventi.length };
    },
    staleTime: 10 * 60 * 1000
  });
  if (posts.length === 0 && events.length === 0) return null;
  const [featured, ...rest] = posts;
  const small = rest.slice(0, 3);
  const cardStyle = ux.team_cards_bg_color ? { backgroundColor: ux.team_cards_bg_color } : undefined;

  return (
    <section className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <Link to="/gd-madonie">
          <h2 className="text-2xl font-serif font-bold text-foreground border-b-2 border-primary pb-2 inline-block hover:text-[#ff7024] transition-colors">GD Madonie</h2>
        </Link>
        {miniStats && (miniStats.comunicati > 0 || miniStats.eventi > 0) &&
        <span className="lg:hidden text-xs text-muted-foreground flex items-center gap-2.5">
            <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" />{miniStats.comunicati} comunicati</span>
            <span className="flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" />{miniStats.eventi} eventi</span>
          </span>
        }
      </div>
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {featured ?
          <div className="grid md:grid-cols-2 gap-4 items-start">
              <div className="space-y-2 order-2 md:order-1">
                <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${CATEGORIES[featured.category]?.badge || ''}`}>
                  {getCategoryLabel(siteContent, featured.category)}
                </span>
                <Link to={`/articolo/${featured.id}`}>
                  <h3 className="text-2xl font-serif font-bold leading-tight hover:underline text-[#ff7024]">{featured.title}</h3>
                </Link>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {featured.published_date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{format(new Date(featured.published_date), 'd MMMM yyyy', { locale: it })}</span>}
                  {featured.author && <span>di <span className="font-semibold">{featured.author.toUpperCase()}</span></span>}
                </div>
                {featured.excerpt && <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">{featured.excerpt}</p>}
              </div>
              {featured.image_url &&
            <Link to={`/articolo/${featured.id}`} className="order-1 md:order-2 block aspect-[4/3] rounded-xl overflow-hidden bg-muted">
                  <PostThumb post={featured} className="w-full h-full" />
                </Link>
            }
            </div> :

          <p className="text-sm text-muted-foreground">Nessun comunicato pubblicato di recente.</p>
          }
          {small.length > 0 &&
          <div className="grid sm:grid-cols-3 gap-4">
            {small.map((p) =>
            <Link key={p.id} to={`/articolo/${p.id}`} style={cardStyle} className={`relative overflow-hidden block space-y-2 group border border-border rounded-xl p-3 ${cardStyle ? '' : 'bg-card'}`}>
                <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/10 to-transparent" />
                {p.image_url &&
              <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                    <PostThumb post={p} className="w-full h-full transition-transform duration-300 group-hover:scale-105" />
                  </div>
              }
                <h4 className="relative text-sm font-serif font-bold leading-snug text-foreground group-hover:text-[#ff7024] line-clamp-2">{p.title}</h4>
              </Link>
            )}
          </div>
          }
        </div>
        {events.length > 0 ?
        <aside className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-foreground border-b-2 border-primary inline-block pb-1">Prossimi eventi</h3>
            <div className="space-y-3">
              {events.map((e) => <EventCard key={e.id} event={e} />)}
            </div>
          </aside> :

        <FollowAndStats />
        }
      </div>
    </section>);

}

function NewsSection({ title, categoryKey, posts, siteContent, linkTo }) {
  const { config: ux } = useUxConfig();
  if (posts.length === 0) return null;
  const colors = SECTION_COLORS[categoryKey] || { text: 'text-primary', bar: 'border-primary', groupHover: 'group-hover:text-primary', hover: 'hover:text-primary' };
  const [featured, ...rest] = posts;
  const small = rest.slice(0, 3);
  const trend = rest.slice(3, 7);
  const cardStyle = ux.team_cards_bg_color ? { backgroundColor: ux.team_cards_bg_color } : undefined;

  return (
    <section className="space-y-5">
      {linkTo ?
      <Link to={linkTo}>
          <h2 className={`text-2xl font-serif font-bold text-foreground border-b-2 ${colors.bar} pb-2 inline-block ${colors.hover} transition-colors`}>{title}</h2>
        </Link> :

      <h2 className={`text-2xl font-serif font-bold text-foreground border-b-2 ${colors.bar} pb-2 inline-block`}>{title}</h2>
      }
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="grid md:grid-cols-2 gap-4 items-start">
            <div className="space-y-2 order-2 md:order-1">
              <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full bg-[hsl(var(--primary))] ${CATEGORIES[featured.category]?.badge || ''}`}>
                {getCategoryLabel(siteContent, featured.category)}
              </span>
              <Link to={`/articolo/${featured.id}`}>
                <h3 className={`text-2xl font-serif font-bold leading-tight hover:underline ${colors.text}`}>{featured.title}</h3>
              </Link>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {featured.published_date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{format(new Date(featured.published_date), 'd MMMM yyyy', { locale: it })}</span>}
                {featured.author && <span>di <span className="font-semibold">{featured.author.toUpperCase()}</span></span>}
                {!featured.author && featured.source_name && <SourceBadge post={featured} />}
              </div>
              {featured.excerpt && <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">{featured.excerpt}</p>}
            </div>
            {featured.image_url &&
            <Link to={`/articolo/${featured.id}`} className="order-1 md:order-2 block aspect-[4/3] rounded-xl overflow-hidden bg-muted">
                <Image src={featured.image_url} fittingType="fill" alt={featured.title} className="w-full h-full" />
              </Link>
            }
          </div>
          {small.length > 0 &&
          <div className="grid sm:grid-cols-3 gap-4">
            {small.map((p) =>
            <Link key={p.id} to={`/articolo/${p.id}`} style={cardStyle} className={`relative overflow-hidden block space-y-2 group border border-border rounded-xl p-3 ${cardStyle ? '' : 'bg-card'}`}>
                <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/10 to-transparent" />
                {p.image_url &&
              <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                    <Image src={p.image_url} fittingType="fill" alt={p.title} className="w-full h-full transition-transform duration-300 group-hover:scale-105" />
                  </div>
              }
                <h4 className={`relative text-sm font-serif font-bold leading-snug text-foreground ${colors.groupHover} line-clamp-2`}>{p.title}</h4>
              </Link>
            )}
          </div>
          }
        </div>
        {trend.length > 0 &&
        <aside className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-foreground border-b-2 border-primary inline-block pb-1">In tendenza</h3>
            <ol className="space-y-4">
              {trend.map((p, i) =>
            <li key={p.id} style={cardStyle} className={`relative overflow-hidden flex gap-3 p-3 border border-border rounded-xl ${cardStyle ? '' : 'bg-card'}`}>
                  <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/10 to-transparent" />
                  <span className="relative text-2xl font-serif font-bold text-muted-foreground/40 leading-none">{i + 1}</span>
                  <div className="relative min-w-0">
                    <Link to={`/articolo/${p.id}`}>
                      <h4 className={`text-sm font-semibold leading-snug text-foreground ${colors.hover} line-clamp-3`}>{p.title}</h4>
                    </Link>
                    <p className="text-[11px] text-muted-foreground mt-1">in <span className="font-semibold">{getCategoryLabel(siteContent, p.category)?.toUpperCase()}</span></p>
                  </div>
                </li>
            )}
            </ol>
          </aside>
        }
      </div>
    </section>);

}

export default function Home() {
  useSEO({
    title: 'GD Madonie News — Giovani Democratici Madonie',
    description: 'Il sito ufficiale dei Giovani Democratici Madonie: comunicati, proposte, approfondimenti, eventi e rassegna stampa di politica nazionale e regionale.',
    url: typeof window !== 'undefined' ? window.location.href : undefined
  });
  // Dice esplicitamente a Google chi e' il circolo (nome, sito, eventuale
  // logo) cosi' la ricerca del solo nome "GD Madonie News" riconosce questo
  // sito come l'entita' ufficiale, non solo come una pagina qualsiasi.
  useJsonLd({
    '@context': 'https://schema.org',
    '@graph': [
    {
      '@type': 'Organization',
      '@id': 'https://www.gdmadonie-news.com/#organization',
      name: 'Giovani Democratici Madonie',
      alternateName: 'GD Madonie News',
      url: 'https://www.gdmadonie-news.com/',
      logo: 'https://pub-1b641aacf1b949cfadd9ca8ab453df1b.r2.dev/legacy/2026-09-16/f1422048-c330-4a0a-8892-0a85294ff01b.png',
      member: [
      { '@type': 'Person', name: 'Simone Macaluso', jobTitle: 'Segretario' },
      { '@type': 'Person', name: 'Filippo Fiorentino', jobTitle: 'Vice Segretario' }]

    },
    {
      '@type': 'WebSite',
      '@id': 'https://www.gdmadonie-news.com/#website',
      name: 'GD Madonie News',
      url: 'https://www.gdmadonie-news.com/',
      publisher: { '@id': 'https://www.gdmadonie-news.com/#organization' }
    }]

  });
  const { config: ux } = useUxConfig();
  const { data: siteContent } = useSiteContent();

  const postsQuery = useQuery({
    queryKey: ['home-posts'],
    queryFn: async () => {
      const [gd, ras] = await Promise.all([
      sb44.entities.Post.filter({ status: 'published', category: { $in: ['comunicato', 'news_gd', 'proposta', 'approfondimento'] } }, '-published_date', 50),
      sb44.entities.Post.filter({ status: 'published', category: { $in: ['politica_nazionale', 'politica_regionale', 'rassegna_stampa'] } }, '-published_date', 100)]
      );
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

  const refresh = async () => {
    await Promise.all([postsQuery.refetch(), eventsQuery.refetch()]);
  };

  const GD_CATS = ['comunicato', 'news_gd', 'proposta', 'approfondimento'];
  const RSS_DEFAULT_COVER = 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800&q=80';
  const hasRealImage = (p) => p.image_url && p.image_url !== RSS_DEFAULT_COVER && p.media_type !== 'video';
  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;
  const isImminentEvent = (p) => p._type === 'event' && new Date(p.date).getTime() - now <= 7 * DAY_MS;
  const isFreshComunicato = (p) => p._type !== 'event' && GD_CATS.includes(p.category) && now - new Date(p.published_date || 0).getTime() <= 2 * DAY_MS;
  const heroPost =
  posts.find((p) => isImminentEvent(p) && hasRealImage(p)) ||
  posts.find((p) => isFreshComunicato(p) && hasRealImage(p)) ||
  posts.find((p) => p._type !== 'event' && hasRealImage(p));
  const heroIsEvent = heroPost?._type === 'event';

  const gdPosts = posts.filter((p) => p._type !== 'event' && GD_CATS.includes(p.category) && p !== heroPost);
  const nazionalePosts = posts.filter((p) => p.category === 'politica_nazionale' && p !== heroPost);
  const regionalePosts = posts.filter((p) => p.category === 'politica_regionale' && p !== heroPost);

  const upcomingEvents = posts.filter((p) => p._type === 'event' && p !== heroPost).slice(0, 4);

  const teamSlots = [1, 2, 3, 4].
  map((i) => ({
    slot: i,
    photo: siteContent?.[`team_${i}_photo`],
    prefix: siteContent?.[`team_${i}_prefix`],
    name: siteContent?.[`team_${i}_name`],
    caption: siteContent?.[`team_${i}_caption`]
  })).
  filter((t) => t.photo);

  return (
    <PullToRefresh onRefresh={refresh}>
      <div>
        {loading &&
        <div className="block relative left-1/2 right-1/2 -mx-[50vw] w-screen" aria-hidden="true">
            <div className="h-[68svh] min-h-[380px] lg:h-[85svh] w-full bg-muted animate-pulse" />
          </div>
        }
        {!loading && heroPost && (() => {
          const date = heroIsEvent ?
          heroPost.date ? format(new Date(heroPost.date), 'dd MMMM yyyy \'ore\' HH:mm', { locale: it }) : '' :
          heroPost.published_date ? format(new Date(heroPost.published_date), 'dd MMMM yyyy', { locale: it }) : '';
          const cat = !heroIsEvent && (CATEGORIES[heroPost.category] || CATEGORIES.rassegna_stampa);
          const label = !heroIsEvent && getCategoryLabel(siteContent, heroPost.category);
          return (
            <Link
              to={heroIsEvent ? `/evento/${heroPost.id}` : `/articolo/${heroPost.id}`}
              className="block relative left-1/2 right-1/2 -mx-[50vw] w-screen group">
              <div className="relative h-[68svh] min-h-[380px] lg:h-[85svh] w-full overflow-hidden bg-muted">
                <Image src={heroPost.image_url} fittingType="fill" focalPointY={0.25} alt={heroPost.title} loading="eager" fetchPriority="high" className="w-full h-full transition-transform duration-500 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-black/10" />
                <div className="absolute inset-x-0 bottom-0 p-6 pb-8 lg:p-14 max-w-3xl mx-auto lg:mx-0 lg:left-0">
                  <div className="flex items-center gap-2 flex-wrap mb-3">
                    {heroIsEvent ?
                    <span className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full bg-primary text-primary-foreground">Evento GD</span> :

                    <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full bg-[hsl(var(--primary))] ${cat.badge}`}>{label}</span>
                    }
                    {!heroIsEvent && heroPost.source_name && <SourceBadge post={heroPost} variant="overlay" />}
                  </div>
                  <h1 className="text-white font-serif font-normal text-3xl lg:text-5xl leading-tight mb-3">{heroPost.title}</h1>
                  <div className="flex items-center gap-3 text-white/80 text-xs">
                    {date && <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />{date}</span>}
                    {heroIsEvent && heroPost.location && <span>{heroPost.location}</span>}
                  </div>
                </div>
              </div>
            </Link>);

        })()}
        {teamSlots.length > 0 &&
        <div className="flex gap-4 overflow-x-auto scrollbar-hide py-5 px-4 lg:px-0 lg:grid lg:grid-cols-4 lg:gap-4">
          {teamSlots.map((t) =>
          <Link key={t.slot} to={`/in-evidenza/${t.slot}`} style={ux.team_cards_bg_color ? { backgroundColor: ux.team_cards_bg_color } : undefined} className={`relative overflow-hidden flex items-center gap-3 shrink-0 w-72 lg:w-auto group p-3 rounded-2xl ${ux.team_cards_border !== false ? 'border border-border' : ''}`}>
              <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/10 to-transparent" />
              <div className="flex-1 min-w-0">
                {(t.prefix || t.name) &&
              <p className="font-serif font-normal leading-snug">
                    {t.prefix && <span className="text-foreground">{t.prefix} </span>}
                    {t.name && <span className="group-hover:opacity-80 transition-opacity text-[#ff7024]">{t.name}</span>}
                  </p>
              }
                {t.caption && <p className="text-xs text-muted-foreground mt-0.5">{t.caption}</p>}
              </div>
              <div className="relative w-28 h-28 lg:w-32 lg:h-32 shrink-0 rounded-xl overflow-hidden bg-muted">
                <Image src={t.photo} fittingType="fill" alt={t.name || ''} className="w-full h-full transition-transform duration-300 group-hover:scale-105" />
              </div>
            </Link>
          )}
        </div>
        }
        <div className={`space-y-10 ${heroPost || teamSlots.length ? 'pt-6' : 'pt-5'}`}>
          {!heroPost &&
          <div>
            <h1 className="text-foreground tracking-tight font-serif font-normal text-3xl">{ux.home_title || 'Ultime Notizie'}</h1>
            <p className="text-muted-foreground mt-0.5 font-serif font-normal text-base">{ux.home_subtitle || 'Politica nazionale, regionale e le attività del circolo GD Madonie'}</p>
          </div>
          }
          {loading ?
          <div className="grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => <PostCardSkeleton key={i} />)}
          </div> :

          <>
            <Reveal><GdMadonieSection posts={gdPosts} events={upcomingEvents} siteContent={siteContent} /></Reveal>
            {ADS_ENABLED && <AdSlot slot="2333170743" />}
            <Reveal><NewsSection title="Sezione Nazionale" categoryKey="politica_nazionale" posts={nazionalePosts} siteContent={siteContent} linkTo="/rassegna-stampa/nazionale" /></Reveal>
            {ADS_ENABLED && <AdSlot slot="5129407821" format="fluid" layoutKey="-gc+9-1l-2m+az" />}
            <Reveal><NewsSection title="Sezione Regionale" categoryKey="politica_regionale" posts={regionalePosts} siteContent={siteContent} linkTo="/rassegna-stampa/regionale" /></Reveal>
            <div className="lg:hidden"><NewsletterSignup /></div>
            {!heroPost && gdPosts.length === 0 && nazionalePosts.length === 0 && regionalePosts.length === 0 && upcomingEvents.length === 0 &&
            <div className="text-center py-16 text-muted-foreground text-sm">Nessuna notizia trovata.</div>
            }
          </>
          }
        </div>
      </div>
    </PullToRefresh>);


}
