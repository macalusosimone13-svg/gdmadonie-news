// force retransform: chunk invalidate v3
import { Fragment, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams, useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { sb44 } from '@/api/supabaseEntities';
import { getCurrentUser } from '@/lib/supabaseAuth';
import { supabase } from '@/lib/supabaseClient';
import { RefreshCw, Bookmark, BookmarkCheck, ExternalLink, ChevronDown, ChevronUp, Check, Star, X, Search } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Image } from '@/components/ui/image';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import SourceBadge from '@/components/SourceBadge';
import RassegnaCardSkeleton from '@/components/RassegnaCardSkeleton';
import AdSlot from '@/components/AdSlot';
import { ADS_ENABLED } from '@/lib/adsConfig';
import { isUnread } from '@/lib/readArticles';
import { cleanExcerpt } from '@/lib/cleanText';
import PullToRefresh from '@/components/PullToRefresh';
import Pagination from '@/components/Pagination';

export default function RassegnaStampa() {
  const [searchParams] = useSearchParams();
  const { tipo } = useParams();
  const lockedCategory = tipo === 'nazionale' ? 'politica_nazionale' : tipo === 'regionale' ? 'politica_regionale' : null;
  const categoriaParam = searchParams.get('categoria');
  const initialCategory = lockedCategory || (['politica_nazionale', 'politica_regionale'].includes(categoriaParam) ? categoriaParam : 'all');
  const [category, setCategory] = useState(initialCategory);
  const [saved, setSaved] = useState([]);
  const [source, setSource] = useState('all');
  const [view, setView] = useState('feed');
  const [user, setUser] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshResult, setRefreshResult] = useState(null);
  const [sourceLogos, setSourceLogos] = useState({});
  const [testate, setTestate] = useState([]);
  const [favSources, setFavSources] = useState([]);
  const [page, setPage] = useState(1);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const PER_PAGE = 30;

  useEffect(() => {
    setCategory(lockedCategory || (['politica_nazionale', 'politica_regionale'].includes(categoriaParam) ? categoriaParam : 'all'));
    setSource('all');
    setSourceOpen(false);
    setView('feed');
  }, [tipo, categoriaParam]);

  const postsQuery = useQuery({
    queryKey: ['rassegna-posts', source, category],
    queryFn: () => {
      const query = { source_type: 'rassegna', status: 'published' };
      if (source !== 'all') query.source_name = source;
      if (category !== 'all') query.category = category;
      return base44.entities.Post.filter(query, '-published_date', 100);
    },
    staleTime: 3 * 60 * 1000
  });

  const loadSaved = () => {
    sb44.entities.SavedArticle.list('-created_at', 100).then((data) => setSaved(data || [])).catch(() => {});
  };

  const loadFavSources = () => {
    sb44.entities.FavoriteSource.list('-created_at', 100).then((data) => setFavSources(data || [])).catch(() => {});
  };

  useEffect(() => {
    getCurrentUser().then((u) => { if (u) {setUser(u);loadSaved();loadFavSources();} }).catch(() => {});
  }, []);

  useEffect(() => {
    sb44.entities.Testata.list('sort_order', 200).then((data) => {
      const list = (data || []).filter((t) => t.is_active !== false);
      setTestate(list);
      const map = {};
      for (const t of list) {
        let logo = t.logo_url;
        if (!logo && t.url_feed) {
          try {logo = 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(new URL(t.url_feed).hostname) + '&sz=128';} catch {}
        }
        map[t.name] = logo;
      }
      setSourceLogos(map);
    }).catch(() => {});
  }, []);

  const savedIds = new Set(saved.map((s) => s.post_id));
  const favSourceNames = new Set(favSources.map((f) => f.source_name));
  const posts = postsQuery.data || [];
  const loading = postsQuery.isLoading;
  const sortedTestate = [...testate].sort((a, b) => {
    const fa = favSourceNames.has(a.name) ? 0 : 1;
    const fb = favSourceNames.has(b.name) ? 0 : 1;
    return fa - fb;
  });
  const sources = [{ key: 'all', label: 'Tutte le fonti' }, ...sortedTestate.map((t) => ({ key: t.name, label: t.name }))];
  const filtered = (source === 'all' ? posts : posts.filter((p) => p.source_name === source)).filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return p.title?.toLowerCase().includes(q) || p.excerpt?.toLowerCase().includes(q);
  });

  const toggleFavSource = async (name) => {
    if (!user) {window.location.href = '/login';return;}
    const existing = favSources.find((f) => f.source_name === name);
    if (existing) {
      await sb44.entities.FavoriteSource.delete(existing.id);
      setFavSources((prev) => prev.filter((f) => f.id !== existing.id));
    } else {
      const created = await sb44.entities.FavoriteSource.create({ source_name: name });
      setFavSources((prev) => [created, ...prev]);
    }
  };

  const removeSavedItem = async (itemId) => {
    await sb44.entities.SavedArticle.delete(itemId);
    setSaved((prev) => prev.filter((s) => s.id !== itemId));
  };

  useEffect(() => {setPage(1);}, [source, category, searchQuery]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  const toggleSave = async (post) => {
    if (!user) {window.location.href = '/login';return;}
    if (savedIds.has(post.id)) {
      const rec = saved.find((s) => s.post_id === post.id);
      if (rec) await sb44.entities.SavedArticle.delete(rec.id);
      setSaved((prev) => prev.filter((s) => s.post_id !== post.id));
    } else {
      const created = await sb44.entities.SavedArticle.create({
        post_id: post.id, post_title: post.title, post_excerpt: post.excerpt,
        post_image_url: post.image_url, post_external_link: post.external_link,
        post_source_name: post.source_name, post_category: post.category
      });
      setSaved((prev) => [created, ...prev]);
    }
  };

  const refresh = async () => {
    setRefreshing(true);setRefreshResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('aggregate-rss', {});
      if (error) throw error;
      setRefreshResult(data);
      await postsQuery.refetch();
    } catch (e) {
      setRefreshResult({ error: e.message });
    }
    setRefreshing(false);
  };

  return (
    <PullToRefresh onRefresh={() => postsQuery.refetch()}>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-foreground tracking-tight font-serif font-normal text-3xl">{lockedCategory === 'politica_nazionale' ? 'Politica Nazionale' : lockedCategory === 'politica_regionale' ? 'Politica Regionale' : 'News'}</h1>
            <p className="text-muted-foreground mt-0.5 font-serif font-normal text-base">Notizie politiche dalle principali testate</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setView((v) => v === 'saved' ? 'feed' : 'saved')} aria-pressed={view === 'saved'} className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 min-h-[40px] rounded-full transition active:scale-95 ${view === 'saved' ? 'bg-emerald-500 text-white shadow-sm' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
              <Bookmark className="w-3.5 h-3.5" /> Salvati{saved.length > 0 && ` (${saved.length})`}
            </button>
            {user?.role === 'admin' &&
            <button onClick={refresh} disabled={refreshing} aria-label="Aggiorna feed RSS" className="inline-flex items-center gap-2 text-xs font-semibold text-white px-4 py-2.5 rounded-full disabled:opacity-60 min-h-[40px] shadow-sm active:scale-95 transition bg-[#0f1b3a]">
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Aggiorna
            </button>
            }
          </div>
        </div>

        {refreshResult &&
        <div className={`text-xs rounded-2xl p-3 ${refreshResult.error ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
            {refreshResult.error ? 'Errore: ' + refreshResult.error :
          'Importazione completata. ' + (refreshResult.results || []).map((r) => `${r.source}: +${r.added ?? r.error}`).join(' · ')}
          </div>
        }

        {view === 'feed' &&
        <>
            <div className="relative">
              <Search className="w-4 h-4 text-muted-foreground absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cerca tra le notizie..."
              className="w-full pl-11 pr-10 py-2.5 min-h-[44px] rounded-full bg-gray-200 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />

              {searchQuery &&
            <button onClick={() => setSearchQuery('')} aria-label="Cancella ricerca" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"><X className="w-4 h-4" /></button>
            }
            </div>
            {!lockedCategory &&
          <Popover open={sourceOpen} onOpenChange={setSourceOpen}>
              <PopoverTrigger asChild>
                <button className="w-full inline-flex items-center justify-between gap-2 text-xs font-semibold px-4 py-2.5 min-h-[40px] rounded-full text-foreground transition bg-gray-200">
                  <span className="inline-flex items-center gap-2 min-w-0">
                    {source !== 'all' && sourceLogos[source] && <img src={sourceLogos[source]} alt="" className="w-5 h-5 rounded-full object-contain bg-white p-0.5 shrink-0 ring-1 ring-border" loading="lazy" decoding="async" />}
                    <span className="truncate text-base font-serif font-normal">{sources.find((s) => s.key === source)?.label || 'Tutte le fonti'}</span>
                  </span>
                  {sourceOpen ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
                </button>
              </PopoverTrigger>
              <PopoverContent className="p-1 max-h-[60vh] overflow-y-auto w-[var(--radix-popover-trigger-width)] rounded-2xl" align="start" sideOffset={4}>
                <button onClick={() => {setSource('all');setSourceOpen(false);}} className={`flex items-center gap-3 w-full px-3 py-3 text-base font-medium transition-colors text-left rounded-[99999px] text-[hsl(var(--popover-foreground))] bg-gray-200 ${source === 'all' ? "" : 'hover:bg-gray-200 text-foreground'}`}>
                  <span className="truncate flex-1 font-serif font-normal">Tutte le fonti</span>
                  {source === 'all' && <Check className="w-5 h-5 shrink-0" />}
                </button>
                {sortedTestate.map((t) =>
              <div key={t.name} className={`group flex items-center gap-1 w-full rounded-[99999px] transition-colors ${source === t.name ? 'bg-gray-200 text-foreground' : 'hover:bg-gray-200'}`}>
                    <button onClick={() => {setSource(t.name);setSourceOpen(false);}} className="flex items-center gap-3 flex-1 min-w-0 px-3 py-3 text-base font-medium text-left text-[hsl(var(--muted-foreground))] group-hover:text-foreground">
                      {sourceLogos[t.name] && <img src={sourceLogos[t.name]} alt="" className="w-9 h-9 rounded-full object-contain bg-white p-1 shrink-0 ring-1 ring-border" loading="lazy" decoding="async" />}
                      <span className="truncate flex-1 font-serif font-normal">{t.name}</span>
                      {source === t.name && <Check className="w-5 h-5 shrink-0" />}
                    </button>
                    <button onClick={(e) => {e.stopPropagation();toggleFavSource(t.name);}} aria-label={favSourceNames.has(t.name) ? 'Togli dalle preferite' : 'Aggiungi alle preferite'} className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center mr-1">
                      <Star className={`w-4 h-4 ${favSourceNames.has(t.name) ? 'fill-current text-amber-400' : 'text-muted-foreground'}`} />
                    </button>
                  </div>
              )}
              </PopoverContent>
            </Popover>
          }
            {!lockedCategory && source !== 'all' && (() => {
            const t = testate.find((x) => x.name === source);
            return t?.web_url ?
            <a href={t.web_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline py-1">
                  Visita il sito <ExternalLink className="w-3 h-3" />
                </a> :
            null;
          })()}
            {loading ?
          <div className="grid gap-3 lg:grid-cols-2">
                {Array.from({ length: 6 }).map((_, i) => <RassegnaCardSkeleton key={i} />)}
              </div> :
          filtered.length === 0 ?
          <div className="text-center py-12 text-muted-foreground text-sm">Nessuna notizia. {user?.role === 'admin' && 'Premi "Aggiorna" per importare.'}</div> :

          <>
              <div className="grid gap-3 lg:grid-cols-2">
                {paged.map((p, i) =>
              <Fragment key={p.id}>
                    <RassegnaCard post={p} saved={savedIds.has(p.id)} onToggleSave={toggleSave} />
                    {(i + 1) % 4 === 0 && ADS_ENABLED && <AdSlot slot="9679026925" />}
                  </Fragment>
              )}
              </div>
              <Pagination page={safePage} totalPages={totalPages} onChange={setPage} />
          </>
          }
          </>
        }

        {view === 'saved' &&
        <div className="space-y-3">
            {!user ?
          <div className="text-center py-12 text-muted-foreground text-sm">
                <p>Accedi per salvare articoli da leggere dopo.</p>
                <a href="/login" className="text-primary font-medium underline mt-2 inline-block">Accedi</a>
              </div> :
          saved.length === 0 ?
          <div className="text-center py-12 text-muted-foreground text-sm">Nessun articolo salvato.</div> :
          saved.map((s) => <SavedCard key={s.id} item={s} logo={sourceLogos[s.post_source_name]} onRemove={() => removeSavedItem(s.id)} />)}
          </div>
        }
      </div>
    </PullToRefresh>);


}

function RassegnaCard({ post, saved, onToggleSave }) {
  const date = post.published_date ? format(new Date(post.published_date), 'dd/MM/yyyy · HH:mm', { locale: it }) : '';
  return (
    <article className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
      {post.image_url &&
      <Link to={`/articolo/${post.id}`} className="block cursor-pointer relative bg-muted">
          <div className="aspect-[16/9] overflow-hidden">
            <Image src={post.image_url} fittingType="fill" alt={post.title} className="w-full h-full" />
          </div>
          <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 flex-wrap">
            <SourceBadge post={post} variant="overlay" />
            {isUnread(post.id) && <span className="text-xs font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-emerald-500 text-white">Nuovo</span>}
          </div>
        </Link>
      }
      <Link to={`/articolo/${post.id}`} className="block cursor-pointer p-4">
        {!post.image_url &&
        <div className="flex items-center gap-2 mb-2 flex-wrap">
            <SourceBadge post={post} variant="overlay" />
            {isUnread(post.id) && <span className="text-xs font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-emerald-500 text-white">Nuovo</span>}
            {date && <span className="text-xs text-muted-foreground ml-auto">{date}</span>}
          </div>
        }
        {post.image_url && date && <span className="block text-xs text-muted-foreground mb-2">{date}</span>}
        <h2 className="text-lg font-semibold text-foreground leading-snug mb-1 hover:text-primary transition-colors">{post.title}</h2>
        {post.excerpt && <p className="text-sm text-muted-foreground line-clamp-3 mb-3">{cleanExcerpt(post.excerpt)}</p>}
      </Link>
      <div className="flex items-center justify-end px-4 pb-4">
        <button onClick={() => onToggleSave(post)} aria-label={saved ? 'Rimuovi dai salvati' : 'Salva articolo'} className="text-muted-foreground hover:text-primary bg-muted hover:bg-accent p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full transition-colors active:scale-95">
          {saved ? <BookmarkCheck className="w-4 h-4 text-primary" /> : <Bookmark className="w-4 h-4" />}
        </button>
      </div>
    </article>);

}

function SavedCard({ item, logo, onRemove }) {
  return (
    <div className="relative block bg-card rounded-2xl border border-border p-4 shadow-sm hover:shadow-md transition-shadow">
      <button onClick={onRemove} aria-label="Rimuovi dai salvati" className="absolute top-3 right-3 w-9 h-9 rounded-full bg-muted hover:bg-red-50 hover:text-red-600 flex items-center justify-center text-muted-foreground transition-colors">
        <X className="w-4 h-4" />
      </button>
      <Link to={`/articolo/${item.post_id}`} className="block pr-8">
        <div className="flex items-center gap-1.5 mb-2 min-w-0">
          {logo && <img src={logo} alt="" className="w-5 h-5 rounded-full object-contain bg-white p-0.5 ring-1 ring-border shrink-0" loading="lazy" decoding="async" />}
          <span className="text-xs font-medium text-muted-foreground truncate">{item.post_source_name || 'Salvato'}</span>
        </div>
        <h2 className="text-lg font-semibold text-foreground leading-snug mb-1">{item.post_title}</h2>
        {item.post_excerpt && <p className="text-sm text-muted-foreground line-clamp-2">{cleanExcerpt(item.post_excerpt)}</p>}
      </Link>
    </div>);
}
