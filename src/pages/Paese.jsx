import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useSEO } from '@/lib/useSEO';
import { useJsonLd } from '@/lib/useJsonLd';
import { sized, fallbackTo } from '@/lib/imgSize';
import Reveal from '@/components/Reveal';

// Pagina di un paese delle Madonie (/paesi/:slug). Tutto il contenuto arriva
// in automatico dalla funzione "aggrega-paesi": notizie del sito del Comune e
// dei giornali, filtrate (solo politica e amministrazione) e riassunte, piu'
// "Il punto", un testo di sintesi aggiornato dopo ogni novita'.
// Le notizie di GD Madonie che nominano il paese compaiono in cima.

const SITE = 'https://www.gdmadonie-news.com';
const GD_CATS = ['comunicato', 'news_gd', 'proposta', 'approfondimento'];
const fmt = (d) => (d ? format(new Date(d), 'd MMMM yyyy', { locale: it }) : '');

export default function Paese() {
  const { slug } = useParams();
  const [tema, setTema] = useState('tutti');

  const { data, isLoading } = useQuery({
    queryKey: ['paese', slug],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data: comune } = await supabase.from('comuni').select('slug, nome, sito_url, punto, punto_aggiornato_at').eq('slug', slug).eq('attivo', true).maybeSingle();
      if (!comune) return { comune: null };
      const like = `"%${comune.nome}%"`;
      const [notizie, gd, altri] = await Promise.all([
        supabase.from('comuni_notizie').select('id, titolo, riassunto, tema, fonte_tipo, fonte_nome, link, image_url, published_date').eq('comune_slug', slug).eq('stato', 'pubblicata').order('published_date', { ascending: false }).limit(80),
        supabase.from('posts').select('id, slug, title, excerpt, image_url, published_date, created_at, category').in('category', GD_CATS).eq('status', 'published').or(`title.ilike.${like},content.ilike.${like}`).order('created_at', { ascending: false }).limit(6),
        supabase.from('comuni').select('slug, nome').eq('attivo', true).order('sort_order'),
      ]);
      return { comune, notizie: notizie.data || [], gd: gd.data || [], altri: (altri.data || []).filter((c) => c.slug !== slug) };
    },
  });

  const comune = data?.comune;
  const notizie = data?.notizie || [];
  const nome = comune?.nome || '';
  const temi = useMemo(() => [...new Set(notizie.map((n) => n.tema).filter(Boolean))], [notizie]);
  const visibili = tema === 'tutti' ? notizie : notizie.filter((n) => n.tema === tema);
  const puntoParas = (comune?.punto || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

  const description = comune
    ? (puntoParas[0] || `Notizie di politica e amministrazione del Comune di ${nome}: consiglio comunale, fondi, opere pubbliche e servizi.`).slice(0, 158)
    : 'Paese non trovato.';

  useSEO({
    title: comune ? `${nome}: notizie di politica, Comune e consiglio comunale — GD Madonie News` : 'Paese non trovato — GD Madonie News',
    description,
    url: comune ? `${SITE}/paesi/${slug}` : undefined,
    noindex: !isLoading && !comune,
  });

  const jsonLd = useMemo(() => (comune ? {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${nome}: politica e amministrazione`,
    url: `${SITE}/paesi/${slug}`,
    description,
    inLanguage: 'it-IT',
    about: { '@type': 'Place', name: nome, containedInPlace: { '@type': 'AdministrativeArea', name: 'Città metropolitana di Palermo' } },
    isPartOf: { '@type': 'WebSite', name: 'GD Madonie News', url: SITE },
    breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Paesi', item: `${SITE}/paesi` },
      { '@type': 'ListItem', position: 2, name: nome, item: `${SITE}/paesi/${slug}` },
    ] },
    mainEntity: { '@type': 'ItemList', itemListElement: notizie.slice(0, 20).map((n, i) => ({ '@type': 'ListItem', position: i + 1, name: n.titolo, url: n.link })) },
  } : null), [comune, notizie, slug, nome, description]);
  useJsonLd(jsonLd);

  if (!isLoading && !comune) {
    return (
      <div className="rd-page"><div className="page-head"><div className="hero-glow" /><div className="wrap-wide">
        <span className="section-kicker">Paesi</span><h1>NON TROVATO</h1>
        <p>Questo paese non è ancora nella sezione. <Link to="/paesi" style={{ color: 'var(--acc)', fontWeight: 800 }}>Vedi tutti i paesi</Link></p>
      </div></div></div>);
  }

  return (
    <div className="rd-page">
      <div className="page-head"><div className="hero-glow" /><div className="wrap-wide">
        <span className="section-kicker"><Link to="/paesi">Paesi delle Madonie</Link></span>
        <h1>{isLoading ? '…' : nome.toUpperCase()}</h1>
        <p>Politica e amministrazione a {nome || '…'}: consiglio comunale, bilancio, fondi, opere pubbliche e servizi. Dal sito del Comune e dai giornali, aggiornato in automatico.</p>
        {temi.length > 1 &&
          <div className="tabs">
            <button className={`tab ${tema === 'tutti' ? 'active' : ''}`} onClick={() => setTema('tutti')}>Tutto<span className="n">{notizie.length}</span></button>
            {temi.map((t) => <button key={t} className={`tab ${tema === t ? 'active' : ''}`} onClick={() => setTema(t)}>{t}<span className="n">{notizie.filter((n) => n.tema === t).length}</span></button>)}
          </div>}
      </div></div>

      <div className="wrap-wide" style={{ paddingTop: 36 }}>
        <div className="paese-layout">
          <div className="paese-main" style={{ minWidth: 0 }}>
            {isLoading ?
              <div className="mini-grid two">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skel" style={{ height: 220 }} />)}</div> :
            visibili.length === 0 ?
              <div className="side-box" style={{ textAlign: 'center', opacity: .75 }}>Ancora nessuna notizia politica o amministrativa su {nome}. La pagina si aggiorna da sola ogni ora.</div> :
              <div className="mini-grid two">
                {visibili.map((n) => <Reveal key={n.id}><NotiziaCard n={n} /></Reveal>)}
              </div>}
          </div>

          <aside className="paese-top">
            {puntoParas.length > 0 &&
              <div className="side-box">
                <div className="side-title">Il punto su {nome}</div>
                {puntoParas.map((p, i) => <p key={i} style={{ margin: '0 0 12px', lineHeight: 1.6, fontSize: 15 }}>{p}</p>)}
                {comune?.punto_aggiornato_at && <div style={{ fontSize: 12, opacity: .55, marginTop: 6 }}>Sintesi automatica delle notizie qui accanto · aggiornata il {fmt(comune.punto_aggiornato_at)}</div>}
              </div>}

            {data?.gd?.length > 0 &&
              <div className="side-box">
                <div className="side-title">GD Madonie su {nome}</div>
                {data.gd.map((p) =>
                  <Link key={p.id} to={`/post/${p.slug || p.id}`} style={{ display: 'block', padding: '10px 0', borderTop: '1px solid rgba(28,34,51,.08)' }}>
                    <div className="meta-line">News GD <span className="d">· {fmt(p.published_date || p.created_at)}</span></div>
                    <div style={{ fontWeight: 800, lineHeight: 1.25, marginTop: 4 }}>{p.title}</div>
                  </Link>)}
              </div>}
          </aside>

          <aside className="paese-bottom">
            <div className="side-box">
              <div className="side-title">Fonti</div>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, opacity: .8 }}>
                Le notizie arrivano dal {comune?.sito_url ? <a href={comune.sito_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--acc)', fontWeight: 700 }}>sito ufficiale del Comune di {nome}</a> : `sito del Comune di ${nome}`} e dai giornali che ne parlano. Teniamo solo quelle di politica e amministrazione; i riassunti sono scritti in automatico: per i dettagli apri sempre la fonte.
              </p>
            </div>

            {data?.altri?.length > 0 &&
              <div className="side-box">
                <div className="side-title">Altri paesi</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {data.altri.map((c) => <Link key={c.slug} to={`/paesi/${c.slug}`} className="topic" style={{ padding: '9px 16px', fontSize: 13 }}>{c.nome}</Link>)}
                </div>
              </div>}
          </aside>
        </div>
        <div style={{ height: 90 }} />
      </div>
    </div>);
}

function NotiziaCard({ n }) {
  const daComune = n.fonte_tipo === 'comune';
  return (
    <article className={`article-card${n.image_url ? '' : ' noimg'}`} style={{ height: '100%' }}>
      <a href={n.link} target="_blank" rel="noopener nofollow" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        {n.image_url && <div className="card-media" style={{ aspectRatio: '16/9' }}><img src={sized(n.image_url, 640)} onError={fallbackTo(n.image_url)} alt="" loading="lazy" decoding="async" /></div>}
        <div className="card-body">
          <div className="meta-line">{n.fonte_nome}<span className="d"> · {fmt(n.published_date)}</span></div>
          <h3>{n.titolo}</h3>
          {n.riassunto && <p style={{ WebkitLineClamp: 'unset', display: 'block' }}>{n.riassunto}</p>}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
            {n.tema && <span className="chip-blu" style={{ fontSize: 10.5, padding: '5px 11px' }}>{n.tema}</span>}
            <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--acc)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              {daComune ? 'Leggi sul sito del Comune' : `Leggi su ${n.fonte_nome}`} <ExternalLink size={12} />
            </span>
          </div>
        </div>
      </a>
    </article>);
}
