import { useEffect, useMemo, useRef, useState } from 'react';
import { sb44 } from '@/api/supabaseEntities';
import { supabase } from '@/lib/supabaseClient';
import { uploadFile } from '@/lib/uploadFile';
import { buildStoryBlob } from '@/lib/storyImage';
import { sized, fallbackTo } from '@/lib/imgSize';
import { cleanExcerpt } from '@/lib/cleanText';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { Sparkles, Send, Search, Check, Loader2, ExternalLink, Download, PenLine, X, Eye, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

// Bottoni "pillola" nello stesso stile usato dal resto dell'Admin
// (Nuovo post, Nuovo evento): pieno blu per l'azione principale,
// bordo scuro per quella secondaria.
const PILL_PRIMARY = "inline-flex items-center justify-center gap-2 min-h-[46px] px-5 rounded-full bg-[#2F5BD8] text-white font-extrabold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:bg-[#2A4FC0]";
const PILL_SECONDARY = "inline-flex items-center justify-center gap-2 min-h-[46px] px-5 rounded-full border-[1.5px] border-[#0F1B3A] text-[#0F1B3A] bg-white font-extrabold text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors hover:bg-[#F4F7FE]";
// Pulsante "IA": tinta azzurrina, stesso linguaggio delle aree
// tratteggiate blu già usate sul sito per le azioni assistite dall'IA.
const PILL_AI = "inline-flex items-center justify-center gap-2 text-sm font-bold text-[#2F5BD8] bg-[#F4F7FE] border border-[#2F5BD8]/35 rounded-full px-5 py-3 min-h-[46px] disabled:opacity-60 transition-colors hover:bg-[#EAF0FD]";

// Stessa identica palette "redesign blu" già usata per condividere i
// singoli articoli (PostDetail.jsx): i colori salvati in StoryShareConfig
// risalgono al vecchio design arancione e vengono ignorati di proposito,
// esattamente come lì. Nessun logo caricato da file (poteva essere vecchio
// anche quello): si usa sempre il marchio testuale "GD MADONIE" pulito.
const NEWS_GD_BRAND = {
  bgGradientStart: '#1B3A8C',
  bgGradientEnd: '#0A1226',
  primaryColor: '#0F1B3A',
  categoryBg: '#2F5BD8',
  categoryText: '#FFFFFF',
  titleColor: '#ffffff',
  brandTitle: 'GD Madonie News',
  brandSubtitle: 'Giovani Democratici Madonie',
  domain: 'gdmadonie-news.com'
};

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

// Salva su News GD: se c'è una locandina generata, la carica prima come
// immagine di copertina del post (così l'articolo appare come tutti gli
// altri sul sito: immagine sopra, testo sotto). Con status "draft" il post
// esiste ma resta invisibile a chiunque non sia admin (regola del sito) —
// è così che funziona l'anteprima "sul sito vero" senza pubblicare per
// davvero. Se esiste già un id, si aggiorna quel post invece di crearne un
// altro ogni volta che si guarda l'anteprima.
async function saveNewsGDPost({ id, title, body, imageBlob, status }) {
  let media;
  if (imageBlob) {
    const file = new File([imageBlob], `news-gd-${Date.now()}.png`, { type: 'image/png' });
    const { file_url } = await uploadFile(file);
    media = { url: file_url, type: 'image', orientation: 'vertical' };
  }
  const payload = {
    title,
    content: body,
    excerpt: body.length > 220 ? body.slice(0, 217) + '…' : body,
    category: 'news_gd',
    author: 'GD Madonie',
    source_type: 'gd_madonie',
    status,
    published_date: new Date().toISOString(),
    ...(media ? { image_url: media.url, media_type: 'image', media_orientation: 'vertical', media: [media] } : {})
  };
  const saved = id ? await sb44.entities.Post.update(id, payload) : await sb44.entities.Post.create(payload);
  if (status === 'published') {
    try {
      await supabase.functions.invoke('notify-new-post', { body: { post_id: saved.id, app_url: window.location.origin } });
    } catch {}
  }
  return saved;
}

// --- Finestra di scrittura -------------------------------------------
// Un'unica schermata per: generare il testo con l'IA (o scriverlo a mano),
// vedere subito accanto l'anteprima della locandina così come apparirà
// pubblicata su News GD, e pubblicare. Usata sia dalla Rassegna (con
// l'articolo di partenza) sia da "Scrivi tu" (con un argomento libero).
function ComposerModal({ open, onClose, sourceArticle, initialTopic, autoGenerate, startBlank, onPublished }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [topic, setTopic] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(null);
  // Id del post già salvato (come bozza per l'anteprima, o pubblicato):
  // finché non è pubblicato, "Annulla" lo elimina di nuovo.
  const [postId, setPostId] = useState(null);
  const [previewingSite, setPreviewingSite] = useState(false);
  const [fmt, setFmt] = useState('post');
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewBlob, setPreviewBlob] = useState(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const objUrl = useRef(null);

  useEffect(() => {
    if (!open) return;
    setTitle('');
    setBody('');
    setTopic(initialTopic || '');
    setError(null);
    setPublished(null);
    setPostId(null);
    setFmt('post');
    setEditing(!!startBlank);
    // Se veniamo dalla rassegna, o abbiamo già un argomento, l'IA parte
    // subito da sola: un click in meno.
    if (sourceArticle) generate();
    else if (autoGenerate) generate(initialTopic || '');
  }, [open]);

  const generate = async (topicOverride) => {
    setGenerating(true); setError(null); setEditing(true);
    try {
      const result = sourceArticle ?
      await generateAI({
        mode: 'comment',
        title: sourceArticle.title,
        excerpt: sourceArticle.excerpt,
        content: sourceArticle.content,
        source_name: sourceArticle.source_name,
        category: sourceArticle.category
      }) :
      await generateAI({ mode: 'compose', topic: topicOverride !== undefined ? topicOverride : topic });
      setTitle(result.title || '');
      setBody(result.body || '');
    } catch (e) {
      setError(e.message);
    }
    setGenerating(false);
  };

  // Anteprima della locandina: si rigenera da sola mentre scrivi (con un
  // piccolo ritardo per non rifare l'immagine a ogni singola lettera).
  useEffect(() => {
    if (!open || !title.trim()) { setPreviewUrl(''); setPreviewBlob(null); return; }
    let cancelled = false;
    setPreviewBusy(true);
    const t = setTimeout(() => {
      buildStoryBlob({
        format: fmt,
        category: 'News GD',
        title,
        bodyText: body,
        // Se veniamo da una notizia di rassegna con una sua foto, la si usa
        // come sfondo (come le condivisioni degli altri articoli del sito):
        // così la locandina mostra subito di cosa parla la notizia, non solo
        // il nostro commento.
        imageUrl: sourceArticle?.image_url || undefined,
        logoUrl: null,
        ...NEWS_GD_BRAND
      }).then((b) => {
        if (cancelled) return;
        if (objUrl.current) URL.revokeObjectURL(objUrl.current);
        const u = URL.createObjectURL(b);
        objUrl.current = u;
        setPreviewUrl(u);
        setPreviewBlob(b);
      }).finally(() => !cancelled && setPreviewBusy(false));
    }, 450);
    return () => { cancelled = true; clearTimeout(t); };
  }, [open, fmt, title, body, sourceArticle]);

  const downloadPng = () => {
    if (!previewBlob) return;
    const a = document.createElement('a');
    a.href = previewUrl;
    a.download = `news-gd-${fmt}-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const publish = async () => {
    if (!title.trim() || !body.trim()) return;
    setPublishing(true); setError(null);
    try {
      const saved = await saveNewsGDPost({ id: postId, title, body, imageBlob: previewBlob, status: 'published' });
      setPostId(saved.id);
      setPublished(saved);
      onPublished?.();
    } catch (e) {
      setError(e.message);
    }
    setPublishing(false);
  };

  // Salva come bozza (invisibile a tutti tranne l'admin, per via delle
  // regole del sito) e apre la pagina vera dell'articolo in un'altra
  // scheda: è la stessa identica pagina che vedrebbero i visitatori,
  // solo che finché resta una bozza la vedi soltanto tu.
  const previewOnSite = async () => {
    if (!title.trim() || !body.trim()) return;
    setPreviewingSite(true); setError(null);
    try {
      const saved = await saveNewsGDPost({ id: postId, title, body, imageBlob: previewBlob, status: 'draft' });
      setPostId(saved.id);
      window.open(`/articolo/${saved.id}`, '_blank', 'noopener,noreferrer');
    } catch (e) {
      setError(e.message);
    }
    setPreviewingSite(false);
  };

  // "Annulla e scarta": se avevamo già salvato una bozza (per l'anteprima)
  // la elimina, cosi' non resta nulla in giro; poi chiude la finestra.
  const discardAndClose = async () => {
    if (postId && !published) {
      try { await sb44.entities.Post.delete(postId); } catch {}
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && discardAndClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Scrivi su News GD</DialogTitle></DialogHeader>

        {sourceArticle &&
        <div className="bg-muted rounded-xl p-3 text-sm">
            <p className="text-xs text-muted-foreground font-medium">Notizia di partenza · {sourceArticle.source_name}</p>
            <p className="font-semibold text-foreground leading-snug">{sourceArticle.title}</p>
          </div>
        }

        {!sourceArticle &&
        <div className="space-y-2">
            <label className="text-sm font-medium text-foreground block">Di cosa vuoi parlare?</label>
            <Textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={3} placeholder="Scrivi anche solo due righe, il fatto o l'argomento — es. «il piano paesaggistico delle Madonie, è successo questo...»" />
          </div>
        }

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={generate} disabled={generating || (!sourceArticle && !topic.trim())} className={PILL_AI}>
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {generating ? 'Genero…' : title ? "Rigenera con l'IA" : "Genera con l'IA"}
          </button>
          {!editing &&
          <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground px-2">
              <PenLine className="w-3.5 h-3.5" /> Scrivi tu, senza IA
            </button>
          }
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}

        {editing &&
        <div className="grid md:grid-cols-[1fr,230px] gap-4 pt-1">
            <div className="space-y-3 min-w-0">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titolo" className="font-semibold" />
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={9} placeholder="Testo del post..." />
              <p className="text-[11px] text-muted-foreground">{body.length} caratteri — puoi modificare tutto prima di pubblicare.</p>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Così apparirà su News GD</p>
              <div className="flex bg-muted rounded-full p-1 text-xs font-medium w-fit">
                <button type="button" onClick={() => setFmt('post')} className={`px-3 py-1.5 rounded-full ${fmt === 'post' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}>Post</button>
                <button type="button" onClick={() => setFmt('story')} className={`px-3 py-1.5 rounded-full ${fmt === 'story' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}>Storia</button>
              </div>
              <div className={`w-full ${fmt === 'post' ? 'aspect-[4/5]' : 'aspect-[9/16]'} rounded-2xl border border-border bg-muted overflow-hidden flex items-center justify-center relative`}>
                {previewUrl && <img src={previewUrl} alt="Anteprima" className="w-full h-full object-cover" />}
                {previewBusy && <div className="absolute inset-0 bg-white/60 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>}
                {!previewUrl && !previewBusy && <p className="text-xs text-muted-foreground text-center px-4">Scrivi un titolo per vedere l'anteprima</p>}
              </div>
              <button type="button" onClick={downloadPng} disabled={!previewBlob} className={`${PILL_SECONDARY} w-full !min-h-[40px] text-xs`}>
                <Download className="w-3.5 h-3.5" /> Scarica PNG
              </button>
              <p className="text-[11px] text-muted-foreground leading-snug">Questa è solo la grafica di copertina. Per vedere l'intera pagina come apparirà sul sito, usa "Anteprima sul sito" qui sotto.</p>
            </div>
          </div>
        }

        {editing &&
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
          <button type="button" onClick={publish} disabled={publishing || !title.trim() || !body.trim()} className={PILL_PRIMARY}>
            {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : published ? <Check className="w-4 h-4" /> : <Send className="w-4 h-4" />}
            {published ? 'Pubblicato su News GD' : 'Pubblica su News GD'}
          </button>
          {!published &&
          <button type="button" onClick={previewOnSite} disabled={previewingSite || !title.trim() || !body.trim()} className={PILL_SECONDARY} title="Si apre come sul sito vero, ma la vedi solo tu finché non pubblichi">
              {previewingSite ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
              Anteprima sul sito
            </button>
          }
          {published &&
          <a href={`/articolo/${published.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-[#2F5BD8] font-bold hover:underline px-2">
              Vedi il post <ExternalLink className="w-3.5 h-3.5" />
            </a>
          }
          {!published &&
          <button type="button" onClick={discardAndClose} className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-600 hover:text-red-700 px-2 ml-auto">
              <Trash2 className="w-3.5 h-3.5" /> Annulla e scarta
            </button>
          }
        </div>
        }
      </DialogContent>
    </Dialog>);
}

// --- Tab "Rassegna": le notizie già raccolte dal sito, mostrate come
// vere card giornalistiche (immagine, titolo, estratto) — le stesse usate
// nella pagina pubblica "Rassegna stampa". Un click apre la scrittura. ---
function RassegnaTab() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState('all');
  const [q, setQ] = useState('');
  const [composerFor, setComposerFor] = useState(null);

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

  return (
    <div className="space-y-4">
      <div className="search-box !max-w-none !my-0">
        <Search size={16} style={{ opacity: .5 }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca tra le notizie…" />
        {q && <button onClick={() => setQ('')} aria-label="Cancella ricerca"><X size={16} /></button>}
      </div>
      <div className="source-chips !pt-0">
        {[['all', 'Tutte'], ['politica_nazionale', 'Nazionale'], ['politica_regionale', 'Regionale']].map(([k, l]) =>
        <button key={k} type="button" onClick={() => setCat(k)} className={`schip ${cat === k ? 'active' : ''}`}>{l}</button>
        )}
      </div>

      {loading ?
      <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div> :
      filtered.length === 0 ?
      <p className="text-sm text-muted-foreground text-center py-10">Nessuna notizia trovata.</p> :

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
          {filtered.map((post) => {
          const img = post.image_url;
          return (
            <article key={post.id} className={`article-card${img ? '' : ' noimg'}`}>
                {img &&
              <div className="card-media">
                  <img src={sized(img, 480)} onError={fallbackTo(img)} alt="" loading="lazy" decoding="async" />
                </div>
              }
                <div className="card-body">
                  <div className="meta-line">{post.source_name}{post.published_date ? ' · ' + format(new Date(post.published_date), 'd MMM', { locale: it }) : ''}</div>
                  <h3 style={{ fontSize: img ? undefined : '1.05rem' }}>{post.title}</h3>
                  {post.excerpt && <p>{cleanExcerpt(post.excerpt)}</p>}
                  <button type="button" onClick={() => setComposerFor(post)} className={`${PILL_AI} w-full justify-center mt-3`}>
                    <Sparkles className="w-4 h-4" /> Scrivi su questo
                  </button>
                </div>
              </article>);

        })}
        </div>
      }

      <ComposerModal
        open={!!composerFor}
        onClose={() => setComposerFor(null)}
        sourceArticle={composerFor}
        onPublished={load} />

    </div>);
}

// --- Tab "Scrivi tu": argomento libero -> post completo -------------------
function ScriviTuTab() {
  const [topic, setTopic] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
        <label className="text-sm font-medium text-foreground block">Di cosa vuoi parlare?</label>
        <Textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={4} placeholder="Scrivi anche solo due righe, il fatto o l'argomento — es. «il piano paesaggistico delle Madonie, è successo questo...»" />
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setComposerOpen('generate')} disabled={!topic.trim()} className={PILL_AI}>
            <Sparkles className="w-4 h-4" /> Genera post con l'IA
          </button>
          <button type="button" onClick={() => setComposerOpen('blank')} className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground px-2">
            <PenLine className="w-3.5 h-3.5" /> Scrivi tu, senza IA
          </button>
        </div>
      </div>

      <ComposerModal
        open={!!composerOpen}
        onClose={() => setComposerOpen(false)}
        initialTopic={topic}
        autoGenerate={composerOpen === 'generate'}
        startBlank={composerOpen === 'blank'} />

    </div>);
}

// --- Tab "Pubblicati": tutti i post scritti da qui, con la possibilità di
// eliminarli — le bozze lasciate a metà (dalle anteprime mai pubblicate)
// compaiono qui con l'etichetta "Bozza", così non restano invisibili. ---
function PubblicatiTab() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = () => {
    setLoading(true);
    sb44.entities.Post.filter({ source_type: 'gd_madonie', category: 'news_gd' }, '-published_date', 60)
      .then((data) => setPosts(data || []))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await sb44.entities.Post.delete(pendingDelete.id);
      setPosts((prev) => prev.filter((p) => p.id !== pendingDelete.id));
      setPendingDelete(null);
    } catch {}
    setDeleting(false);
  };

  return (
    <div className="space-y-3">
      {loading ?
      <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div> :
      posts.length === 0 ?
      <p className="text-sm text-muted-foreground text-center py-10">Non hai ancora scritto nulla su News GD.</p> :

      <div className="space-y-2">
          {posts.map((p) =>
          <div key={p.id} className="flex items-center gap-3 bg-card border border-border rounded-xl p-3">
              {p.image_url ?
            <img src={sized(p.image_url, 96)} onError={fallbackTo(p.image_url)} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" /> :

            <div className="w-14 h-14 rounded-lg bg-muted flex-shrink-0" />
            }
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{p.title}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  {p.status === 'draft' && <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">Bozza</span>}
                  {p.published_date ? format(new Date(p.published_date), 'd MMM yyyy, HH:mm', { locale: it }) : ''}
                </p>
              </div>
              <a href={`/articolo/${p.id}`} target="_blank" rel="noopener noreferrer" aria-label="Vedi" title="Vedi" className="text-muted-foreground hover:text-primary p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"><ExternalLink className="w-4 h-4" /></a>
              <button onClick={() => setPendingDelete(p)} aria-label="Elimina" title="Elimina" className="text-red-500 hover:text-red-700 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"><Trash2 className="w-4 h-4" /></button>
            </div>
          )}
        </div>
      }

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare questo post da News GD?</AlertDialogTitle>
            <AlertDialogDescription>{pendingDelete?.status === 'draft' ? 'È una bozza, non ancora visibile ai visitatori.' : 'Non sarà più visibile sul sito.'} Non si può annullare.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Elimina</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>);
}

export default function RedazionePanel() {
  const [tab, setTab] = useState('rassegna');

  return (
    <div className="space-y-4">
      <div className="flex bg-muted rounded-full p-1 text-sm font-medium w-fit">
        <button type="button" onClick={() => setTab('rassegna')} className={`px-4 py-2 rounded-full ${tab === 'rassegna' ? 'bg-[#2F5BD8] text-white' : 'text-muted-foreground'}`}>Rassegna</button>
        <button type="button" onClick={() => setTab('scrivitu')} className={`px-4 py-2 rounded-full ${tab === 'scrivitu' ? 'bg-[#2F5BD8] text-white' : 'text-muted-foreground'}`}>Scrivi tu</button>
        <button type="button" onClick={() => setTab('pubblicati')} className={`px-4 py-2 rounded-full ${tab === 'pubblicati' ? 'bg-[#2F5BD8] text-white' : 'text-muted-foreground'}`}>Pubblicati</button>
      </div>
      {tab === 'rassegna' ? <RassegnaTab /> : tab === 'scrivitu' ? <ScriviTuTab /> : <PubblicatiTab />}
    </div>);
}
