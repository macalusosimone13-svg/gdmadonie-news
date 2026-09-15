import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;

  const go = (n) => {
    if (n < 1 || n > totalPages || n === page) return;
    onChange(n);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const win = 2;
  const start = Math.max(1, page - win);
  const end = Math.min(totalPages, page + win);
  const pages = [];
  for (let i = start; i <= end; i++) pages.push(i);

  const btnBase = 'min-w-[40px] min-h-[40px] px-3 rounded-full text-sm font-medium transition-colors';
  const btnIdle = 'bg-card text-muted-foreground border border-border hover:bg-muted';
  const btnActive = "text-primary-foreground bg-[hsl(var(--primary))]";
  const btnNav = `${btnBase} ${btnIdle} disabled:opacity-40 flex items-center justify-center`;

  return (
    <div className="flex items-center justify-center gap-2 pt-4 flex-wrap">
      <button onClick={() => go(page - 1)} disabled={page <= 1} aria-label="Pagina precedente" className={btnNav}>
        <ChevronLeft className="w-4 h-4" />
      </button>
      {start > 1 && <button onClick={() => go(1)} className={`${btnBase} ${btnIdle}`}>1</button>}
      {start > 2 && <span className="px-1 text-muted-foreground">…</span>}
      {pages.map((n) =>
      <button key={n} onClick={() => go(n)} className={`${btnBase} ${n === page ? btnActive : btnIdle}`}>{n}</button>
      )}
      {end < totalPages - 1 && <span className="px-1 text-muted-foreground">…</span>}
      {end < totalPages && <button onClick={() => go(totalPages)} className={`${btnBase} ${btnIdle}`}>{totalPages}</button>}
      <button onClick={() => go(page + 1)} disabled={page >= totalPages} aria-label="Pagina successiva" className={btnNav}>
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>);

}
