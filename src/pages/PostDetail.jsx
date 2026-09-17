import { useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { sb44 } from '@/api/supabaseEntities';
import { getCurrentUser } from '@/lib/supabaseAuth';
import { CATEGORIES, getCategoryLabel } from '@/lib/categories';
import { useSiteContent } from '@/lib/useSiteContent';
import { getContent } from '@/lib/siteContent';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { ArrowLeft, ExternalLink, Calendar, User, Download, Share2, Pencil, Instagram, Loader2, Trash2 } from 'lucide-react';
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
import { buildStoryBlob, STORY_DEFAULTS } from '@/lib/storyImage';
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
  const [sharingStory, setSharingStory] = useState(false);
  const [shareChoiceOpen, setShareChoiceOpen] = useState(false);
  const [cleanShare, setCleanShare] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [fromSupabase, setFromSupabase] = useState(false);

  // Effetto di profondita' sulla copertina dell'articolo: l'immagine si
  // sposta leggermente più lentamente della pagina mentre si scorre.
  const coverRef = useRef(null);
  const { scrollYProgress: coverScroll } = useScroll({ target: coverRef, offset: ['start end', 'end start'] });
  const coverY = useTransform(coverScroll, [0, 1], [-24, 24]);
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

  const generateBrandedImage = async (imageUrl, imgFormat) => {
    const storyCfg = { ...STORY_DEFAULTS };
    try {
      const cfgs = await sb44.entities.StoryShareConfig.filter({ key: 'main' }, '-updated_date', 1);
      if (cfgs?.[0]) Object.assign(storyCfg, cfgs[0]);
    } catch {}
    const blob = await buildStoryBlob({
      imageUrl,
      format: imgFormat,
      category: getCategoryLabel(content, post.category),
      title: post.title,
      bodyText: (post.excerpt || post.content || '').replace(/\s+/g, ' ').trim(),
      domain: isGD ? storyCfg.domain_text_gd : `${storyCfg.domain_text_rassegna_prefix} ${post.source_name || 'GD Madonie News'}`,
      primaryColor: '#0F1B3A',
      logoUrl: storyCfg.logo_url || getContent(content, 'site_logo_url'),
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
      minimal: isAdmin && cleanShare,
      topBandEnabled: storyCfg.top_band_enabled,
      topBandColor: storyCfg.top_band_color,
      topBandOpacity: storyCfg.top_band_opacity,
      logoSize: storyCfg.logo_size,
      categoryGap: storyCfg.category_gap
    });
    const file = new File([blob], 'condivisione.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: post.title });
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'condivisione-gdmadonie.png';
      a.click();
      URL.revokeObjectURL(url);
      alert('Immagine scaricata e link copiato: aprila in WhatsApp, Instagram o Facebook, e incolla il link nello sticker "Link" se stai facendo una storia.');
    }
  };

  const shareRawVideo = async (videoUrl) => {
    const res = await fetch(videoUrl);
    const videoBlob = await res.blob();
    const ext = videoUrl.split('.').pop()?.split('?')[0] || 'mp4';
    const videoFile = new File([videoBlob], `video.${ext}`, { type: videoBlob.type || 'video/mp4' });
    if (navigator.canShare && navigator.canShare({ files: [videoFile] })) {
      await navigator.share({ files: [videoFile], title: post.title });
      return;
    }
    const url = URL.createObjectURL(videoBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `video-gdmadonie.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    alert('Video scaricato e link copiato: aprilo in WhatsApp, Instagram o Facebook, e incolla il link nello sticker "Link" se stai facendo una storia.');
  };

  const isVideo = post ? (post.media?.[0]?.type || post.media_type) === 'video' : false;
  const videoUrl = post ? post.media?.[0]?.url || (post.media_type === 'video' ? post.image_url : null) : null;

  const shareStory = () => {
    if (!post || sharingStory) return;
    setShareChoiceOpen(true);
  };

  const pickShareChoice = async (choice) => {
    setShareChoiceOpen(false);
    setSharingStory(true);
    try {await navigator.clipboard?.writeText(shareUrl);} catch {}
    try {
      if (choice === 'video') {
        try {
          await shareRawVideo(videoUrl);
          setSharingStory(false);
          return;
        } catch {
          await generateBrandedImage(post.poster_url, 'story');
          setSharingStory(false);
          return;
        }
      }
      const imgSource = isVideo ? post.poster_url : post.image_url;
      await generateBrandedImage(imgSource, choice);
    } catch (e) {
      alert('Non sono riuscito a preparare la condivisione. Riprova.');
    }
    setSharingStory(false);
  };

  return (
    <div className="space-y-5">
      {(() => {
        const items = post.media && post.media.length ? post.media : post.image_url ? [{ url: post.image_url, type: post.media_type, orientation: post.media_orientation, poster_url: post.poster_url }] : [];
        if (!items.length) {
          return (
            <div>
              <button onClick={goBack} aria-label="Indietro" className="inline-flex items-center justify-center w-10 h-10 min-w-[44px] min-h-[44px] rounded-full bg-card border border-border shadow-sm text-foreground hover:bg-muted">
                <ArrowLeft className="w-5 h-5" />
              </button>
            </div>);

        }
        return (
          <div ref={coverRef} className="-mt-5 -mx-4 lg:mt-0 lg:mx-0 lg:rounded-2xl overflow-hidden relative">
            <motion.div style={{ y: coverY, scale: 1.08 }} className="will-change-transform">
              <MediaCarousel items={items} alt={post.title} badge={{ label: getCategoryLabel(content, post.category), className: cat.badge }} />
            </motion.div>
            <button onClick={goBack} aria-label="Indietro" className="absolute top-3 left-3 z-[35] w-10 h-10 min-w-[44px] min-h-[44px] rounded-full bg-white/90 backdrop-blur-sm text-foreground shadow-md ring-1 ring-black/5 flex items-center justify-center hover:bg-white">
              <ArrowLeft className="w-5 h-5" />
            </button>
          </div>);

      })()}
      <div className="space-y-2">
        {post.source_name && <SourceBadge post={post} />}
        <h1 className="text-2xl font-bold text-foreground leading-tight">{post.title}</h1>
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
      {post.content && <div className="text-[15px] text-foreground leading-relaxed whitespace-pre-line">{post.content}</div>}
      {ADS_ENABLED && <AdSlot slot="1020089079" />}
      {post.attachment_url &&
      <a href={post.attachment_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm font-medium text-primary bg-primary/5 px-4 py-3 rounded-xl hover:bg-primary/10">
          <Download className="w-4 h-4" /> {post.attachment_name || 'Scarica allegato'}
        </a>
      }
      {post.external_link &&
      <a href={post.external_link} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full text-primary-foreground py-3 rounded-xl hover:bg-primary/90 font-serif font-normal bg-[#0f1b3a]">
          Leggi l'articolo completo su {post.source_name} <ExternalLink className="w-4 h-4" />
        </a>
      }
      <div className="flex items-center gap-2 pt-2 border-t border-border flex-wrap">
        <span className="text-xs text-muted-foreground mr-1 flex items-center gap-1"><Share2 className="w-3.5 h-3.5" /> Condividi:</span>
        <a href={shareWa} target="_blank" rel="noopener noreferrer" className="text-xs font-medium bg-[#25D366] text-white px-3 py-2.5 min-h-[44px] rounded-lg flex items-center">WhatsApp</a>
        <button onClick={shareStory} disabled={sharingStory} className="text-xs font-medium text-white px-3 py-2.5 min-h-[44px] rounded-lg flex items-center" style={{ backgroundColor: '#1877F2' }}>Facebook</button>
        <button onClick={shareStory} disabled={sharingStory} className="text-xs font-medium text-white px-3 py-2.5 min-h-[44px] rounded-lg flex items-center gap-1.5 disabled:opacity-60 bg-gradient-to-tr from-[#f58529] via-[#dd2a7b] to-[#8134af]">
          {sharingStory ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Instagram className="w-3.5 h-3.5" />} Condividi
        </button>
        <button onClick={shareNative} className="text-xs font-medium bg-slate-800 text-white px-3 py-2.5 min-h-[44px] rounded-lg flex items-center">Copia link</button>
      </div>
      <Comments postId={post.id} />
      <RelatedPosts post={post} />

      <Dialog open={shareChoiceOpen} onOpenChange={setShareChoiceOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Come vuoi condividere?</DialogTitle>
            <DialogDescription>Scegli il formato più adatto a dove la pubblichi.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            {isAdmin &&
            <label className="flex items-start gap-3 p-3 rounded-xl border border-border bg-muted/40 cursor-pointer">
                <input type="checkbox" checked={cleanShare} onChange={(e) => setCleanShare(e.target.checked)} className="mt-0.5 w-4 h-4 shrink-0 accent-[#0f1b3a]" />
                <span>
                  <span className="block text-sm font-semibold text-foreground">Foto pulita (solo admin)</span>
                  <span className="block text-xs text-muted-foreground mt-0.5">Niente logo, categoria o titolo sopra la foto: resta solo l'indirizzo del sito in basso. Usalo quando l'immagine ha già la sua grafica.</span>
                </span>
              </label>
            }
            {isVideo &&
            <button onClick={() => pickShareChoice('video')} className="w-full flex items-start gap-3 text-left p-4 rounded-xl border border-border hover:bg-muted transition-colors">
                <Film className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <span>
                  <span className="block font-semibold text-foreground">Video vero</span>
                  <span className="block text-xs text-muted-foreground mt-0.5">Si muove e ha l'audio, ma senza logo o testo sopra</span>
                </span>
              </button>
            }
            <button onClick={() => pickShareChoice('story')} className="w-full flex items-start gap-3 text-left p-4 rounded-xl border border-border hover:bg-muted transition-colors">
              <img src={getContent(content, 'site_logo_url')} alt="" className="w-9 h-9 rounded-lg object-contain bg-muted border border-border shrink-0" />
              <span>
                <span className="block font-semibold text-foreground">Immagine per le Storie</span>
                <span className="block text-xs text-muted-foreground mt-0.5">Verticale e stretta, formato Storie WhatsApp/Instagram/Facebook</span>
              </span>
            </button>
            <button onClick={() => pickShareChoice('post')} className="w-full flex items-start gap-3 text-left p-4 rounded-xl border border-border hover:bg-muted transition-colors">
              <img src={getContent(content, 'site_logo_url')} alt="" className="w-9 h-9 rounded-lg object-contain bg-muted border border-border shrink-0" />
              <span>
                <span className="block font-semibold text-foreground">Immagine per il Feed</span>
                <span className="block text-xs text-muted-foreground mt-0.5">Più quadrata, pensata per un post normale (non taglia logo/testo)</span>
              </span>
            </button>
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
