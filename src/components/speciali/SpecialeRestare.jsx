import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import ArticleBody from '@/components/ArticleBody';
import InstagramPost from '@/components/speciali/InstagramPost';
import '@/speciali-restare.css';

// Pagina speciale "Diritto a restare" (vedi src/lib/specialArticles.js): stessa
// grafica del carosello GD Siciliani / PD Sicilia sulla finanziaria. Verde,
// panna e nero, titoli in Anton, etichette spaziate, la parola barrata in rosso.
// Header e footer del sito restano quelli di sempre; cambia solo la notizia.
const THEMES = {
  'diritto-a-restare': {
    kicker: 'Finanziaria regionale',
    strike: 'bonus',
    stats: [
      { n: '30', u: 'mln €', t: 'gli stessi soldi del bonus, in tre anni (2027-2029)' },
      { n: '18-35', u: 'anni', t: 'inattivi, disoccupati, beneficiari GOL, lavoratori poveri' },
      { n: '150.000', u: '€', t: 'a fondo perduto per progetto, dal 20% all\'80%' },
      { n: '0', u: '€', t: 'da anticipare: le fatture le paga direttamente il fondo' },
    ],
    compare: {
      label: 'Bonus o impresa?',
      left: { title: 'Bonus Schifani', rows: ['30 mln in 3 anni', 'Pochi laureati con 110 e lode', 'Soldi per un periodo limitato'], last: 'Non crea lavoro' },
      right: { title: 'Impresa Giovani Sicilia', rows: ['30 mln in 3 anni', 'Centinaia di giovani che fanno impresa', 'Fino a 150.000 € per progetto'], last: 'Lavoro vero, anche per chi vuole tornare' },
    },
    closing: {
      text: 'Per restare in Sicilia non serve un regalo prima delle elezioni. Serve la possibilità di fare impresa.',
      tag: 'Dove nasci conta',
    },
    instagramLabel: 'Il carosello su Instagram',
  },
};

const FONT_ID = 'speciali-restare-fonts';
const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Anton&family=Archivo:wght@600;700;800&display=swap';

const WIDE = '(min-width: 820px)';
function useWide() {
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia?.(WIDE).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(WIDE);
    if (!mq) return;
    const on = () => setWide(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return wide;
}

const readingMinutes = (text) => Math.max(1, Math.round((text || '').split(/\s+/).filter(Boolean).length / 200));

// La parola indicata (es. "bonus") esce barrata in rosso, come nel carosello.
function TitleWithStrike({ title, word }) {
  if (!word) return title;
  const i = title.toLowerCase().indexOf(word.toLowerCase());
  if (i < 0) return title;
  return <>{title.slice(0, i)}<span className="sr-strike">{title.slice(i, i + word.length)}</span>{title.slice(i + word.length)}</>;
}

export default function SpecialeRestare({ theme, post, date, isAdmin, onDelete, children }) {
  const cfg = THEMES[theme] || THEMES['diritto-a-restare'];
  const wide = useWide();
  // Il link al carosello si inserisce dal pannello admin, nel campo "Link esterno".
  const igPost = <InstagramPost url={post.external_link} label={cfg.instagramLabel} />;
  const cover = post.media?.[0]?.url || post.image_url;

  useEffect(() => {
    if (document.getElementById(FONT_ID)) return;
    const l = document.createElement('link');
    l.id = FONT_ID; l.rel = 'stylesheet'; l.href = FONT_HREF;
    document.head.appendChild(l);
  }, []);

  return (
    <div className="sp-restare">
      <section className="sr-hero">
        <div className="sr-wrap sr-hero-in">
          <div className="sr-hero-text">
            <p className="sr-tag">{cfg.kicker}</p>
            <h1><TitleWithStrike title={post.title} word={cfg.strike} /></h1>
            {post.excerpt && <p className="sr-deck">{post.excerpt}</p>}
            <div className="sr-meta">
              {post.author && <span className="sr-author">{post.author}</span>}
              {date && <span>{date}</span>}
              <span>Lettura: {readingMinutes(post.content)} min</span>
            </div>
            {isAdmin &&
            <button onClick={onDelete} className="sr-admin-del">
                <Trash2 className="w-3.5 h-3.5" /> Elimina questa notizia (solo admin)
              </button>}
          </div>
          {cover &&
          <figure className="sr-cover">
              <img src={cover} alt={post.title} width="1200" height="1600" />
            </figure>}
        </div>
        <div className="sr-wrap"><div className="sr-foot"><span>Diritto a restare</span><span>Scorri</span></div></div>
      </section>

      <section className="sr-stats" aria-label="I numeri">
        <div className="sr-wrap">
          <p className="sr-tag sr-tag-green">La controproposta in numeri</p>
          <div className="sr-stats-grid">
            {cfg.stats.map((s) =>
            <div key={s.t} className="sr-stat">
                <div className="sr-stat-n">{s.n}<small>{s.u}</small></div>
                <div className="sr-stat-t">{s.t}</div>
              </div>
            )}
          </div>
        </div>
      </section>

      {cfg.compare &&
      <section className="sr-compare" aria-label={cfg.compare.label}>
          <div className="sr-wrap">
            <p className="sr-tag sr-tag-mint">{cfg.compare.label}</p>
            <div className="sr-compare-grid">
              {['left', 'right'].map((k) => {
              const c = cfg.compare[k];
              return (
                <div key={k} className={`sr-card sr-card-${k}`}>
                    <h3>{c.title}</h3>
                    <ul>
                      {c.rows.map((r) => <li key={r}>{r}</li>)}
                      <li className="sr-card-last">{c.last}</li>
                    </ul>
                  </div>);
            })}
            </div>
          </div>
        </section>}

      {wide && <div className="sr-ig-slot sr-ig-top">{igPost}</div>}

      <article className="sr-body">
        <ArticleBody text={post.content} />
      </article>

      {!wide && <div className="sr-ig-slot">{igPost}</div>}

      {cfg.closing &&
      <section className="sr-closing">
          <div className="sr-wrap">
            <p className="sr-closing-text">{cfg.closing.text}</p>
            <p className="sr-closing-tag">{cfg.closing.tag}</p>
          </div>
        </section>}

      {/* condivisione, commenti e correlate su fondo scuro, come le slide nere */}
      <div className="dark sr-tail-wrap">
        <div className="sr-tail">{children}</div>
      </div>
    </div>);
}
