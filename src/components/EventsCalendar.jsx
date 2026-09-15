import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, addMonths, subMonths, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, List } from 'lucide-react';
import { Button } from '@/components/ui/button';

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

export default function EventsCalendar({ events }) {
  const [cursor, setCursor] = useState(new Date());
  const [selected, setSelected] = useState(new Date());

  const byDay = useMemo(() => {
    const map = {};
    (events || []).forEach((ev) => {
      if (!ev.date) return;
      const key = format(parseISO(ev.date), 'yyyy-MM-dd');
      (map[key] = map[key] || []).push(ev);
    });
    return map;
  }, [events]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    const out = [];
    let d = start;
    while (d <= end) {out.push(d);d = addDays(d, 1);}
    return out;
  }, [cursor]);

  const selectedKey = format(selected, 'yyyy-MM-dd');
  const selectedEvents = byDay[selectedKey] || [];
  const today = new Date();

  return (
    <div className="space-y-3">
      <div className="bg-card border border-border p-3 shadow-sm rounded">
        <div className="flex items-center justify-between mb-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCursor(subMonths(cursor, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-foreground capitalize">{format(cursor, 'MMMM yyyy', { locale: it })}</h3>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCursor(addMonths(cursor, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAYS.map((w) =>
          <div key={w} className="text-center text-xs font-semibold uppercase text-muted-foreground py-1">{w}</div>
          )}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((d) => {
            const key = format(d, 'yyyy-MM-dd');
            const inMonth = isSameMonth(d, cursor);
            const isToday = isSameDay(d, today);
            const isSelected = isSameDay(d, selected);
            const dayEvents = byDay[key] || [];
            const hasEvents = dayEvents.length > 0;
            return (
              <button
                key={key}
                onClick={() => setSelected(d)}
                aria-label={format(d, 'd MMMM yyyy', { locale: it })}
                className={[
                'relative aspect-square rounded-lg flex flex-col items-center justify-center text-sm transition-colors min-h-[44px]',
                inMonth ? 'text-foreground' : 'text-muted-foreground',
                isSelected ? 'bg-primary text-white font-semibold' : isToday ? 'bg-primary/10 text-primary font-semibold' : 'hover:bg-muted'].
                join(' ')}>
                
                <span>{format(d, 'd')}</span>
                {hasEvents &&
                <span className={`absolute bottom-1 flex gap-0.5 ${dayEvents.length > 1 ? 'flex-row' : ''}`}>
                    {dayEvents.slice(0, 3).map((_, i) =>
                  <span key={i} className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-primary'}`} />
                  )}
                  </span>
                }
              </button>);

          })}
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <List className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-foreground capitalize">{format(selected, 'EEEE d MMMM', { locale: it })}</h3>
        </div>
        {selectedEvents.length === 0 ?
        <p className="text-sm text-muted-foreground py-2">Nessun evento in questa data.</p> :

        <div className="space-y-2">
            {selectedEvents.map((ev) =>
          <Link key={ev.id} to={`/evento/${ev.id}`} className="flex items-start gap-3 p-2 rounded-xl hover:bg-muted transition-colors">
                <div className="flex-shrink-0 w-2 h-12 rounded-full bg-primary mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground text-sm leading-snug">{ev.title}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    <span>{format(parseISO(ev.date), 'HH:mm', { locale: it })}</span>
                    {ev.location && <span className="truncate">{ev.location}</span>}
                  </div>
                </div>
              </Link>
          )}
          </div>
        }
      </div>
    </div>);

}
