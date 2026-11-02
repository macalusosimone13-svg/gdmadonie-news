import { useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import ArticleBody from '@/components/ArticleBody';
import '@/speciali.css';

// Pagina speciale per una singola notizia (vedi src/lib/specialArticles.js):
// sfondo notte, oro da podio, strisce tricolori e titoli in Titillium Web.
// Header e footer del sito restano quelli di sempre; cambia solo la notizia.
const THEMES = {
  'campione-f1-2026': {
    kicker: 'Formula 1 · Mondiale 2026',
    bigNumber: '73',
    stats: [
      { n: '20', t: 'anni e 68 giorni: il campione più giovane di sempre' },
      { n: '73', t: "anni dall'ultimo italiano, Alberto Ascari nel 1953" },
      { n: '8', t: 'vittorie in stagione, prima del Messico' },
      { n: '380', t: 'punti, 119 più di Verstappen' },
    ],
  },
};

const FONT_ID = 'speciali-fonts';
const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Titillium+Web:ital,wght@0,400;0,600;0,700;0,900;1,700&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&display=swap';

function Tricolore({ thin }) {
  return <div className={`sp-tri${thin ? ' thin' : ''}`} aria-hidden="true"><i /><i /><i /></div>;
}

const readingMinutes = (text) => Math.max(1, Math.round((text || '').split(/\s+/).filter(Boolean).length / 200));

export default function SpecialeCampione({ theme, post, date, isAdmin, onDelete, children }) {
  const cfg = THEMES[theme] || THEMES['campione-f1-2026'];

  // I due font servono solo a questa pagina: si caricano qui, non su tutto il sito.
  useEffect(() => {
    if (document.getElementById(FONT_ID)) return;
    const l = document.createElement('link');
    l.id = FONT_ID; l.rel = 'stylesheet'; l.href = FONT_HREF;
    document.head.appendChild(l);
  }, []);

  return (
    <div className="dark sp-campione">
      <Tricolore />
      <section className="sp-hero">
        <div className="sp-big" aria-hidden="true">{cfg.bigNumber}</div>
        <div className="sp-wrap sp-hero-in">
          <p className="sp-kicker">{cfg.kicker}</p>
          <h1>{post.title}</h1>
          {post.excerpt && <p className="sp-deck">{post.excerpt}</p>}
          <div className="sp-meta">
            {post.author && <span className="sp-author">{post.author}</span>}
            {date && <span>{date}</span>}
            <span>Lettura: {readingMinutes(post.content)} min</span>
          </div>
          {isAdmin &&
          <button onClick={onDelete} className="sp-admin-del">
              <Trash2 className="w-3.5 h-3.5" /> Elimina questa notizia (solo admin)
            </button>}
        </div>
      </section>

      <section className="sp-stats" aria-label="I numeri">
        <div className="sp-wrap sp-stats-grid">
          {cfg.stats.map((s) =>
          <div key={s.t} className="sp-stat">
              <div className="sp-stat-n">{s.n}</div>
              <div className="sp-stat-t">{s.t}</div>
            </div>
          )}
        </div>
      </section>

      <article className="sp-body">
        <ArticleBody text={post.content} />
      </article>

      <div className="sp-tail">{children}</div>
      <Tricolore />
    </div>);
}
