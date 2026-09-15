import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { sb44 } from '@/api/supabaseEntities';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PostCard from '@/components/PostCard';
import GdEventCard from '@/components/GdEventCard';
import PostCardSkeleton from '@/components/PostCardSkeleton';
import PullToRefresh from '@/components/PullToRefresh';
import EventsCalendar from '@/components/EventsCalendar';
import { LayoutGrid, Calendar as CalIcon, ArrowUp, Search, X } from 'lucide-react';
import { hasUnread } from '@/lib/readArticles';
import { loadSiteContent, getContent } from '@/lib/siteContent';
import { useUxConfig } from '@/lib/UxConfigContext';

const BATCH = 60;
const PAGE_SIZE = 8;

function NewDot({ show }) {
  if (!show) return null;
  return <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-background" aria-hidden="true" />;
}

export default function GDMadonie() {
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const initialTab = ['comunicati', 'news', 'eventi'].includes(tabParam) ? tabParam : 'comunicati';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [content, setContent] = useState(null);
  const [view, setView] = useState('list');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [newsVisibleCount, setNewsVisibleCount] = useState(PAGE_SIZE);
  const [hasNew, setHasNew] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newsSearchQuery, setNewsSearchQuery] = useState('');
  const lastSig = useRef(null);
  const { config: ux } = useUxConfig();
  const cardStyle = ux.team_cards_bg_color ? { backgroundColor: ux.team_cards_bg_color } : undefined;

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


  const EmptyList = () => <div className="text-center py-12 text-muted-foreground text-sm">Nessun contenuto pubblicato.</div>;
  const FirstLoad = () => <div className="grid gap-4 lg:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <PostCardSkeleton key={i} />)}</div>;

  const visible = comunicati.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return p.title?.toLowerCase().includes(q) || p.excerpt?.toLowerCase().includes(q);
  }).slice(0, visibleCount);
  const hasMore = !searchQuery.trim() && visibleCount < comunicati.length;

  const visibleNews = newsGd.filter((p) => {
    if (!newsSearchQuery.trim()) return true;
    const q = newsSearchQuery.trim().toLowerCase();
    return p.title?.toLowerCase().includes(q) || p.excerpt?.toLowerCase().includes(q);
  }).slice(0, newsVisibleCount);
  const hasMoreNews = !newsSearchQuery.trim() && newsVisibleCount < newsGd.length;

  return (
    <PullToRefresh onRefresh={refreshAll}>
      <div className="space-y-4">
        <div>
          {content &&
          <>
              <h1 className="tracking-tight text-[hsl(var(--primary))] font-serif font-normal text-3xl">{getContent(content, 'gd_title')}</h1>
              <p className="text-muted-foreground mt-0.5 font-serif font-normal text-base">{getContent(content, 'gd_subtitle')}</p>
            </>
          }
        </div>
        {hasNew &&
        <button onClick={refreshAll} className="sticky top-0 z-30 w-full flex items-center justify-center gap-2 text-xs font-medium text-primary-foreground bg-primary px-4 py-2.5 rounded-full shadow-md">
            <ArrowUp className="w-3.5 h-3.5" /> Nuovi aggiornamenti disponibili — tocca per vedere
          </button>
        }
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full flex overflow-x-auto scrollbar-hide touch-pan-x bg-muted p-1 h-auto rounded-[999px]">
            <TabsTrigger value="comunicati" style={activeTab === 'comunicati' ? cardStyle : undefined} className="relative overflow-hidden flex-1 text-xs py-2.5 min-h-[44px] rounded-full">
              {activeTab === 'comunicati' && <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-black/10 to-transparent" />}
              <span className="relative">Comunicati</span><NewDot show={hasUnread(comunicati)} />
            </TabsTrigger>
            <TabsTrigger value="news" style={activeTab === 'news' ? cardStyle : undefined} className="relative overflow-hidden flex-1 text-xs py-2.5 min-h-[44px] rounded-full">
              {activeTab === 'news' && <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-black/10 to-transparent" />}
              <span className="relative">News GD</span><NewDot show={hasUnread(newsGd)} />
            </TabsTrigger>
            <TabsTrigger value="eventi" style={activeTab === 'eventi' ? cardStyle : undefined} className="relative overflow-hidden flex-1 text-xs py-2.5 min-h-[44px] rounded-full">
              {activeTab === 'eventi' && <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-black/10 to-transparent" />}
              <span className="relative">Eventi</span><NewDot show={hasUnread(eventi)} />
            </TabsTrigger>
          </TabsList>
          <TabsContent value="comunicati" className="mt-4 space-y-4">
            <div className="relative">
              <Search className="w-4 h-4 text-muted-foreground absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cerca tra i comunicati..."
              className="w-full pl-11 pr-10 py-2.5 min-h-[44px] rounded-full bg-muted text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />

              {searchQuery &&
              <button onClick={() => setSearchQuery('')} aria-label="Cancella ricerca" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"><X className="w-4 h-4" /></button>
              }
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
            {comunicatiQuery.isLoading && !comunicatiQuery.data ? <FirstLoad /> :
            visible.length === 0 && !comunicatiQuery.isFetching ? <EmptyList /> :
            <>
                {visible.map((p) => <PostCard key={p.id} post={p} />)}
                <div ref={sentinelRef} aria-hidden="true" className="lg:col-span-2" />
                {hasMore && <div className="flex justify-center py-6 lg:col-span-2"><div className="w-7 h-7 border-4 border-slate-200 border-t-primary rounded-full animate-spin" /></div>}
                {!hasMore && !searchQuery.trim() && comunicati.length >= BATCH && <p className="text-center text-xs text-muted-foreground py-3 lg:col-span-2">Hai visto tutti i comunicati recenti.</p>}
              </>
            }
            </div>
          </TabsContent>
          <TabsContent value="news" className="mt-4 space-y-4">
            <div className="relative">
              <Search className="w-4 h-4 text-muted-foreground absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
              type="text"
              value={newsSearchQuery}
              onChange={(e) => setNewsSearchQuery(e.target.value)}
              placeholder="Cerca tra le news..."
              className="w-full pl-11 pr-10 py-2.5 min-h-[44px] rounded-full bg-muted text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />

              {newsSearchQuery &&
              <button onClick={() => setNewsSearchQuery('')} aria-label="Cancella ricerca" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"><X className="w-4 h-4" /></button>
              }
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
            {newsQuery.isLoading && !newsQuery.data ? <FirstLoad /> :
            visibleNews.length === 0 && !newsQuery.isFetching ? <EmptyList /> :
            <>
                {visibleNews.map((p) => <PostCard key={p.id} post={p} />)}
                <div ref={newsSentinelRef} aria-hidden="true" className="lg:col-span-2" />
                {hasMoreNews && <div className="flex justify-center py-6 lg:col-span-2"><div className="w-7 h-7 border-4 border-slate-200 border-t-primary rounded-full animate-spin" /></div>}
                {!hasMoreNews && !newsSearchQuery.trim() && newsGd.length >= BATCH && <p className="text-center text-xs text-muted-foreground py-3 lg:col-span-2">Hai visto tutte le news recenti.</p>}
              </>
            }
            </div>
          </TabsContent>
          <TabsContent value="eventi" className="mt-4 space-y-3">
            {eventiQuery.isLoading && !eventiQuery.data ? <FirstLoad /> :
            <>
                <div className="flex items-center gap-1.5 bg-muted p-1 rounded-full">
                  <button onClick={() => setView('list')} aria-pressed={view === 'list'} style={view === 'list' ? cardStyle : undefined} className={`relative overflow-hidden flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2.5 min-h-[44px] transition-all rounded-full border ${view === 'list' ? `text-primary shadow-sm border-transparent scale-[1.03] ${cardStyle ? '' : 'bg-card'}` : 'text-muted-foreground border-border/50'}`}>
                    {view === 'list' && <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-black/10 to-transparent" />}
                    <LayoutGrid className="relative w-3.5 h-3.5" /> <span className="relative">Elenco</span>
                  </button>
                  <button onClick={() => setView('calendar')} aria-pressed={view === 'calendar'} style={view === 'calendar' ? cardStyle : undefined} className={`relative overflow-hidden flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2.5 min-h-[44px] transition-all rounded-full border ${view === 'calendar' ? `text-primary shadow-sm border-transparent scale-[1.03] ${cardStyle ? '' : 'bg-card'}` : 'text-muted-foreground border-border/50'}`}>
                    {view === 'calendar' && <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-black/10 to-transparent" />}
                    <CalIcon className="relative w-3.5 h-3.5" /> <span className="relative">Calendario</span>
                  </button>
                </div>
                {eventi.length === 0 ? <EmptyList /> : view === 'calendar' ? <EventsCalendar events={eventi} /> : eventi.map((ev) => <GdEventCard key={ev.id} event={ev} />)}
              </>
            }
          </TabsContent>
        </Tabs>
      </div>
    </PullToRefresh>);

}
