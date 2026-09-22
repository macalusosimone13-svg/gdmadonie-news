import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { sb44 } from '@/api/supabaseEntities';
import { Lead, Card } from '@/components/redesign/Cards';
import { Newsletter, FollowStats } from '@/components/redesign/SideBoxes';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { MapPin, Clock } from 'lucide-react';
import PullToRefresh from '@/components/PullToRefresh';
import EventsCalendar from '@/components/EventsCalendar';
import { ArrowUp, Search, X } from 'lucide-react';
import { hasUnread } from '@/lib/readArticles';
import { useSEO } from '@/lib/useSEO';
import { loadSiteContent, getContent } from '@/lib/siteContent';

const BATCH = 60;
const PAGE_SIZE = 8;

function NewDot({ show }) {
  if (!show) return null;
  return <span aria-hidden="true" style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#10b981', marginLeft: 7, verticalAlign: '2px' }} />;
}

function EventRow({ event }) {
  const [open, setOpen] = useState(false);
  const d = event.date ? new Date(event.date) : null;
  return (
    <article className="ev-card" style={{ gridTemplateColumns: '110px minmax(0,1fr)' }}>
      <Link to={`/evento/${event.id}`} className="ev-date">
        <b>{d ? format(d, 'dd') : '--'}</b><span>{d ? format(d, 'MMM', { locale: it }).toUpperCase() : ''}</span><i>{d ? format(d, 'yyyy') : ''}</i>
      </Link>
      <div className="ev-info">
        <Link to={`/evento/${event.id}`}><h3>{event.title}</h3></Link>
        <div className="ev-meta">
          {event.location && <span><MapPin size={13} style={{ display: 'inline', verticalAlign: '-2px' }} /> {event.location}</span>}
          {d && <span><Clock size={13} style={{ display: 'inline', verticalAlign: '-2px' }} /> {format(d, "d MMMM yyyy 'alle' HH:mm", { locale: it })}</span>}
        </div>
        {event.image_url && <button type="button" className="btn-pill btn-blu ev-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>{open ? 'Nascondi locandina' : 'Vedi locandina'}</button>}
      </div>
      {open && <div className="ev-poster"><img src={event.image_url} alt={`Locandina — ${event.title}`} loading="lazy" /></div>}
    </article>);
}

export default function GDMadonie() {
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const initialTab = ['comunicati', 'news', 'eventi'].includes(tabParam) ? tabParam : 'comunicati';
  const [activeTab, setActiveTab] = useState(initialTab);
  // Se arriviamo qui da un link con ?tab=... mentre siamo gia' su questa
  // pagina (stessa rotta: React Router non la rimonta), lo stato iniziale
  // sopra non basta - va sincronizzato quando cambia il parametro in URL.
  useEffect(() => {
    if (['comunicati', 'news', 'eventi'].includes(tabParam) && tabParam !== activeTab) setActiveTab(tabParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabParam]);
  const [content, setContent] = useState(null);
  const [view, setView] = useState('list');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [newsVisibleCount, setNewsVisibleCount] = useState(PAGE_SIZE);
  const [hasNew, setHasNew] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newsSearchQuery, setNewsSearchQuery] = useState('');
  const lastSig = useRef(null);

  useEffect(() => {loadSiteContent().then(setContent);}, []);

  const comunicatiQuery = useQuery({
    queryKey: ['gd-comunicati'],
    queryFn: () => sb44.entities.Post.filter({ source_type: 'gd_madonie', category: 'comunicato', status: 'published' }, '-published_date', BATCH),
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    refetchOnMount: false
  });
  const newsQuery = useQuery({
    queryKey: ['gd-news'],
    queryFn: () => sb44.entities.Post.filter({ source_type: 'gd_madonie', category: 'news_gd', status: 'published' }, '-published_date', BATCH),
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    refetchOnMount: false
  });
  const eventiQuery = useQuery({
    queryKey: ['gd-eventi'],
    queryFn: () => sb44.entities.Event.list('-date', 30),
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    refetchOnMount: false
  });

  const comunicati = comunicatiQuery.data || [];
  const newsGd = newsQuery.data || [];
  const eventi = eventiQuery.data || [];

  useEffect(() => {
    if (!comunicatiQuery.data) return;
    const sig = comunicatiQuery.data.length + ':' + (comunicatiQuery.data[0]?.id || '');
    if (lastSig.current != null && lastSig.current !== sig) setHasNew(true);
    lastSig.current = sig;
  }, [comunicatiQuery.dataUpdatedAt]);

  const sentinelRef = useRef(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) setVisibleCount((c) => Math.min(c + PAGE_SIZE, comunicati.length));
    }, { rootMargin: '400px' });
    io.observe(el);
    return () => io.disconnect();
  }, [comunicati.length]);

  const newsSentinelRef = useRef(null);
  useEffect(() => {
    const el = newsSentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) setNewsVisibleCount((c) => Math.min(c + PAGE_SIZE, newsGd.length));
    }, { rootMargin: '400px' });
    io.observe(el);
    return () => io.disconnect();
  }, [newsGd.length]);

  const refreshAll = async () => {
    await Promise.all([comunicatiQuery.refetch(), newsQuery.refetch(), eventiQuery.refetch()]);
    setVisibleCount(PAGE_SIZE);
    setNewsVisibleCount(PAGE_SIZE);
    setHasNew(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };


  useSEO({
    title: 'GD Madonie — Comunicati, news ed eventi del circolo',
    description: 'Comunicati, news ed eventi dei Giovani Democratici Madonie.',
    url: typeof window !== 'undefined' ? window.location.href : undefined
  });

  const Empty = () => <div style={{ textAlign: 'center', padding: '48px 0', opacity: .6 }}>Nessun contenuto pubblicato.</div>;
  const Loading = () => <div className="news-main-grid gd-grid">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="skel" style={{ height: 320 }} />)}</div>;

  const filt = (list, q) => list.filter((p) => {
    if (!q.trim()) return true;
    const t = q.trim().toLowerCase();
    return p.title?.toLowerCase().includes(t) || p.excerpt?.toLowerCase().includes(t);
  });
  const filteredCom = filt(comunicati, searchQuery), filteredNews = filt(newsGd, newsSearchQuery);
  const visible = filteredCom.slice(0, visibleCount);
  const hasMore = !searchQuery.trim() && visibleCount < comunicati.length;
  const visibleNews = filteredNews.slice(0, newsVisibleCount);
  const hasMoreNews = !newsSearchQuery.trim() && newsVisibleCount < newsGd.length;
  const tabList = [['comunicati', 'Comunicati', comunicati.length, hasUnread(comunicati)], ['news', 'News GD', newsGd.length, hasUnread(newsGd)], ['eventi', 'Eventi', eventi.length, hasUnread(eventi)]];

  const Search_ = ({ value, set, ph }) =>
  <div className="search-box">
      <Search size={16} style={{ opacity: .5 }} />
      <input type="text" value={value} onChange={(e) => set(e.target.value)} placeholder={ph} />
      {value && <button onClick={() => set('')} aria-label="Cancella ricerca"><X size={16} /></button>}
    </div>;

  const list = (items, loadingNow, sentinel, more, q) =>
  loadingNow ? <Loading /> :
  items.length === 0 ? <Empty /> :
  <>
      <Lead post={items[0]} wide label="Comunicato GD" siteContent={null} />
      {items.length > 1 && <div className="news-main-grid gd-grid">{items.slice(1).map((p) => <Card key={p.id} post={p} />)}</div>}
      <div ref={sentinel} aria-hidden="true" />
      {more && <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><div className="w-7 h-7 border-4 border-slate-200 border-t-primary rounded-full animate-spin" /></div>}
    </>;

  return (
    <PullToRefresh onRefresh={refreshAll}>
      <div className="rd-page">
        <div className="page-head"><div className="hero-glow" /><div className="wrap-wide">
          <span className="section-kicker">Dal circolo</span>
          <h1>{(content && getContent(content, 'gd_title')) || 'GD MADONIE'}</h1>
          <p>{(content && getContent(content, 'gd_subtitle')) || 'Comunicati e iniziative del circolo'}</p>
          <div className="tabs">
            {tabList.map(([k, l, n, unread]) =>
            <button key={k} className={`tab ${activeTab === k ? 'active' : ''}`} onClick={() => setActiveTab(k)}>{l}<span className="n">{n}</span><NewDot show={unread} /></button>
            )}
          </div>
        </div></div>
        <div className="wrap-wide news-body">
          {hasNew &&
          <button onClick={refreshAll} className="btn-pill btn-blu" style={{ width: '100%', marginBottom: 16 }}><ArrowUp size={14} style={{ marginRight: 8 }} /> Nuovi aggiornamenti disponibili — tocca per vedere</button>}

          {activeTab === 'comunicati' &&
          <>
              <Search_ value={searchQuery} set={setSearchQuery} ph="Cerca tra i comunicati…" />
              <div className="news-count">{filteredCom.length} comunicat{filteredCom.length === 1 ? 'o' : 'i'}</div>
              {list(visible, comunicatiQuery.isLoading && !comunicatiQuery.data, sentinelRef, hasMore)}
            </>}

          {activeTab === 'news' &&
          <>
              <Search_ value={newsSearchQuery} set={setNewsSearchQuery} ph="Cerca tra le news…" />
              <div className="news-count">{filteredNews.length} news</div>
              {list(visibleNews, newsQuery.isLoading && !newsQuery.data, newsSentinelRef, hasMoreNews)}
            </>}

          {activeTab === 'eventi' &&
          <>
              <div className="tabs" style={{ marginTop: 0, marginBottom: 14 }}>
                <button className={`tab ${view === 'list' ? 'active' : ''}`} onClick={() => setView('list')}>Elenco</button>
                <button className={`tab ${view === 'calendar' ? 'active' : ''}`} onClick={() => setView('calendar')}>Calendario</button>
              </div>
              {eventiQuery.isLoading && !eventiQuery.data ? <Loading /> :
            eventi.length === 0 ? <Empty /> :
            view === 'calendar' ? <EventsCalendar events={eventi} /> :
            <div className="ev-list">{eventi.map((ev) => <EventRow key={ev.id} event={ev} />)}</div>}
            </>}

          <div className="strip-2">
            <Newsletter />
            <div><FollowStats /></div>
          </div>
        </div>
      </div>
    </PullToRefresh>);

}
