import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { sb44 } from '@/api/supabaseEntities';
import { getCurrentUser } from '@/lib/supabaseAuth';
import { CATEGORIES, getCategoryLabel } from '@/lib/categories';
import { useSiteContent } from '@/lib/useSiteContent';
import { getContent } from '@/lib/siteContent';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { setBackTarget, sectionForPost } from '@/lib/backTarget';
import { ExternalLink, Calendar, User, Download, Share2, Pencil, Instagram, Loader2, Trash2 } from 'lucide-react';
import { markRead } from '@/lib/readArticles';
import { cleanExcerpt } from '@/lib/cleanText';
import SourceBadge from '@/components/SourceBadge';
import { useSEO } from '@/lib/useSEO';
import AdSlot from '@/components/AdSlot';
import { ADS_ENABLED } from '@/lib/adsConfig';
import MediaCarousel from '@/components/MediaCarousel';
import { Skeleton } from '@/components/ui/skeleton';
import RelatedPosts from '@/components/RelatedPosts';
import Comments from '@/components/Comments';
import { buildStoryBlob, STORY_DEFAULTS, viaProxy } from '@/lib/storyImage';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Film, Image as ImageIcon } from 'lucide-react';

export default function PostDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [savingNote, setSavingNote] = useState(false);
    const [shareChoiceOpen, setShareChoiceOpen] = useState(false);
  const [cleanShare, setCleanShare] = useState(false);
  const [prepared, setPrepared] = useState({});
  const [prepFailed, setPrepFailed] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [shareMsg, setShareMsg] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [fromSupabase, setFromSupabase] = useState(false);
  const { data: content } = useSiteContent();

  useEffect(() => {
    getCurrentUser().then((u) => setIsAdmin(u?.role === 'admin' || u?.role === 'editor')).catch(() => {});
  }, []);

  useEffect(() => {
    (async () => {
      try {
        let p = await sb44.entities.Post.get(id).catch(() => null);
        let onSupabase = !!p;
        if (!p) {
          p = await base44.entities.Post.get(id);
          onSupabase = false;
        }
        if (p && p.status === 'draft') {
          let admin = false;
          try {const u = await getCurrentUser();admin = u?.role === 'admin' || u?.role === 'editor';} catch {}
          if (!admin) {setPost(null);setLoading(false);return;}
        }
        setFromSupabase(onSupabase);
        setPost(p);
        setNoteDraft(p?.editorial_note || '');
        if (p) markRead(p.id);
      } catch {}
      setLoading(false);
    })();
  }, [id]);

  const saveNote = async () => {
    if (!post) return;
    setSavingNote(true);
    try {
      if (fromSupabase) await sb44.entities.Post.update(post.id, { editorial_note: noteDraft });
      else await base44.entities.Post.update(post.id, { editorial_note: noteDraft });
      setPost({ ...post, editorial_note: noteDraft });
      setEditingNote(false);
    } catch {}
    setSavingNote(false);
  };

  const deletePost = async () => {
    if (!post) return;
    setDeleting(true);
    try {
      if (fromSupabase) await sb44.entities.Post.delete(post.id);
      else await base44.entities.Post.delete(post.id);
      navigate('/rassegna-stampa');
    } catch {
      alert('Eliminazione non riuscita. Riprova.');
      setDeleting(false);
    }
  };

  const permalink = post ? `${window.location.origin}/articolo/${post.id}` : window.location.href;
  const shareLink = post ? `${window.location.origin}/functions/sharePost?id=${post.id}` : permalink;
  const seoImage = post?.media && post.media.length ? post.media[0].url : post?.image_url;
  useSEO({
    title: post ? `${post.title} — GD Madonie News` : 'GD Madonie News',
    description: (post?.excerpt || 'Notizia dei Giovani Democratici Madonie').replace(/\s+/g, ' ').slice(0, 160),
    image: seoImage,
    url: permalink,
    type: 'article',
    noindex: post ? post.source_type !== 'gd_madonie' : false
  });

  useEffect(() => {
    const SCRIPT_ID = 'ld-json-newsarticle';
    if (!post || post.source_type !== 'gd_madonie') {
      document.getElementById(SCRIPT_ID)?.remove();
      return;
    }
    const data = {
      '@context': 'https://schema.org',
      '@type': 'NewsArticle',
      headline: post.title,
      ...(post.image_url ? { image: post.image_url } : {}),
      ...(post.published_date ? { datePublished: new Date(post.published_date).toISOString() } : {}),
      author: { '@type': 'Organization', name: 'Giovani Democratici Madonie' },
      publisher: { '@type': 'Organization', name: 'GD Madonie News' },
      ...(post.excerpt ? { description: post.excerpt } : {}),
      mainEntityOfPage: window.location.href
    };
    let el = document.getElementById(SCRIPT_ID);
    if (!el) {
      el = document.createElement('script');
      el.type = 'application/ld+json';
      el.id = SCRIPT_ID;
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(data);
    return () => {document.getElementById(SCRIPT_ID)?.remove();};
  }, [post]);

  useEffect(() => { setBackTarget(sectionForPost(post)); return () => setBackTarget(null); }, [post?.category, post?.source_type]);
  useEffect(() => {
    if (!shareChoiceOpen || !post) return;
    let cancelled = false;
    setPrepared({});
    setPrepFailed(false);
    setVideoFailed(false);
    const run = async (key, fn) => {
      for (let attempt = 0; attempt < 2; attempt++) {
        try { const f = await fn(); if (!cancelled) setPrepared((p) => ({ ...p, [key]: f })); return; }
        catch { await new Promise((r) => setTimeout(r, 400)); }
      }
      if (!cancelled) { if (key === 'video') setVideoFailed(true); else setPrepFailed(true); }
    };
    const imgSource = isVideo ? post.poster_url : post.image_url;
    run('story', () => buildBrandedFile(imgSource, 'story', isAdmin && cleanShare));
    run('post', () => buildBrandedFile(imgSource, 'post', isAdmin && cleanShare));
    if (isVideo && videoUrl) run('video', buildVideoFile);
    return () => { cancelled = true; };
  }, [shareChoiceOpen, cleanShare, post?.id]);

  if (loading) return (
    <div className="space-y-5">
      <Skeleton className="h-4 w-20 rounded-full" />
      <div className="flex gap-2">
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-7 w-full" />
        <Skeleton className="h-7 w-3/4" />
      </div>
      <div className="flex gap-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-24" />
      </div>
      <Skeleton className="aspect-[16/9] w-full rounded-2xl" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>);

  if (!post) return <div className="text-center py-20 text-muted-foreground">Notizia non trovata. <Link to="/" className="text-primary underline">Torna alla home</Link></div>;

  const cat = CATEGORIES[post.category] || CATEGORIES.rassegna_stampa;
  const isGD = post.source_type === 'gd_madonie';
  const date = post.published_date ? format(new Date(post.published_date), "dd MMMM yyyy 'alle ore' HH:mm", { locale: it }) : '';
  const goBack = () => {
    if (window.history.state && window.history.state.idx > 0) navigate(-1);else
    navigate('/');
  };
  const shareUrl = shareLink;
  const shareWa = `https://wa.me/?text=${encodeURIComponent(post.title + ' ' + shareUrl)}`;
  const shareFb = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
  const shareNative = async () => {
    if (navigator.share) {try {await navigator.share({ title: post.title, url: shareUrl });} catch (e) {}} else
    {navigator.clipboard?.writeText(shareUrl);alert('Link copizzato');}
  };

  const isVideo = post ? (post.media?.[0]?.type || post.media_type) === 'video' : false;
  const videoUrl = post ? post.media?.[0]?.url || (post.media_type === 'video' ? post.image_url : null) : null;

  // Palette del redesign: si ignorano colori/logo salvati in passato (avevano l'arancione).
  const buildBrandedFile = async (imageUrl, imgFormat, minimal) => {
    const storyCfg = { ...STORY_DEFAULTS, bg_gradient_start: '#1B3A8C', bg_gradient_end: '#0A1226', category_bg_color: '#2F5BD8', category_text_color: '#FFFFFF', brand_title: 'GD Madonie News', brand_subtitle: 'Giovani Democratici Madonie' };
    const blob = await buildStoryBlob({
      imageUrl,
      format: imgFormat,
      category: getCategoryLabel(content, post.category),
      title: post.title,
      bodyText: (post.excerpt || post.content || '').replace(/\s+/g, ' ').trim(),
      domain: isGD ? storyCfg.domain_text_gd : `${storyCfg.domain_text_rassegna_prefix} ${post.source_name || 'GD Madonie News'}`,
      primaryColor: '#0F1B3A',
      logoUrl: null,
      brandTitle: storyCfg.brand_title,
      brandSubtitle: storyCfg.brand_subtitle,
      bgGradientStart: storyCfg.bg_gradient_start,
      bgGradientEnd: storyCfg.bg_gradient_end,
      categoryBg: storyCfg.category_bg_color,
      categoryText: storyCfg.category_text_color,
      titleColor: storyCfg.title_color,
      overlayIntensity: storyCfg.overlay_intensity,
      showCategory: storyCfg.show_category,
      showDomain: storyCfg.show_domain,
      minimal,
      topBandEnabled: storyCfg.top_band_enabled,
      topBandColor: storyCfg.top_band_color,
      topBandOpacity: storyCfg.top_band_opacity,
      logoSize: storyCfg.logo_size,
      categoryGap: storyCfg.category_gap
    });
    // JPEG: più leggero e più compatibile con le Storie di Instagram del PNG.
    let out = blob;
    try {
      const bmp = await createImageBitmap(blob);
      const c = document.createElement('canvas');
      c.width = bmp.width; c.height = bmp.height;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#0A1226'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(bmp, 0, 0);
      const jpg = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.92));
      if (jpg) out = jpg;
    } catch {}
    const ext = out.type === 'image/jpeg' ? 'jpg' : 'png';
    return new File([out], `gdmadonie-${imgFormat}.${ext}`, { type: out.type || 'image/png' });
  };

  const buildVideoFile = async () => {
    const res = await fetch(viaProxy(videoUrl));
    const videoBlob = await res.blob();
    const ext = videoUrl.split('.').pop()?.split('?')[0] || 'mp4';
    return new File([videoBlob], `gdmadonie-video.${ext}`, { type: videoBlob.type || 'video/mp4' });
  };

  // I file si preparano appena si apre la finestra: il tocco sul bottone
  // deve chiamare navigator.share() SUBITO, altrimenti il browser lo rifiuta
  // (era l'errore al primo tentativo).

  const shareStory = () => {
    if (!post) return;
    setShareChoiceOpen(true);
  };

  const pickShareChoice = (choice) => {
    const file = prepared[choice];
    if (!file) return;
    try { navigator.clipboard?.writeText(shareUrl).catch(() => {}); } catch {}
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      // Solo il file (senza titolo/testo): Instagram lo carica più volentieri.
      navigator.share({ files: [file] }).
      then(() => setShareChoiceOpen(false)).
      catch((e) => { if (e?.name !== 'AbortError') setShareMsg('Non è stato possibile aprire la condivisione. Usa "Scarica" e caricala a mano.'); });
    } else {
      downloadFile(file);
    }
  };

  const downloadFile = (file) => {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url; a.download = file.name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    setShareMsg('File scaricato e link copiato: aprilo in Instagram, Facebook o WhatsApp e incolla il link con lo sticker "Link".');
  };

  return (
    <div className="article-detail space-y-5">
      {(() => {
        const items = post.media && post.media.length ? post.media : post.image_url ? [{ url: post.image_url, type: post.media_type, orientation: post.media_orientation, poster_url: post.poster_url }] : [];
        if (!items.length) {
          return (
            <div />);

        }
        return (
          <div className="rounded-[28px] overflow-hidden relative">
            <MediaCarousel items={items} alt={post.title} badge={{ label: getCategoryLabel(content, post.category), className: cat.badge }} />
          </div>);

      })()}
      <div className="space-y-2">
        {post.source_name && <SourceBadge post={post} />}
        <h1>{post.title}</h1>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {date && <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{date}</span>}
          {post.author && <span className="flex items-center gap-1 font-serif font-normal"><User className="w-3.5 h-3.5" />{post.author}</span>}
        </div>
        {isAdmin &&
        <button onClick={() => setDeleteOpen(true)} className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-700 mt-1">
            <Trash2 className="w-3.5 h-3.5" /> Elimina questa notizia (solo admin)
          </button>
        }
      </div>
      {!isGD && (isAdmin || post.editorial_note) &&
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-primary uppercase tracking-wide">Nota della redazione GD Madonie</span>
          {isAdmin && !editingNote &&
          <button onClick={() => setEditingNote(true)} aria-label="Modifica nota redazionale" className="text-muted-foreground hover:text-primary p-1">
              <Pencil className="w-3.5 h-3.5" />
            </button>
          }
        </div>
        {editingNote ?
        <div className="space-y-2">
            <textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            rows={3}
            placeholder="Aggiungi un commento o un contesto a questa notizia..."
            className="w-full text-sm p-2 rounded-lg border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary/30" />

            <div className="flex gap-2">
              <button onClick={saveNote} disabled={savingNote} className="text-xs font-semibold bg-primary text-primary-foreground px-3 py-1.5 rounded-full disabled:opacity-60">Salva</button>
              <button onClick={() => {setEditingNote(false);setNoteDraft(post.editorial_note || '');}} className="text-xs font-medium text-muted-foreground px-3 py-1.5">Annulla</button>
            </div>
          </div> :

        post.editorial_note ?
        <p className="text-sm text-foreground leading-relaxed">{post.editorial_note}</p> :

        isAdmin ?
        <p className="text-sm text-muted-foreground italic">Nessuna nota ancora — clicca la matita per aggiungerne una.</p> :
        null}
      </div>
      }
      {post.excerpt && !isGD && <p className="text-base text-muted-foreground leading-relaxed font-medium">{cleanExcerpt(post.excerpt)}</p>}
      {post.content && <div className="ad-content"><p>{post.content}</p></div>}
      {ADS_ENABLED && <AdSlot slot="1020089079" />}
      {post.attachment_url &&
      <a href={post.attachment_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm font-medium text-primary bg-primary/5 px-4 py-3 rounded-xl hover:bg-primary/10">
          <Download className="w-4 h-4" /> {post.attachment_name || 'Scarica allegato'}
        </a>
      }
      {post.external_link &&
      <a href={post.external_link} target="_blank" rel="noopener noreferrer" className="ad-external">
          Leggi l'articolo completo su {post.source_name} <ExternalLink className="w-4 h-4" />
        </a>
      }
      <div className="share-row">
        <span className="share-label"><Share2 className="w-4 h-4" /> Condividi</span>
        <a href={shareWa} target="_blank" rel="noopener noreferrer" className="share-btn">WhatsApp</a>
        <button onClick={shareStory} className="share-btn share-primary"><Instagram className="w-4 h-4" /> Storie e Post</button>
        <button onClick={shareNative} className="share-btn">Copia link</button>
      </div>
      <Comments postId={post.id} />
      <RelatedPosts post={post} />

      <Dialog open={shareChoiceOpen} onOpenChange={(o) => { setShareChoiceOpen(o); if (!o) setShareMsg(''); }}>
        <DialogContent className="max-w-sm share-dialog">
          <DialogHeader>
            <DialogTitle>Condividi la notizia</DialogTitle>
            <DialogDescription>Scegli il formato: si apre la condivisione del telefono, poi scegli Instagram, Facebook o WhatsApp.</DialogDescription>
          </DialogHeader>
          <div className="share-options">
            {isAdmin &&
            <label className="share-check">
              <input type="checkbox" checked={cleanShare} onChange={(e) => setCleanShare(e.target.checked)} />
              <span><b>Foto pulita (solo admin)</b><small>Niente titolo o categoria sopra la foto: resta solo l'indirizzo del sito.</small></span>
            </label>}
            {[
            ...(isVideo && !videoFailed ? [['video', 'Video vero', 'Si muove e ha l\'audio, senza testo sopra', Film]] : []),
            ['story', 'Immagine per le Storie', 'Verticale 9:16, per Storie Instagram, Facebook e WhatsApp', ImageIcon],
            ['post', 'Immagine per il Feed', 'Più quadrata 4:5, per un post normale', ImageIcon]].
            map(([key, title, desc, Icon]) =>
            <button key={key} onClick={() => pickShareChoice(key)} disabled={!prepared[key]} className="share-option">
              <span className="share-ico">{prepared[key] ? <Icon className="w-5 h-5" /> : <Loader2 className="w-5 h-5 animate-spin" />}</span>
              <span><b>{title}</b><small>{prepared[key] ? desc : 'Preparo il file…'}</small></span>
            </button>
            )}
            {prepFailed && <p className="share-msg">Non riesco a preparare l'immagine di questa notizia. Riprova tra poco.</p>}
            {shareMsg && <p className="share-msg">{shareMsg}</p>}
            {Object.values(prepared).length > 0 && !shareMsg &&
            <button className="share-dl" onClick={() => { const f = prepared.story || prepared.post; if (f) downloadFile(f); }}>Oppure scarica l'immagine</button>}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare questa notizia?</AlertDialogTitle>
            <AlertDialogDescription>"{post.title}" verrà rimossa definitivamente dal sito. Non può essere annullato.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={deletePost} disabled={deleting} className="bg-red-600 hover:bg-red-700">
              {deleting ? 'Eliminazione...' : 'Elimina'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>);

}
