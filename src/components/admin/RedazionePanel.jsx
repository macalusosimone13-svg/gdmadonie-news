import { useEffect, useMemo, useRef, useState } from 'react';
import { sb44 } from '@/api/supabaseEntities';
import { supabase } from '@/lib/supabaseClient';
import { buildStoryBlob, STORY_DEFAULTS } from '@/lib/storyImage';
import { CATEGORIES } from '@/lib/categories';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sparkles, Send, ImageIcon, Search, Check, Loader2, ExternalLink, Download } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

// Bottoni "pillola" nello stesso stile usato dal resto dell'Admin
// (Nuovo post, Nuovo evento): pieno blu per l'azione principale,
// bordo scuro per quella secondaria. Qui come classi dirette, così
// il look è identico ovunque compaiano questi pulsanti, anche
// annidati dentro le card della rassegna.
const PILL_PRIMARY = "inline-flex items-center justify-center gap-2 min-h-[46px] px-5 rounded-full bg-[#2F5BD8] text-white font-extrabold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:bg-[#2A4FC0]";
const PILL_SECONDARY = "inline-flex items-center justify-center gap-2 min-h-[46px] px-5 rounded-full border-[1.5px] border-[#0F1B3A] text-[#0F1B3A] bg-white font-extrabold text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors hover:bg-[#F4F7FE]";
// Pulsante "IA": tinta azzurrina, stesso linguaggio delle aree
// tratteggiate blu già usate sul sito per le azioni assistite dall'IA.
const PILL_AI = "inline-flex items-center gap-2 text-sm font-bold text-[#2F5BD8] bg-[#F4F7FE] border border-[#2F5BD8]/35 rounded-full px-4 py-2.5 min-h-[44px] disabled:opacity-60 transition-colors hover:bg-[#EAF0FD]";

// Chiama la function Supabase "redazione-ai", che genera il testo
// nello stile di GD Madonie. Solo per l'admin (Simone): la function stessa
// rifiuta chiunque abbia un ruolo diverso, anche se qualcun altro riuscisse
// a vedere questa pagina.
async function generateAI(payload) {
  const { data, error } = await supabase.functions.invoke('redazione-ai', { body: payload });
  if (error) throw new Error(error.message || 'Generazione non riuscita');
  if (data?.error) throw new Error(data.error);
  return data;
}

async function publishToNewsGD({ title, body }) {
  const created = await sb44.entities.Post.create({
    title,
    content: body,
    excerpt: body.length > 220 ? body.slice(0, 217) + '…' : body,
    category: 'news_gd',
    author: 'GD Madonie',
    source_type: 'gd_madonie',
    status: 'published',
    published_date: new Date().toISOString()
  });
  try {
    await supabase.functions.invoke('notify-new-post', { body: { post_id: created.id, app_url: window.location.origin } });
  } catch {}
  return created;
}

// --- Grafica (locandina) -----------------------------------------------
// Riusa lo stesso motore Canvas già in produzione per le Storie/Post
// condivisi dal sito (src/lib/storyImage.js): stessi colori, stesso logo
// reale del sito (niente più scritta segnaposto), stesso fallback se il
// logo non si legge. Qui senza foto: va sul layout "solo testo".
function GraphicModal({ open, onClose, title, body, storyConfig, siteLogo }) {
  const [fmt, setFmt] = useState('post');
  const [url, setUrl] = useState('');
  const [blob, setBlob] = useState(null);
  const [busy, setBusy] = useState(false);
  const objUrl = useRef(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setBusy(true);
    buildStoryBlob({
      format: fmt,
      category: 'News GD',
      title,
      bodyText: body,
      domain: storyConfig.domain_text_gd || STORY_DEFAULTS.domain_text_gd,
      primaryColor: '#0F1B3A',
      logoUrl: storyConfig.logo_url || siteLogo,
      brandTitle: storyConfig.brand_title,
      brandSubtitle: storyConfig.brand_subtitle,
      bgGradientStart: storyConfig.bg_gradient_start,
      bgGradientEnd: storyConfig.bg_gradient_end,
      categoryBg: storyConfig.category_bg_color,
      categoryText: storyConfig.category_text_color,
      titleColor: storyConfig.title_color,
      overlayIntensity: storyConfig.overlay_intensity,
      showCategory: storyConfig.show_category,
      showDomain: storyConfig.show_domain,
      topBandEnabled: storyConfig.top_band_enabled,
      topBandColor: storyConfig.top_band_color,
      topBandOpacity: storyConfig.top_band_opacity,
      logoSize: storyConfig.logo_size,
      categoryGap: storyConfig.category_gap
    }).then((b) => {
      if (cancelled) return;
      if (objUrl.current) URL.revokeObjectURL(objUrl.current);
      const u = URL.createObjectURL(b);
      objUrl.current = u;
      setUrl(u);
      setBlob(b);
    }).finally(() => !cancelled && setBusy(false));
    return () => { cancelled = true; };
  }, [open, fmt, title, body, storyConfig, siteLogo]);

  const download = () => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `news-gd-${fmt}-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Grafica per News GD</DialogTitle></DialogHeader>
        <div className="flex flex-col items-center gap-4">
          <div className="flex bg-muted rounded-full p-1 text-xs font-medium">
            <button type="button" onClick={() => setFmt('post')} className={`px-3 py-1.5 rounded-full ${fmt === 'post' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}>Post (4:5)</button>
            <button type="button" onClick={() => setFmt('story')} className={`px-3 py-1.5 rounded-full ${fmt === 'story' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}>Storia (9:16)</button>
          </div>
          {busy && !url ?
          <div className={`w-full ${fmt === 'post' ? 'max-w-[260px] aspect-[4/5]' : 'max-w-[230px] aspect-[9/16]'} rounded-2xl bg-muted flex items-center justify-center`}>
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div> :
          <img src={url} alt="Anteprima grafica" className={`w-full ${fmt === 'post' ? 'max-w-[260px]' : 'max-w-[230px]'} rounded-2xl border border-border shadow-sm`} />
          }
          <button type="button" onClick={download} disabled={!blob} className={`${PILL_PRIMARY} w-full`}>
            <Download className="w-4 h-4" /> Scarica PNG
          </button>
        </div>
      </DialogContent>
    </Dialog>);
}

// --- Riquadro comune per un testo generato (bozza rassegna o "Scrivi tu") ---
// È un <form> (come "Nuovo post"/"Nuovo evento"): stessa cornice,
// stessi campi, stessi pulsanti del resto dell'Admin.
function DraftEditor({ title, body, onChange, onPublish, onOpenGraphic, publishing, published }) {
  return (
    <form onSubmit={(e) => e.preventDefault()} className="space-y-3">
      <Input value={title} onChange={(e) => onChange({ title: e.target.value, body })} placeholder="Titolo" className="font-semibold" />
      <Textarea value={body} onChange={(e) => onChange({ title, body: e.target.value })} rows={6} placeholder="Testo del post..." />
      <p className="text-[11px] text-muted-foreground">{body.length} caratteri — puoi modificare tutto prima di pubblicare.</p>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button type="button" onClick={onOpenGraphic} disabled={!title.trim()} className={PILL_SECONDARY}>
          <ImageIcon className="w-4 h-4" /> Genera locandina
        </button>
        <button type="button" onClick={onPublish} disabled={publishing || !title.trim() || !body.trim()} className={PILL_PRIMARY}>
          {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : published ? <Check className="w-4 h-4" /> : <Send className="w-4 h-4" />}
          {published ? 'Pubblicato su News GD' : 'Pubblica su News GD'}
        </button>
        {published &&
        <a href={`/articolo/${published.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-[#2F5BD8] font-bold hover:underline px-2">
            Vedi il post <ExternalLink className="w-3.5 h-3.5" />
          </a>
        }
      </div>
    </form>);
}

// --- Tab "Rassegna": ogni notizia già raccolta dal sito, con generazione
// del commento su richiesta (non tutte insieme, per non sprecare chiamate). ---
// Stessa struttura a elenco di card della sezione "Post ed eventi
// pubblicati": ogni notizia è una card, la bozza generata appare dentro
// la stessa card, come un modulo che si apre lì.
function RassegnaTab({ storyConfig, siteLogo }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState('all');
  const [q, setQ] = useState('');
  const [drafts, setDrafts] = useState({}); // id -> { title, body, generating, publishing, published, error }
  const [graphicFor, setGraphicFor] = useState(null);

  const load = () => {
    setLoading(true);
    sb44.entities.Post.filter({ source_type: 'rassegna', status: 'published' }, '-published_date', 80)
      .then((data) => setPosts(data || []))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => posts.filter((p) => {
    if (cat !== 'all' && p.category !== cat) return false;
    if (q.trim() && !p.title?.toLowerCase().includes(q.trim().toLowerCase())) return false;
    return true;
  }), [posts, cat, q]);

  const setDraft = (id, patch) => setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));

  const generate = async (post) => {
    setDraft(post.id, { generating: true, error: null });
    try {
      const result = await generateAI({
        mode: 'comment',
        title: post.title,
        excerpt: post.excerpt,
        content: post.content,
        source_name: post.source_name,
        category: post.category
      });
      setDraft(post.id, { title: result.title || post.title, body: result.body || '', generating: false });
    } catch (e) {
      setDraft(post.id, { generating: false, error: e.message });
    }
  };

  const publish = async (post) => {
    const d = drafts[post.id];
    if (!d) return;
    setDraft(post.id, { publishing: true });
    try {
      const created = await publishToNewsGD({ title: d.title, body: d.body });
      setDraft(post.id, { publishing: false, published: created });
    } catch (e) {
      setDraft(post.id, { publishing: false, error: e.message });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center bg-card border border-border rounded-2xl p-3">
        <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-2 flex-1 min-w-[180px]">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca tra le notizie…" className="bg-transparent outline-none text-sm w-full" />
        </div>
        <div className="flex bg-muted rounded-full p-1 text-xs font-medium">
          {[['all', 'Tutte'], ['politica_nazionale', 'Nazionale'], ['politica_regionale', 'Regionale']].map(([k, l]) =>
          <button key={k} type="button" onClick={() => setCat(k)} className={`px-3 py-1.5 rounded-full ${cat === k ? 'bg-[#2F5BD8] text-white' : 'text-muted-foreground'}`}>{l}</button>
          )}
        </div>
      </div>

      {loading ?
      <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div> :
      filtered.length === 0 ?
      <p className="text-sm text-muted-foreground text-center py-8">Nessuna notizia trovata.</p> :

      <div className="space-y-3">
          {filtered.map((post) => {
          const d = drafts[post.id] || {};
          const hasDraft = d.title !== undefined;
          return (
            <div key={post.id} className={`bg-card border rounded-2xl p-4 space-y-3 transition-colors ${hasDraft ? 'border-[#2F5BD8]/40' : 'border-border'}`}>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">{post.source_name}{post.published_date ? ' · ' + format(new Date(post.published_date), 'd MMM, HH:mm', { locale: it }) : ''} · {CATEGORIES[post.category]?.label}</p>
                  <h3 className="font-semibold text-foreground leading-snug mt-0.5">{post.title}</h3>
                  {post.excerpt && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{post.excerpt}</p>}
                </div>

                {hasDraft ?
              <div className="border-t border-border pt-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-[#2F5BD8] mb-2">Bozza di GD Madonie</p>
                  <DraftEditor
                  title={d.title}
                  body={d.body}
                  onChange={({ title, body }) => setDraft(post.id, { title, body })}
                  onPublish={() => publish(post)}
                  onOpenGraphic={() => setGraphicFor({ title: d.title, body: d.body })}
                  publishing={d.publishing}
                  published={d.published} />
                </div> :

              <button type="button" onClick={() => generate(post)} disabled={d.generating} className={PILL_AI}>
                    {d.generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {d.generating ? 'Genero…' : "Genera commento con l'IA"}
                  </button>
              }
                {d.error && <p className="text-xs text-red-600">{d.error}</p>}
              </div>);

        })}
        </div>
      }

      <GraphicModal
        open={!!graphicFor}
        onClose={() => setGraphicFor(null)}
        title={graphicFor?.title || ''}
        body={graphicFor?.body || ''}
        storyConfig={storyConfig}
        siteLogo={siteLogo} />

    </div>);
}

// --- Tab "Scrivi tu": argomento libero -> post completo -------------------
// La parte di input è un <form>, come "Nuovo post": stessa cornice bianca
// arrotondata del resto dell'Admin, non più "nuda" sullo sfondo pagina.
function ScriviTuTab({ storyConfig, siteLogo }) {
  const [topic, setTopic] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [draft, setDraft] = useState(null); // { title, body }
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(null);
  const [graphicOpen, setGraphicOpen] = useState(false);

  const generate = async () => {
    if (!topic.trim()) return;
    setGenerating(true); setError(null);
    try {
      const result = await generateAI({ mode: 'compose', topic });
      setDraft({ title: result.title || '', body: result.body || '' });
      setPublished(null);
    } catch (e) {
      setError(e.message);
    }
    setGenerating(false);
  };

  const publish = async () => {
    if (!draft) return;
    setPublishing(true);
    try {
      const created = await publishToNewsGD(draft);
      setPublished(created);
    } catch (e) {
      setError(e.message);
    }
    setPublishing(false);
  };

  return (
    <div className="space-y-4">
      <form onSubmit={(e) => e.preventDefault()} className="space-y-3">
        <label className="text-sm font-medium text-foreground block">Di cosa vuoi parlare?</label>
        <Textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={4} placeholder="Scrivi anche solo due righe, il fatto o l'argomento — es. «il piano paesaggistico delle Madonie, è successo questo...»" />
        <button type="button" onClick={generate} disabled={generating || !topic.trim()} className={PILL_AI}>
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {generating ? 'Genero…' : "Genera post con l'IA"}
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </form>

      {draft &&
      <div className="bg-card border border-[#2F5BD8]/40 rounded-2xl p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#2F5BD8] mb-2">Bozza di GD Madonie</p>
          <DraftEditor
          title={draft.title}
          body={draft.body}
          onChange={setDraft}
          onPublish={publish}
          onOpenGraphic={() => setGraphicOpen(true)}
          publishing={publishing}
          published={published} />

        </div>
      }

      <GraphicModal
        open={graphicOpen}
        onClose={() => setGraphicOpen(false)}
        title={draft?.title || ''}
        body={draft?.body || ''}
        storyConfig={storyConfig}
        siteLogo={siteLogo} />

    </div>);
}

export default function RedazionePanel() {
  const [tab, setTab] = useState('rassegna');
  const [storyConfig, setStoryConfig] = useState({});
  const [siteLogo, setSiteLogo] = useState('');

  useEffect(() => {
    Promise.all([
    sb44.entities.StoryShareConfig.filter({ key: 'main' }, '-updated_date', 1),
    sb44.entities.SiteContent.filter({ key: 'site_logo_url' }, '-updated_date', 1)]
    ).then(([configs, logos]) => {
      setStoryConfig({ ...STORY_DEFAULTS, ...(configs?.[0] || {}) });
      setSiteLogo(logos?.[0]?.value || '');
    });
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex bg-muted rounded-full p-1 text-sm font-medium w-fit">
        <button type="button" onClick={() => setTab('rassegna')} className={`px-4 py-2 rounded-full ${tab === 'rassegna' ? 'bg-[#2F5BD8] text-white' : 'text-muted-foreground'}`}>Rassegna</button>
        <button type="button" onClick={() => setTab('scrivitu')} className={`px-4 py-2 rounded-full ${tab === 'scrivitu' ? 'bg-[#2F5BD8] text-white' : 'text-muted-foreground'}`}>Scrivi tu</button>
      </div>
      {tab === 'rassegna' ? <RassegnaTab storyConfig={storyConfig} siteLogo={siteLogo} /> : <ScriviTuTab storyConfig={storyConfig} siteLogo={siteLogo} />}
    </div>);
}
