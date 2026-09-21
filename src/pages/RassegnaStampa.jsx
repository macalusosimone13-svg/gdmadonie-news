// force retransform: chunk invalidate v3
import { Fragment, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams, useParams } from 'react-router-dom';
import { sb44 } from '@/api/supabaseEntities';
import { getCurrentUser } from '@/lib/supabaseAuth';
import { supabase } from '@/lib/supabaseClient';
import { RefreshCw, Bookmark, BookmarkCheck, ExternalLink, Star, X, Search } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import AdSlot from '@/components/AdSlot';
import { ADS_ENABLED } from '@/lib/adsConfig';
import { isUnread } from '@/lib/readArticles';
import { cleanExcerpt } from '@/lib/cleanText';
import PullToRefresh from '@/components/PullToRefresh';
import Pagination from '@/components/Pagination';
import { useSEO } from '@/lib/useSEO';
import Reveal from '@/components/Reveal';


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

  // Pagina di puro aggregatore (titoli, estratti e link verso altre testate):
  // niente contenuto originale nostro, quindi fuori dall'indice di Google —
  // stesso trattamento già riservato ai singoli articoli di rassegna, per
  // non farla contare come "contenuto di scarso valore" nella revisione AdSense.
  useSEO({
    title: 'Rassegna Stampa — GD Madonie News',
    description: 'Notizie di politica nazionale e regionale raccolte da altre testate.',
    noindex: true
  });

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
      return sb44.entities.Post.filter(query, '-published_date', 100);
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
  const testateForView = lockedCategory ? testate.filter((t) => t.category === lockedCategory) : testate;
  const sortedTestate = [...testateForView].sort((a, b) => {
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

  const titleTxt = lockedCategory === 'politica_nazionale' ? 'NAZIONALE' : lockedCategory === 'politica_regionale' ? 'REGIONALE' : 'TUTTE LE NEWS';
  const subTxt = lockedCategory === 'politica_nazionale' ? 'La rassegna stampa nazionale: le notizie di politica che contano, dalle principali testate.' :
  lockedCategory === 'politica_regionale' ? 'La rassegna stampa regionale: Sicilia, Ars, territori e aree interne.' :
  'La rassegna stampa dalle principali testate, nazionali e regionali, in un unico posto.';
  const tabs = [['/rassegna-stampa', 'Tutte', !lockedCategory], ['/rassegna-stampa/nazionale', 'Nazionale', lockedCategory === 'politica_nazionale'], ['/rassegna-stampa/regionale', 'Regionale', lockedCategory === 'politica_regionale']];
  const activeFav = source !== 'all' && favSourceNames.has(source);
  const siteTestata = source !== 'all' ? testate.find((x) => x.name === source) : null;

  return (
    <PullToRefresh onRefresh={() => postsQuery.refetch()}>
      <div className="rd-page">
        <div className="page-head"><div className="hero-glow" /><div className="wrap-wide">
          <span className="section-kicker">L'informazione delle Madonie</span>
          <h1>{titleTxt}</h1>
          <p>{subTxt}</p>
          <div className="tabs">
            {tabs.map(([to, l, on]) => <Link key={to} to={to} className={`tab ${on ? 'active' : ''}`}>{l}</Link>)}
            <button onClick={() => setView((v) => v === 'saved' ? 'feed' : 'saved')} aria-pressed={view === 'saved'} className={`tab ${view === 'saved' ? 'active' : ''}`} style={{ marginLeft: 'auto' }}>
              <Bookmark size={13} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 6 }} />Salvati{saved.length > 0 && ` (${saved.length})`}
            </button>
            {user?.role === 'admin' &&
            <button onClick={refresh} disabled={refreshing} className="tab" aria-label="Aggiorna feed RSS">
                <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 6 }} />Aggiorna
              </button>}
          </div>
        </div></div>

        <div className="wrap-wide news-body">
          {refreshResult &&
          <div className="msg" style={{ marginBottom: 14, color: refreshResult.error ? '#c22b2b' : '#0a8a4a' }}>
              {refreshResult.error ? 'Errore: ' + refreshResult.error : 'Importazione completata. ' + (refreshResult.results || []).map((r) => `${r.source}: +${r.added ?? r.error}`).join(' · ')}
            </div>}

          {view === 'feed' &&
          <>
              <div className="search-box">
                <Search size={16} style={{ opacity: .5 }} />
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Cerca tra le notizie…" />
                {searchQuery && <button onClick={() => setSearchQuery('')} aria-label="Cancella ricerca"><X size={16} /></button>}
              </div>
              <div className="source-chips">
                {sources.map((s) =>
              <button key={s.key} title={s.label} aria-label={s.label} onClick={() => setSource(s.key)} className={`schip ${source === s.key ? 'active' : ''}`}>
                    {s.key !== 'all' && sourceLogos[s.key] && <img className="schip-logo" src={sourceLogos[s.key]} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} />}{favSourceNames.has(s.key) && <Star size={11} style={{ display: 'inline', marginRight: 5, verticalAlign: '-1px' }} fill="currentColor" />}<span className="schip-label">{s.label}</span>
                  </button>
              )}
              </div>
              {source !== 'all' &&
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', margin: '4px 0 6px', fontSize: 13, fontWeight: 700 }}>
                  <span className="sel-source">{source}</span>
                  <button onClick={() => toggleFavSource(source)} style={{ color: 'var(--acc)' }}>{activeFav ? '★ Togli dalle preferite' : '☆ Aggiungi alle preferite'}</button>
                  {siteTestata?.web_url && <a href={siteTestata.web_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--acc)' }}>Visita il sito <ExternalLink size={12} style={{ display: 'inline' }} /></a>}
                </div>}
              <div className="news-count">{loading ? 'Caricamento…' : `${filtered.length} articol${filtered.length === 1 ? 'o' : 'i'}`}</div>
              {loading ?
            <div className="news-main-grid">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="skel" style={{ height: 340 }} />)}</div> :
            filtered.length === 0 ?
            <div style={{ textAlign: 'center', padding: '48px 0', opacity: .6 }}>Nessuna notizia. {user?.role === 'admin' && 'Premi "Aggiorna" per importare.'}</div> :
            <>
                  <div className="news-main-grid">
                    {paged.map((p, i) =>
                <Fragment key={p.id}>
                        <Reveal><RassegnaCard post={p} saved={savedIds.has(p.id)} onToggleSave={toggleSave} /></Reveal>
                        {(i + 1) % 8 === 0 && ADS_ENABLED && <div style={{ gridColumn: '1 / -1' }}><AdSlot slot="9679026925" /></div>}
                      </Fragment>
                )}
                  </div>
                  <Pagination page={safePage} totalPages={totalPages} onChange={setPage} />
                </>}
            </>}

          {view === 'saved' &&
          <div className="news-main-grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))' }}>
              {!user ?
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '48px 0', opacity: .7 }}>Accedi per salvare articoli da leggere dopo. <Link to="/login" style={{ color: 'var(--acc)', fontWeight: 800 }}>Accedi</Link></div> :
            saved.length === 0 ?
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '48px 0', opacity: .6 }}>Nessun articolo salvato.</div> :
            saved.map((s) => <SavedCard key={s.id} item={s} onRemove={() => removeSavedItem(s.id)} />)}
            </div>}
        </div>
      </div>
    </PullToRefresh>);

}

function RassegnaCard({ post, saved, onToggleSave }) {
  const date = post.published_date ? format(new Date(post.published_date), 'd MMMM yyyy', { locale: it }) : '';
  const img = post.image_url && post.media_type !== 'video' ? post.image_url : post.poster_url;
  return (
    <article className={`article-card${img ? '' : ' noimg'}`} style={{ position: 'relative', height: '100%' }}>
      <Link to={`/articolo/${post.id}`} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        {img && <div className="card-media"><img src={img} alt="" loading="lazy" decoding="async" /></div>}
        <div className="card-body" style={{ paddingBottom: 56 }}>
          <div className="meta-line">{post.source_name} <span className="d">· {date}</span>{isUnread(post.id) && <span className="chip-blu" style={{ marginLeft: 8, padding: '2px 8px', fontSize: 10 }}>Nuovo</span>}</div>
          <h3>{post.title}</h3>
          {post.excerpt && <p>{cleanExcerpt(post.excerpt)}</p>}
        </div>
      </Link>
      <button onClick={() => onToggleSave(post)} aria-label={saved ? 'Rimuovi dai salvati' : 'Salva articolo'} className="icon-btn" style={{ position: 'absolute', right: 12, bottom: 12, width: 40, height: 40 }}>
        {saved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
      </button>
    </article>);
}

function SavedCard({ item, onRemove }) {
  return (
    <article className="article-card noimg" style={{ position: 'relative' }}>
      <Link to={`/articolo/${item.post_id}`} style={{ display: 'block' }}>
        <div className="card-body" style={{ paddingRight: 56 }}>
          <div className="meta-line">{item.post_source_name || 'Salvato'}</div>
          <h3>{item.post_title}</h3>
          {item.post_excerpt && <p>{cleanExcerpt(item.post_excerpt)}</p>}
        </div>
      </Link>
      <button onClick={onRemove} aria-label="Rimuovi dai salvati" className="icon-btn" style={{ position: 'absolute', top: 12, right: 12, width: 36, height: 36 }}><X size={15} /></button>
    </article>);
}
