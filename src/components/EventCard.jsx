import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Calendar, MapPin } from 'lucide-react';

export default function EventCard({ event }) {
  const date = event.date ? format(new Date(event.date), 'dd MMM yyyy', { locale: it }) : '';
  const time = event.date ? format(new Date(event.date), 'HH:mm', { locale: it }) : '';
  return (
    <Link to={`/evento/${event.id}`} className="block bg-card rounded-2xl border border-border overflow-hidden hover:shadow-sm transition-shadow">
      <div className="p-3 pb-2">
        <span className="inline-block text-[10px] font-semibold uppercase tracking-wide text-primary bg-primary/10 rounded-full px-2 py-0.5 mb-1.5">Evento GD</span>
        <h2 className="text-lg font-semibold text-foreground leading-snug line-clamp-2">{event.title}</h2>
      </div>
      {event.image_url && (
        <div className="px-3">
          <img src={event.image_url} alt={event.title} loading="lazy" decoding="async" className="w-full aspect-[16/9] object-cover rounded-xl bg-muted" />
        </div>
      )}
      <div className="p-3 pt-2 space-y-1">
        <div className="flex items-center gap-2 text-xs text-primary font-medium"><Calendar className="w-3.5 h-3.5" /> {date} · ore {time}</div>
        {event.location && <div className="flex items-center gap-2 text-xs text-muted-foreground"><MapPin className="w-3.5 h-3.5" /> {event.location}</div>}
        {event.description && <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-line">{event.description}</p>}
      </div>
    </Link>
  );
}
