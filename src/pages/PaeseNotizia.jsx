import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useSEO } from '@/lib/useSEO';
import { useJsonLd } from '@/lib/useJsonLd';
import { sized, fallbackTo } from '@/lib/imgSize';
import { linkNotizia, codiceNotizia, rangeId } from '@/lib/paesiLink';
import CondividiRiga from '@/components/CondividiRiga';

// Pagina di una singola notizia dei paesi (/paesi/<paese>/<titolo>-<codice>).
// Prima la notizia portava subito al giornale; ora ha una pagina sul nostro
// sito, con il riassunto, il pulsante per la fonte e quello per condividerla.

const SITE = 'https://www.gdmadonie-news.com';
const fmt = (d) => (d ? format(new Date(d), 'd MMMM yyyy', { locale: it }) : '');

export default function PaeseNotizia() {
  const { slug, notizia } = useParams();
  const codice = codiceNotizia(notizia);

  const { data, isLoading } = useQuery({
    queryKey: ['paese-notizia', slug, codice],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!codice) return { n: null };
      const [da, a] = rangeId(codice);
      const [comune, n] = await Promise.all([
        supabase.from('comuni').select('slug, nome, sito_url, og_image_url').eq('slug', slug).eq('attivo', true).maybeSingle(),
        supabase.from('comuni_notizie').select('id, titolo, riassunto, tema, fonte_tipo, fonte_nome, link, image_url, published_date').eq('comune_slug', slug).eq('stato', 'pubblicata').gte('id', da).lte('id', a).limit(1).maybeSingle(),
      ]);
      if (!comune.data || !n.data) return { n: null };
      const { data: altre } = await supabase.from('comuni_notizie').select('id, titolo, tema, fonte_nome, published_date').eq('comune_slug', slug).eq('stato', 'pubblicata').neq('id', n.data.id).order('published_date', { ascending: false }).limit(6);
      return { comune: comune.data, n: n.data, altre: altre || [] };
    },
  });

  const n = data?.n;
  const comune = data?.comune;
  const nome = comune?.nome || '';
  const url = n ? `${SITE}${linkNotizia(slug, n)}` : `${SITE}/paesi/${slug}`;
  const description = n ? (n.riassunto || `${n.titolo}. Notizia da ${nome}, da ${n.fonte_nome}.`).slice(0, 158) : 'Notizia non trovata.';
  const daComune = n?.fonte_tipo === 'comune';
  const fonteLabel = daComune ? `sul sito del Comune di ${nome}` : `su ${n?.fonte_nome || 'la fonte'}`;

  useSEO({
    title: n ? `${n.titolo}${n.titolo.toLowerCase().includes(nome.toLowerCase()) ? '' : ` — ${nome}`} — GD Madonie News` : 'Notizia non trovata — GD Madonie News',
    description,
    image: n ? (comune?.og_image_url || undefined) : undefined,
    url: n ? url : undefined,
    type: 'article',
    // Le notizie con il solo titolo non hanno testo nostro: restano fuori da Google.
    noindex: !isLoading && (!n || !n.riassunto),
  });

  const jsonLd = useMemo(() => (n ? {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: n.titolo.slice(0, 110),
    description,
    datePublished: n.published_date,
    url,
    mainEntityOfPage: url,
    inLanguage: 'it-IT',
    image: comune?.og_image_url ? [comune.og_image_url] : undefined,
    isBasedOn: n.link,
    about: { '@type': 'Place', name: nome },
    publisher: { '@type': 'Organization', name: 'GD Madonie News', url: SITE },
  } : null), [n, comune, url, description, nome]);
  useJsonLd(jsonLd);

  if (!isLoading && !n) {
    return (
      <div className="rd-page"><div className="page-head"><div className="hero-glow" /><div className="wrap-wide">
        <span className="section-kicker">Paesi</span><h1>NON TROVATA</h1>
        <p>Questa notizia non c'è più o è stata tolta. <Link to={`/paesi/${slug}`} style={{ color: 'var(--acc)', fontWeight: 800 }}>Vedi le altre notizie</Link></p>
      </div></div></div>);
  }

  return (
    <div className="rd-page">
      <div className="article-detail space-y-5">
        <Link to={`/paesi/${slug}`} className="back-link"><ArrowLeft size={15} /> Tutte le notizie di {nome || '…'}</Link>
        {isLoading ?
          <div className="space-y-4"><div className="skel" style={{ height: 40 }} /><div className="skel" style={{ height: 160 }} /></div> :
          <>
            <div className="space-y-2">
              <div className="meta-line" style={{ textTransform: 'uppercase' }}>
                <Link to={`/paesi/${slug}`} style={{ color: 'var(--acc)', fontWeight: 800 }}>{nome}</Link>
                {n.tema && <span className="d"> · {n.tema}</span>}
              </div>
              <h1>{n.titolo}</h1>
              <div className="text-xs text-muted-foreground">{n.fonte_nome} · {fmt(n.published_date)}</div>
            </div>

            {n.image_url && <div className="ad-media"><img src={sized(n.image_url, 1000)} onError={fallbackTo(n.image_url)} alt="" decoding="async" /></div>}

            <div className="ad-content">
              {n.riassunto ?
                <p>{n.riassunto}</p> :
                <p>Per questa notizia abbiamo solo il titolo: il testo completo è {fonteLabel}.</p>}
            </div>
            {n.riassunto && <p style={{ fontSize: 13, opacity: .6, margin: 0 }}>Riassunto scritto in automatico da GD Madonie News. Per tutti i dettagli leggi la notizia originale.</p>}

            <a href={n.link} target="_blank" rel="noopener nofollow" className="ad-external">
              Leggi la notizia completa {fonteLabel} <ExternalLink className="w-4 h-4" />
            </a>

            <CondividiRiga
              url={url}
              title={n.titolo}
              label="Condividi"
              testoWa={`📍 *${n.titolo}*\n\nLeggi su GD Madonie News:\n${url}`} />

            {data?.altre?.length > 0 &&
              <div style={{ paddingTop: 26 }}>
                <div className="side-title" style={{ marginBottom: 12 }}>Altre notizie da {nome}</div>
                <div className="mini-grid two">
                  {data.altre.map((a) =>
                    <Link key={a.id} to={linkNotizia(slug, a)} className="article-card noimg" style={{ height: '100%' }}>
                      <div className="card-body">
                        <div className="meta-line">{a.fonte_nome}<span className="d"> · {fmt(a.published_date)}</span></div>
                        <h3>{a.titolo}</h3>
                        {a.tema && <span className="chip-blu" style={{ fontSize: 10.5, padding: '5px 11px', alignSelf: 'flex-start', marginTop: 10 }}>{a.tema}</span>}
                      </div>
                    </Link>)}
                </div>
                <Link to={`/paesi/${slug}`} style={{ display: 'inline-block', marginTop: 18, fontWeight: 800, fontSize: 13, textTransform: 'uppercase', color: 'var(--acc)' }}>Tutte le notizie di {nome} →</Link>
              </div>}
          </>}
      </div>
    </div>);
}
