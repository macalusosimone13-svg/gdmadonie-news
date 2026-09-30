import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { supabase } from '@/lib/supabaseClient';
import { useSEO } from '@/lib/useSEO';
import Reveal from '@/components/Reveal';
import { MappaMadonie } from '@/components/MappaPaese';

// Elenco dei paesi (/paesi): una scheda per ogni comune con l'ultima notizia.
export default function Paesi() {
  useSEO({
    title: 'Paesi delle Madonie: politica e amministrazione comune per comune — GD Madonie News',
    description: 'Consiglio comunale, bilancio, fondi, opere pubbliche e servizi nei paesi delle Madonie: Blufi, Gangi, Petralia Soprana, Petralia Sottana e altri. Aggiornato ogni giorno.',
    url: 'https://www.gdmadonie-news.com/paesi',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['paesi'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data: comuni } = await supabase.from('comuni').select('slug, nome, punto').eq('attivo', true).order('sort_order');
      const { data: ultime } = await supabase.from('comuni_notizie').select('comune_slug, titolo, published_date').eq('stato', 'pubblicata').order('published_date', { ascending: false }).limit(300);
      return (comuni || []).map((c) => {
        const sue = (ultime || []).filter((u) => u.comune_slug === c.slug);
        return { ...c, conta: sue.length, ultima: sue[0] || null };
      });
    },
  });

  return (
    <div className="rd-page">
      <div className="page-head"><div className="hero-glow" /><div className="wrap-wide">
        <div className="paese-head">
          <div>
            <span className="section-kicker">Le Madonie, paese per paese</span>
            <h1>PAESI</h1>
            <p>Cosa decidono i Comuni, dove vanno i fondi, cosa succede in consiglio comunale. Notizie raccolte dai siti dei Comuni e dai giornali, aggiornate in automatico.</p>
            <p style={{ marginTop: 14, fontSize: 14, opacity: .6 }}>Tocca un paese sulla mappa per aprire la sua pagina.</p>
          </div>
          <MappaMadonie nomi={Object.fromEntries((data || []).map((c) => [c.slug, c.nome]))} className="grande" />
        </div>
      </div></div>
      <div className="wrap-wide" style={{ paddingTop: 40 }}>
        {isLoading ?
          <div className="mini-grid">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skel" style={{ height: 200 }} />)}</div> :
          <div className="mini-grid">
            {(data || []).map((c) =>
              <Reveal key={c.slug}>
                <Link to={`/paesi/${c.slug}`} className="article-card noimg" style={{ height: '100%' }}>
                  <div className="card-body">
                    <div className="meta-line">{c.conta} notizi{c.conta === 1 ? 'a' : 'e'}{c.ultima && <span className="d"> · ultima il {format(new Date(c.ultima.published_date), 'd MMMM', { locale: it })}</span>}</div>
                    <h3 style={{ fontSize: '1.9rem', textTransform: 'uppercase' }}>{c.nome}</h3>
                    {c.ultima ? <p>{c.ultima.titolo}</p> : <p>Le prime notizie arrivano a breve.</p>}
                    <div style={{ marginTop: 14, fontWeight: 800, fontSize: 13, textTransform: 'uppercase', color: 'var(--acc)' }}>Apri {c.nome} →</div>
                  </div>
                </Link>
              </Reveal>)}
          </div>}
        <div style={{ height: 90 }} />
      </div>
    </div>);
}
