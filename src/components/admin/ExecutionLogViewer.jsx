import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { RefreshCw, Loader2, CheckCircle2, AlertTriangle, XCircle, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

export default function ExecutionLogViewer() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  const load = () => {
    setLoading(true);
    base44.entities.ExecutionLog.list('-run_date', 20)
      .then((data) => setLogs(data || []))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const statusIcon = (s) =>
    s === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
    : s === 'partial' ? <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
    : <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />;

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-foreground">Log esecuzioni RSS</h3>
          <p className="text-sm text-muted-foreground">Ultimi 20 run dell'aggiornamento automatico (ogni 30 min).</p>
        </div>
        <button onClick={load} disabled={loading} aria-label="Aggiorna log" className="flex items-center gap-1.5 text-sm border border-border px-3 py-2.5 min-h-[44px] rounded-lg hover:bg-muted">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Aggiorna
        </button>
      </div>
      {loading && logs.length === 0 ? (
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : logs.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Nessuna esecuzione registrata. Il primo run avverrà entro 30 minuti (o clicca "Importa ora" nella tab Rassegna RSS).</p>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <div key={log.id} className="bg-muted border border-border rounded-xl">
              <button onClick={() => setExpanded(expanded === log.id ? null : log.id)} className="w-full flex items-center gap-3 p-3 text-left min-h-[44px]">
                {statusIcon(log.status)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{log.run_date ? format(new Date(log.run_date), 'dd MMM yyyy · HH:mm', { locale: it }) : '—'}</p>
                  <p className="text-xs text-muted-foreground truncate">{log.summary || `${log.total_added} nuovi articoli`}</p>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary flex-shrink-0">+{log.total_added ?? 0}</span>
                <ChevronDown className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform ${expanded === log.id ? 'rotate-180' : ''}`} />
              </button>
              {expanded === log.id && log.details && (() => {
                const errs = log.details.filter(d => d.error);
                const empties = log.details.filter(d => !d.error && (d.found ?? 0) === 0);
                const oks = log.details.filter(d => !d.error && (d.found ?? 0) > 0);
                const Row = ({ d, tone }) => (
                  <div className="flex items-start justify-between text-xs gap-2 py-1">
                    <span className="text-foreground truncate min-w-0">{d.source}{d.scope ? ` · ${d.scope}` : ''}</span>
                    <span className={`flex-shrink-0 text-right ${tone === 'err' ? 'text-red-600 font-medium' : tone === 'warn' ? 'text-amber-600' : 'text-muted-foreground'}`}>
                      {d.error ? '⚠ ' + d.error : tone === 'warn' ? ('⊘ ' + (d.note || '0 articoli')) : `+${d.added ?? 0} / ${d.found ?? 0}${d.removed ? ` (−${d.removed})` : ''}`}
                    </span>
                  </div>
                );
                return (
                  <div className="px-3 pb-3 border-t border-border pt-2">
                    {(errs.length + empties.length) > 0 && (
                      <p className="text-xs font-semibold mb-2"><span className="text-red-600">{errs.length} in errore</span> · <span className="text-amber-600">{empties.length} senza articoli</span></p>
                    )}
                    {errs.length > 0 && <div className="mb-2 space-y-0.5">{errs.map((d, i) => <Row key={'e'+i} d={d} tone="err" />)}</div>}
                    {empties.length > 0 && <div className="mb-2 space-y-0.5">{empties.map((d, i) => <Row key={'em'+i} d={d} tone="warn" />)}</div>}
                    {oks.length > 0 && <div className="space-y-0.5">{oks.map((d, i) => <Row key={'o'+i} d={d} tone="ok" />)}</div>}
                  </div>
                );
              })()}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
