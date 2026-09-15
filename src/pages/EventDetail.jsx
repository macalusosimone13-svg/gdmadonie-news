import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { sb44 } from '@/api/supabaseEntities';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { ArrowLeft, MapPin, Calendar, Clock, Share2, Bookmark, BookmarkCheck, Facebook, Instagram, Mail, Copy, Link2 } from 'lucide-react';
import { markRead } from '@/lib/readArticles';
import { useToast } from '@/components/ui/use-toast';
import { useSEO } from '@/lib/useSEO';

export default function EventDetail() {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [toggling, setToggling] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      try {
        const e = await sb44.entities.Event.get(id);
        setEvent(e);
        if (e) markRead(e.id);
        try {
          const mine = await sb44.entities.SavedEvent.filter({ event_id: id }, '-created_date', 1);
          setSaved(Array.isArray(mine) && mine.length > 0);
        } catch { /* utente non loggato: salva disattivato */ }
      } catch {}
      setLoading(false);
    })();
  }, [id]);

  const toggleSave = async () => {
    if (!event || toggling) return;
    setToggling(true);
    try {
      if (saved) {
        const mine = await sb44.entities.SavedEvent.filter({ event_id: event.id }, '-created_date', 50);
        if (mine?.length) await sb44.entities.SavedEvent.delete(mine[0].id);
        setSaved(false);
        toast({ description: 'Evento rimosso dai salvati' });
      } else {
        await sb44.entities.SavedEvent.create({
          event_id: event.id,
          event_title: event.title,
          event_date: event.date
        });
        setSaved(true);
        toast({ description: 'Evento salvato! Ti invieremo un promemoria il giorno prima.' });
      }
    } catch {
      toast({ description: 'Devi accedere per salvare un evento', variant: 'destructive' });
    }
    setToggling(false);
  };

  const date = event?.date ? format(new Date(event.date), 'EEEE dd MMMM yyyy', { locale: it }) : '';
  const time = event?.date ? format(new Date(event.date), 'HH:mm', { locale: it }) : '';
  const shareUrl = event ? `${window.location.origin}/functions/shareEvent?id=${event.id}` : window.location.href;
  useSEO({
    title: event ? `${event.title} — GD Madonie News` : 'GD Madonie News',
    description: (event?.description || `${date} ore ${time}${event?.location ? ' · ' + event.location : ''}`).replace(/\s+/g, ' ').slice(0, 160),
    image: event?.image_url,
    url: shareUrl,
    type: 'article'
  });

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin"></div></div>;
  if (!event) return <div className="text-center py-20 text-muted-foreground">Evento non trovato. <Link to="/gd-madonie" className="text-primary underline">Torna indietro</Link></div>;

  const shareText = `${event.title} — ${event.location ? event.location + ' · ' : ''}${date} ore ${time}`;
  const shareWa = `https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`;
  const shareFb = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
  const shareEmail = `mailto:?subject=${encodeURIComponent(event.title)}&body=${encodeURIComponent(shareText + '\n' + shareUrl)}`;
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const nativeShare = async () => {
    try { await navigator.share({ title: event.title, text: shareText, url: shareUrl }); } catch {}
  };
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({ description: 'Link copizzato negli appunti' });
    } catch {
      toast({ description: 'Impossibile copiare il link', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-5">
      <Link to="/gd-madonie" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="w-4 h-4" /> Indietro
      </Link>
      {event.image_url && (
        <div className="flex justify-center">
          <img
            src={event.image_url}
            alt={event.title}
            className="max-w-[650px] w-full h-auto rounded-2xl object-contain"
          />
        </div>
      )}
      <div className="bg-primary/5 rounded-2xl p-4 border border-primary/20">
        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2 text-primary text-sm font-medium"><Calendar className="w-4 h-4" /> {date}</div>
            <div className="flex items-center gap-2 text-muted-foreground text-sm"><Clock className="w-4 h-4" /> Ore {time}</div>
            {event.location && <div className="flex items-center gap-2 text-muted-foreground text-sm"><MapPin className="w-4 h-4" /> {event.location}</div>}
          </div>
          <button
            onClick={toggleSave}
            disabled={toggling}
            aria-label={saved ? 'Rimuovi dai salvati' : 'Salva questo evento'}
            className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl font-semibold text-sm min-h-[44px] sm:self-start whitespace-nowrap hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {saved ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
            {saved ? 'Evento salvato' : 'Salva questo evento'}
          </button>
        </div>
      </div>
      <h1 className="text-2xl font-bold text-foreground leading-tight">{event.title}</h1>
      {event.description && <p className="text-[15px] text-foreground leading-relaxed whitespace-pre-line">{event.description}</p>}
      <div className="space-y-2.5">
        <div className="flex flex-wrap gap-2">
          <a href={shareWa} target="_blank" rel="noopener noreferrer" aria-label="Condividi su WhatsApp" className="inline-flex items-center justify-center gap-2 bg-[#25D366] text-white px-4 py-2.5 min-h-[44px] rounded-xl font-medium text-sm hover:opacity-90">
            <Share2 className="w-4 h-4" /> WhatsApp
          </a>
          <a href={shareFb} target="_blank" rel="noopener noreferrer" aria-label="Condividi su Facebook" className="inline-flex items-center justify-center gap-2 bg-[#1877F2] text-white px-4 py-2.5 min-h-[44px] rounded-xl font-medium text-sm hover:opacity-90">
            <Facebook className="w-4 h-4" /> Facebook
          </a>
          <button onClick={nativeShare} aria-label="Condividi su Instagram" className="inline-flex items-center justify-center gap-2 bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF] text-white px-4 py-2.5 min-h-[44px] rounded-xl font-medium text-sm hover:opacity-90">
            <Instagram className="w-4 h-4" /> Instagram
          </button>
          <a href={shareEmail} aria-label="Condividi via Email" className="inline-flex items-center justify-center gap-2 bg-slate-600 text-white px-4 py-2.5 min-h-[44px] rounded-xl font-medium text-sm hover:opacity-90">
            <Mail className="w-4 h-4" /> Email
          </a>
          <button onClick={copyLink} aria-label="Copia link" className="inline-flex items-center justify-center gap-2 bg-card border border-border text-foreground px-4 py-2.5 min-h-[44px] rounded-xl font-medium text-sm hover:bg-muted">
            <Copy className="w-4 h-4" /> Copia link
          </button>
        </div>
        {canNativeShare && (
          <button onClick={nativeShare} className="inline-flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground py-3 min-h-[44px] rounded-xl font-medium text-sm hover:bg-primary/90">
            <Link2 className="w-4 h-4" /> Condividi...
          </button>
        )}
      </div>
    </div>
  );
}
