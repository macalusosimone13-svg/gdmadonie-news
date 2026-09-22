import { useEffect, useMemo, useRef, useState } from 'react';
import { sb44 } from '@/api/supabaseEntities';
import { supabase } from '@/lib/supabaseClient';
import { buildStoryBlob, STORY_DEFAULTS } from '@/lib/storyImage';
import { CATEGORIES } from '@/lib/categories';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sparkles, Send, ImageIcon, Search, Check, Loader2, ExternalLink, Download } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

// Chiama la function Supabase "redazione-ai" (Gemini), che genera il testo
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
          <Button type="button" onClick={download} disabled={!blob} className="w-full">
            <Download className="w-4 h-4 mr-2" /> Scarica PNG
          </Button>
        </div>
      </DialogContent>
    </Dialog>);
}

// --- Riquadro comune per un testo generato (bozza rassegna o "Scrivi tu") ---
function DraftEditor({ title, body, onChange, onPublish, onOpenGraphic, publishing, published }) {
  return (
    <div className="space-y-3">
      <Input value={title} onChange={(e) => onChange({ title: e.target.value, body })} placeholder="Titolo" className="font-semibold" />
      <Textarea value={body} onChange={(e) => onChange({ title, body: e.target.value })} rows={6} placeholder="Testo del post..." />
      <p className="text-[11px] text-muted-foreground">{body.length} caratteri — puoi modificare tutto prima di pubblicare.</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={onOpenGraphic} disabled={!title.trim()}>
          <ImageIcon className="w-4 h-4 mr-2" /> Genera locandina
        </Button>
        <Button type="button" onClick={onPublish} disabled={publishing || !title.trim() || !body.trim()} className="bg-[#2F5BD8]">
          {publishing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : published ? <Check className="w-4 h-4 mr-2" /> : <Send className="w-4 h-4 mr-2" />}
          {published ? 'Pubblicato su News GD' : 'Pubblica su News GD'}
        </Button>
        {published &&
        <a href={`/articolo/${published.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline px-2">
            Vedi il post <ExternalLink className="w-3.5 h-3.5" />
          </a>
        }
      </div>
    </div>);
}

// --- Tab "Rassegna": ogni notizia già raccolta dal sito, con generazione
// del commento su richiesta (non tutte insieme, per non sprecare chiamate). ---
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
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-2 flex-1 min-w-[180px]">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca tra le notizie…" className="bg-transparent outline-none text-sm w-full" />
        </div>
        <div className="flex bg-muted rounded-full p-1 text-xs font-medium">
          {[['all', 'Tutte'], ['politica_nazionale', 'Nazionale'], ['politica_regionale', 'Regionale']].map(([k, l]) =>
          <button key={k} type="button" onClick={() => setCat(k)} className={`px-3 py-1.5 rounded-full ${cat === k ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}>{l}</button>
          )}
        </div>
      </div>

      {loading ?
      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /> :
      filtered.length === 0 ?
      <p className="text-sm text-muted-foreground">Nessuna notizia trovata.</p> :

      <div className="space-y-3">
          {filtered.map((post) => {
          const d = drafts[post.id] || {};
          return (
            <div key={post.id} className="bg-card border border-border rounded-2xl p-4 space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">{post.source_name}{post.published_date ? ' · ' + format(new Date(post.published_date), 'd MMM, HH:mm', { locale: it }) : ''} · {CATEGORIES[post.category]?.label}</p>
                  <h3 className="font-semibold text-foreground leading-snug mt-0.5">{post.title}</h3>
                  {post.excerpt && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{post.excerpt}</p>}
                </div>

                {d.title !== undefined ?
              <DraftEditor
                title={d.title}
                body={d.body}
                onChange={({ title, body }) => setDraft(post.id, { title, body })}
                onPublish={() => publish(post)}
                onOpenGraphic={() => setGraphicFor({ title: d.title, body: d.body })}
                publishing={d.publishing}
                published={d.published} /> :


              <Button type="button" variant="outline" onClick={() => generate(post)} disabled={d.generating}>
                    {d.generating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                    {d.generating ? 'Genero…' : 'Genera commento con l\'IA'}
                  </Button>
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
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Di cosa vuoi parlare?</label>
        <Textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={4} placeholder="Scrivi anche solo due righe, il fatto o l'argomento — es. «il piano paesaggistico delle Madonie, è successo questo...»" />
        <Button type="button" onClick={generate} disabled={generating || !topic.trim()}>
          {generating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
          {generating ? 'Genero…' : 'Genera post con l\'IA'}
        </Button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>

      {draft &&
      <div className="bg-card border border-border rounded-2xl p-4">
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
        <button type="button" onClick={() => setTab('rassegna')} className={`px-4 py-2 rounded-full ${tab === 'rassegna' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}>Rassegna</button>
        <button type="button" onClick={() => setTab('scrivitu')} className={`px-4 py-2 rounded-full ${tab === 'scrivitu' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}>Scrivi tu</button>
      </div>
      {tab === 'rassegna' ? <RassegnaTab storyConfig={storyConfig} siteLogo={siteLogo} /> : <ScriviTuTab storyConfig={storyConfig} siteLogo={siteLogo} />}
    </div>);
}
