import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { sized, fallbackTo } from '@/lib/imgSize';
import { sb44 } from '@/api/supabaseEntities';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { MapPin, Calendar, Clock, Share2, Bookmark, BookmarkCheck, Facebook, Instagram, Mail, Copy, Link2 } from 'lucide-react';
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
          const mine = await sb44.entities.SavedEvent.filter({ event_id: id }, '-created_at', 1);
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
        const mine = await sb44.entities.SavedEvent.filter({ event_id: event.id }, '-created_at', 50);
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

  if (loading) return <div className="flex justify-center py-20"><div className="w-10 h-10 rounded-full animate-spin" style={{ border: '4px solid #DDE5FB', borderTopColor: '#2F5BD8' }}></div></div>;
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
    <div className="wrap" style={{ maxWidth: 820, paddingTop: 30, paddingBottom: 72 }}>
      {event.image_url && (
        <div className="event-hero"><img src={sized(event.image_url, 1100)} onError={fallbackTo(event.image_url)} alt={event.title} decoding="async" /></div>
      )}
      <span className="section-kicker" style={{ marginTop: 26, display: 'block' }}>Evento GD</span>
      <h1 className="event-title">{event.title}</h1>
      <div className="event-info">
        <div className="event-info-row"><Calendar className="w-5 h-5" /><span>{date}</span></div>
        <div className="event-info-row"><Clock className="w-5 h-5" /><span>Ore {time}</span></div>
        {event.location && <div className="event-info-row"><MapPin className="w-5 h-5" /><span>{event.location}</span></div>}
        <button onClick={toggleSave} disabled={toggling} aria-label={saved ? 'Rimuovi dai salvati' : 'Salva questo evento'} className="btn-pill btn-blu" style={{ marginTop: 6, justifySelf: 'start' }}>
          {saved ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
          {saved ? 'Evento salvato' : 'Salva questo evento'}
        </button>
      </div>
      {event.description && <p className="event-desc">{event.description}</p>}
      <div className="share-row">
        <span className="share-label"><Share2 className="w-4 h-4" /> Condividi</span>
        <a href={shareWa} target="_blank" rel="noopener noreferrer" className="share-btn">WhatsApp</a>
        {canNativeShare && <button onClick={nativeShare} className="share-btn share-primary"><Link2 className="w-4 h-4" /> Condividi</button>}
        <a href={shareEmail} className="share-btn">Email</a>
        <button onClick={copyLink} className="share-btn"><Copy className="w-4 h-4" /> Copia link</button>
      </div>
    </div>
  );
}
