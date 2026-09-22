import { useEffect, useMemo, useState } from 'react';
import { sb44 } from '@/api/supabaseEntities';
import { sized, fallbackTo } from '@/lib/imgSize';
import { Eye, Share2, Loader2, ExternalLink, Newspaper, Megaphone } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

// Piccolo cruscotto "cosa funziona meglio": classifica dei post per letture
// e per condivisioni, cosi' si capisce a colpo d'occhio cosa interessa di
// piu' ai lettori (e cosa scrivere in piu' in futuro). I numeri si contano
// da soli sul sito (una volta a sessione per le letture, ad ogni
// condivisione riuscita) tramite le funzioni increment_post_view /
// increment_post_share — qui si legge soltanto quello che e' gia' stato
// contato, nessun calcolo in tempo reale.
const RANK_MEDALS = ['🥇', '🥈', '🥉'];

function RankedList({ posts, metric }) {
  if (!posts.length) {
    return <p className="text-sm text-muted-foreground text-center py-10">Non ci sono ancora abbastanza dati. Torna a controllare tra qualche giorno.</p>;
  }
  return (
    <div className="space-y-2">
      {posts.map((p, i) => {
        const count = metric === 'views' ? p.views_count || 0 : p.shares_count || 0;
        const isGD = p.source_type === 'gd_madonie';
        return (
          <a
            key={p.id}
            href={`/articolo/${p.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 bg-card border border-border rounded-xl p-3 hover:border-[#2F5BD8]/40 transition-colors">
            <span className="w-7 text-center text-sm font-extrabold text-muted-foreground flex-shrink-0">{RANK_MEDALS[i] || i + 1}</span>
            {p.image_url ?
            <img src={sized(p.image_url, 96)} onError={fallbackTo(p.image_url)} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" /> :
            <div className="w-12 h-12 rounded-lg bg-muted flex-shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{p.title}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${isGD ? 'bg-[#EAF0FD] text-[#2F5BD8]' : 'bg-muted text-muted-foreground'}`}>
                  {isGD ? <Megaphone className="w-2.5 h-2.5" /> : <Newspaper className="w-2.5 h-2.5" />}
                  {isGD ? 'News GD' : (p.source_name || 'Rassegna')}
                </span>
                {p.published_date ? format(new Date(p.published_date), 'd MMM yyyy', { locale: it }) : ''}
              </p>
            </div>
            <div className="flex-shrink-0 text-right">
              <div className="flex items-center gap-1 text-sm font-extrabold text-foreground">
                {metric === 'views' ? <Eye className="w-3.5 h-3.5 text-muted-foreground" /> : <Share2 className="w-3.5 h-3.5 text-muted-foreground" />}
                {count}
              </div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          </a>);

      })}
    </div>);

}

export default function StatsPanel() {
  const [metric, setMetric] = useState('views');
  const [scope, setScope] = useState('all');
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    sb44.entities.Post.filter({ status: 'published' }, `-${metric === 'views' ? 'views_count' : 'shares_count'}`, 200)
      .then((data) => setPosts(data || []))
      .finally(() => setLoading(false));
  }, [metric]);

  const filtered = useMemo(() => {
    let list = posts;
    if (scope === 'gd') list = list.filter((p) => p.source_type === 'gd_madonie');
    if (scope === 'rassegna') list = list.filter((p) => p.source_type !== 'gd_madonie');
    // Solo chi ha almeno un po' di dati, altrimenti la lista e' solo rumore
    // (tanti post recenti a zero, ordinati per titolo/data invece che per interesse reale).
    list = list.filter((p) => (metric === 'views' ? p.views_count : p.shares_count) > 0);
    return list.slice(0, 15);
  }, [posts, scope, metric]);

  const totals = useMemo(() => {
    const views = posts.reduce((s, p) => s + (p.views_count || 0), 0);
    const shares = posts.reduce((s, p) => s + (p.shares_count || 0), 0);
    return { views, shares };
  }, [posts]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Le notizie più lette e più condivise sul sito, per capire cosa interessa di più ai lettori e cosa scrivere in più.
        Il conteggio parte da oggi: le notizie pubblicate prima non hanno ancora numeri.
      </p>

      <div className="flex flex-wrap gap-3 text-xs font-medium text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 bg-card border border-border rounded-full px-3 py-1.5"><Eye className="w-3.5 h-3.5" /> {totals.views} letture in totale</span>
        <span className="inline-flex items-center gap-1.5 bg-card border border-border rounded-full px-3 py-1.5"><Share2 className="w-3.5 h-3.5" /> {totals.shares} condivisioni in totale</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex bg-muted rounded-full p-1 text-sm font-medium w-fit">
          <button type="button" onClick={() => setMetric('views')} className={`px-4 py-2 rounded-full ${metric === 'views' ? 'bg-[#2F5BD8] text-white' : 'text-muted-foreground'}`}>Più lette</button>
          <button type="button" onClick={() => setMetric('shares')} className={`px-4 py-2 rounded-full ${metric === 'shares' ? 'bg-[#2F5BD8] text-white' : 'text-muted-foreground'}`}>Più condivise</button>
        </div>
        <div className="flex bg-muted rounded-full p-1 text-sm font-medium w-fit">
          <button type="button" onClick={() => setScope('all')} className={`px-4 py-2 rounded-full ${scope === 'all' ? 'bg-[#2F5BD8] text-white' : 'text-muted-foreground'}`}>Tutte</button>
          <button type="button" onClick={() => setScope('gd')} className={`px-4 py-2 rounded-full ${scope === 'gd' ? 'bg-[#2F5BD8] text-white' : 'text-muted-foreground'}`}>News GD</button>
          <button type="button" onClick={() => setScope('rassegna')} className={`px-4 py-2 rounded-full ${scope === 'rassegna' ? 'bg-[#2F5BD8] text-white' : 'text-muted-foreground'}`}>Rassegna</button>
        </div>
      </div>

      {loading ?
      <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div> :
      <RankedList posts={filtered} metric={metric} />}
    </div>);

}
