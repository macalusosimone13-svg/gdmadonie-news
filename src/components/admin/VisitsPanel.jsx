import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, Users, Eye, RotateCcw, CalendarDays } from 'lucide-react';

// Visite al sito dal nostro contatore (tabella site_visits, funzione
// site_visit_stats, solo admin). Anonimo, senza cookie, esclusi robot e
// visite di admin/editor.

const PERIODS = [[7, '7 giorni'], [30, '30 giorni'], [90, '90 giorni']];

let regionNames = null;
try { regionNames = new Intl.DisplayNames(['it'], { type: 'region' }); } catch { /* browser vecchio */ }
const countryName = (c) => {
  if (!c || c === '?') return 'Sconosciuto';
  try { return regionNames?.of(c) || c; } catch { return c; }
};

const pageName = (p) => {
  if (p.title) return p.title;
  const map = { '/': 'Feed (home)', '/rassegna-stampa': 'News (rassegna)', '/gd-madonie': 'GD Madonie', '/sondaggi': 'Sondaggi', '/chi-siamo': 'Chi siamo', '/partecipa': 'Partecipa' };
  return map[p.path] || p.path;
};

function Stat({ icon: Icon, label, value, hint }) {
  return (
    <div className="bg-card border border-border rounded-xl p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Icon className="w-3.5 h-3.5" /> {label}</div>
      <div className="text-2xl font-extrabold text-foreground mt-1">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>);
}

function Bars({ rows, labelKey, valueKey, format = (x) => x }) {
  if (!rows?.length) return <p className="text-sm text-muted-foreground py-3">Nessun dato ancora.</p>;
  const max = Math.max(...rows.map((r) => r[valueKey] || 0), 1);
  return (
    <div className="space-y-1.5">
      {rows.map((r, i) =>
      <div key={i} className="text-sm">
          <div className="flex justify-between gap-3">
            <span className="truncate text-foreground">{format(r[labelKey], r)}</span>
            <span className="font-bold text-foreground flex-shrink-0">{r[valueKey]}</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
            <div className="h-full bg-[#2F5BD8] rounded-full" style={{ width: `${Math.max(3, (r[valueKey] / max) * 100)}%` }} />
          </div>
        </div>
      )}
    </div>);
}

function Box({ title, children }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3">{title}</h4>
      {children}
    </div>);
}

export default function VisitsPanel() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true); setError(false);
    supabase.rpc('site_visit_stats', { p_days: days }).then(({ data: d, error: e }) => {
      if (e) setError(true); else setData(d);
      setLoading(false);
    }, () => { setError(true); setLoading(false); });
  }, [days]);

  const byDay = data?.by_day || [];
  const maxDay = Math.max(...byDay.map((d) => d.visitors), 1);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground max-w-xl">
          Persone reali che visitano il sito: esclusi robot e le visite di admin ed editor. Anonimo, senza cookie.
        </p>
        <div className="flex bg-muted rounded-full p-1 text-sm font-medium w-fit">
          {PERIODS.map(([d, l]) =>
          <button key={d} type="button" onClick={() => setDays(d)} className={`px-3 py-1.5 rounded-full ${days === d ? 'bg-[#2F5BD8] text-white' : 'text-muted-foreground'}`}>{l}</button>
          )}
        </div>
      </div>

      {loading ?
      <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div> :
      error || !data ?
      <p className="text-sm text-muted-foreground text-center py-8">Non riesco a caricare le visite. Riprova tra poco.</p> :
      <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat icon={Users} label="Visitatori unici" value={data.visitors} hint={`nel periodo (${days} giorni)`} />
            <Stat icon={RotateCcw} label="Sono tornati" value={data.returning} hint="in almeno 2 giorni diversi" />
            <Stat icon={CalendarDays} label="Oggi" value={data.today} hint={`media ${data.daily_avg ?? 0} al giorno`} />
            <Stat icon={Eye} label="Pagine viste" value={data.pageviews} />
          </div>

          <Box title="Visitatori al giorno">
            <div className="flex items-end gap-[2px] h-28">
              {byDay.map((d) =>
            <div key={d.day} className="flex-1 flex flex-col justify-end h-full" title={`${new Date(d.day).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}: ${d.visitors} visitatori, ${d.pageviews} pagine`}>
                  <div className="bg-[#2F5BD8] rounded-t-sm" style={{ height: `${d.visitors ? Math.max(4, (d.visitors / maxDay) * 100) : 0}%` }} />
                </div>
            )}
            </div>
            <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
              <span>{byDay[0] && new Date(byDay[0].day).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}</span>
              <span>oggi</span>
            </div>
          </Box>

          <div className="grid md:grid-cols-2 gap-3">
            <Box title="Da dove arrivano">
              <Bars rows={data.sources} labelKey="source" valueKey="visits" />
              <p className="text-[11px] text-muted-foreground mt-3">
                "Diretto / app" = indirizzo digitato o link aperto da app che non dicono da dove (spesso WhatsApp e storie Instagram).
                Per riconoscerle usa i link con <b>?da=ig</b>, <b>?da=wa</b>, <b>?da=fb</b>, <b>?da=qr</b>.
              </p>
            </Box>
            <Box title="Pagine più viste">
              <Bars rows={data.pages} labelKey="path" valueKey="views" format={(_, r) => pageName(r)} />
            </Box>
            <Box title="Paesi">
              <Bars rows={data.countries} labelKey="country" valueKey="visitors" format={countryName} />
            </Box>
            <Box title="Dispositivi">
              <Bars rows={data.devices} labelKey="device" valueKey="visitors" />
            </Box>
          </div>
        </>
      }
    </div>);
}
