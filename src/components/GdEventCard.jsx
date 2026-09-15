import { useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { MapPin, Clock, ChevronDown } from 'lucide-react';

export default function GdEventCard({ event }) {
  const [open, setOpen] = useState(false);
  const hasImg = !!event.image_url;

  return (
    <div className="bg-card border border-border p-4 shadow-sm hover:shadow-md transition-shadow rounded-3xl">
      <Link to={`/evento/${event.id}`} className="flex items-start gap-3">
        <div className="flex-shrink-0 w-14 h-14 bg-primary/10 text-primary flex flex-col items-center justify-center font-semibold rounded-full">
          <span className="text-lg leading-none">{event.date ? format(new Date(event.date), 'dd') : '--'}</span>
          <span className="text-xs uppercase mt-0.5">{event.date ? format(new Date(event.date), 'MMM', { locale: it }) : ''}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold text-foreground leading-snug">{event.title}</h2>
          {event.location && <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><MapPin className="w-3 h-3" />{event.location}</p>}
          {event.date && <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"><Clock className="w-3 h-3" />{format(new Date(event.date), "d MMMM yyyy 'alle' HH:mm", { locale: it })}</p>}
        </div>
      </Link>

      {hasImg && (
        <>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? 'Nascondi locandina' : 'Mostra locandina'}
            aria-expanded={open}
            className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs font-medium text-primary bg-primary/5 hover:bg-primary/10 rounded-full py-2.5 transition-colors"
          >
            {open ? 'Nascondi locandina' : 'Vedi locandina'}
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
          </button>
          {open && (
            <div className="mt-3 rounded-2xl overflow-hidden bg-muted">
              <img src={event.image_url} alt={`Locandina — ${event.title}`} loading="lazy" decoding="async" className="w-full h-auto max-h-[80vh] object-contain" />
            </div>
          )}
        </>
      )}
    </div>
  );
}
