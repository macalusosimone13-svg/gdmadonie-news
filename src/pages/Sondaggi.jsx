import { useState, useMemo, useEffect, useRef } from 'react';
import { useInView } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { sb44 } from '@/api/supabaseEntities';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { Loader2, ArrowUp, ArrowDown, Minus, Instagram, Image as ImageIcon, Share2 } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { useSiteContent } from '@/lib/useSiteContent';
import { getContent } from '@/lib/siteContent';
import { buildPollChartBlob } from '@/lib/storyImage';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useUxConfig } from '@/lib/UxConfigContext';
import { useSEO } from '@/lib/useSEO';
import { useJsonLd } from '@/lib/useJsonLd';
import AdSlot from '@/components/AdSlot';
import { ADS_ENABLED } from '@/lib/adsConfig';

const SCOPE_LABELS = {
  nazionale: 'Sondaggi Nazionali',
  regionale: 'Sondaggi Regionali (liste)',
  candidati_sicilia: 'Intenzioni di voto regionali siciliane - candidati'
};

const FALLBACK_COLORS = ['#0F1B3A', '#ff7024', '#0ea5e9', '#16a34a', '#a8262c', '#7c3aed', '#ca8a04', '#0d9488'];

export default function Sondaggi() {
  const [scope, setScope] = useState('nazionale');
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 640 : false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Le barre dei due grafici si "riempiono" con l'animazione solo quando
  // l'utente arriva davvero a guardarle scorrendo, invece di essere gia'
  // piene appena la pagina si carica.
  const mainChartRef = useRef(null);
  const mainChartInView = useInView(mainChartRef, { once: true, margin: '-80px' });
  const coalitionChartRef = useRef(null);
  const coalitionChartInView = useInView(coalitionChartRef, { once: true, margin: '-80px' });
  const { data: entries, isLoading } = useQuery({
    queryKey: ['poll-entries', scope],
    queryFn: () => sb44.entities.PollEntry.filter({ scope }, 'survey_date', 1000),
    staleTime: 5 * 60 * 1000
  });

  const { data: coalitionGroups } = useQuery({
    queryKey: ['coalition-groups'],
    queryFn: () => sb44.entities.CoalitionGroup.list('sort_order', 50),
    staleTime: 5 * 60 * 1000,
    enabled: scope === 'nazionale'
  });

  const { surveys, parties, latest, previous, trendData } = useMemo(() => {
    if (!entries || !entries.length) return { surveys: [], parties: [], latest: null, previous: null, trendData: [] };
    const byDate = {};
    for (const e of entries) {
      if (!byDate[e.survey_date]) byDate[e.survey_date] = { date: e.survey_date, institute: e.institute, turnout: e.turnout, undecided: e.undecided, rows: [] };
      byDate[e.survey_date].rows.push(e);
    }
    const surveysSorted = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
    const partySet = new Map();
    for (const e of entries) {
      if (!partySet.has(e.party)) partySet.set(e.party, e.party_color || null);
    }
    const partyList = Array.from(partySet.keys());
    const latestSurvey = surveysSorted[surveysSorted.length - 1] || null;
    const previousSurvey = surveysSorted.length > 1 ? surveysSorted[surveysSorted.length - 2] : null;
    const trend = surveysSorted.map((s) => {
      const row = { date: s.date, label: format(new Date(s.date), 'd MMM yy', { locale: it }) };
      for (const r of s.rows) row[r.party] = r.percentage;
      return row;
    });
    return { surveys: surveysSorted, parties: partyList, latest: latestSurvey, previous: previousSurvey, trendData: trend };
  }, [entries]);

  const colorFor = (party, idx) => {
    const e = entries?.find((x) => x.party === party && x.party_color);
    return e?.party_color || FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
  };
  const logoFor = (party) => entries?.find((x) => x.party === party && x.logo_url)?.logo_url;

  const latestChartData = useMemo(() => {
    if (!latest) return [];
    return [...latest.rows].
    sort((a, b) => b.percentage - a.percentage).
    map((r) => {
      const prevRow = previous?.rows.find((p) => p.party === r.party);
      const delta = prevRow ? +(r.percentage - prevRow.percentage).toFixed(1) : null;
      return { party: r.party, percentage: r.percentage, delta, color: r.party_color, logo_url: r.logo_url };
    });
  }, [latest, previous]);

  const coalitionTotals = useMemo(() => {
    if (scope !== 'nazionale' || !latest || !coalitionGroups?.length) return [];
    const sumFor = (survey, names) => {
      if (!survey) return null;
      let sum = 0, found = false;
      for (const r of survey.rows) {
        const partyName = (r.party || '').split('\n')[0].trim();
        if (names.includes(partyName)) { sum += r.percentage; found = true; }
      }
      return found ? +sum.toFixed(1) : null;
    };
    return coalitionGroups.
    map((g) => {
      const names = g.party_names || [];
      const value = sumFor(latest, names);
      const prevValue = sumFor(previous, names);
      const delta = value != null && prevValue != null ? +(value - prevValue).toFixed(1) : null;
      return { key: g.id, label: g.label, color: g.color || '#0F1B3A', value, delta };
    }).
    filter((g) => g.value != null).
    sort((a, b) => b.value - a.value);
  }, [scope, latest, previous, coalitionGroups]);

  const coalitionTrendData = useMemo(() => {
    if (scope !== 'nazionale' || !coalitionGroups?.length || !surveys.length) return [];
    return surveys.map((s) => {
      const row = { date: s.date, label: format(new Date(s.date), 'd MMM yy', { locale: it }) };
      for (const g of coalitionGroups) {
        const names = g.party_names || [];
        let sum = 0, found = false;
        for (const r of s.rows) {
          const partyName = (r.party || '').split('\n')[0].trim();
          if (names.includes(partyName)) { sum += r.percentage; found = true; }
        }
        if (found) row[g.label] = +sum.toFixed(1);
      }
      return row;
    });
  }, [scope, coalitionGroups, surveys]);

  const renderCoalitionDot = (color) => (props) => {
    const { cx, cy, index } = props;
    if (cx == null || cy == null) return null;
    return <circle key={`cdot-${index}`} cx={cx} cy={cy} r={isMobile ? 3 : 4} fill={color} />;
  };

  const wrapPartyName = (name, maxChars) => {
    if (!name) return [''];
    if (name.includes('\n')) return name.split('\n');
    if (name.length <= maxChars) return [name];
    const mid = Math.floor(name.length / 2);
    let splitAt = name.lastIndexOf(' ', mid);
    if (splitAt <= 0) splitAt = name.indexOf(' ', mid);
    if (splitAt <= 0) return [name];
    return [name.slice(0, splitAt), name.slice(splitAt + 1)];
  };

  const yAxisWidth = isMobile ? 150 : 260;
  const renderPartyTick = (props) => {
    const { x, y, payload } = props;
    const entry = latestChartData.find((d) => d.party === payload.value);
    const logo = entry?.logo_url;
    const logoR = isMobile ? 13 : 20;
    const leftEdge = -(yAxisWidth - (isMobile ? 12 : 16));
    const logoCx = leftEdge + logoR;
    const fontSize = isMobile ? 12.5 : 14;
    const textX = logo ? logoCx + logoR + (isMobile ? 8 : 10) : leftEdge;
    const lines = wrapPartyName(payload.value, isMobile ? 15 : 24);
    return (
      <g transform={`translate(${x},${y})`}>
        {logo &&
        <>
            <clipPath id={`logo-clip-${payload.index}`}>
              <circle cx={logoCx} cy={0} r={logoR} />
            </clipPath>
            <image href={logo} x={logoCx - logoR} y={-logoR} width={logoR * 2} height={logoR * 2} clipPath={`url(#logo-clip-${payload.index})`} preserveAspectRatio="xMidYMid slice" />
          </>
        }
        <text x={textX} y={0} textAnchor="start" fontSize={fontSize} fontWeight={500} fill="hsl(var(--foreground))">
          {lines.map((line, i) => <tspan key={i} x={textX} dy={i === 0 ? (lines.length > 1 ? -3 : 4) : 13}>{line}</tspan>)}
        </text>
      </g>);

  };

  const partiesOrdered = useMemo(() => {
    if (!parties.length) return [];
    const lastRow = trendData[trendData.length - 1] || {};
    return [...parties].sort((a, b) => (lastRow[b] ?? -1) - (lastRow[a] ?? -1));
  }, [parties, trendData]);

  const renderLineDot = (color) => (props) => {
    const { cx, cy, index } = props;
    if (cx == null || cy == null) return null;
    return <circle key={`dot-${index}`} cx={cx} cy={cy} r={isMobile ? 3 : 4} fill={color} />;
  };

  const { data: siteContent } = useSiteContent();
  const { config: ux } = useUxConfig();
  const cardStyle = ux.team_cards_bg_color ? { backgroundColor: ux.team_cards_bg_color } : undefined;

  useSEO({
    title: `${SCOPE_LABELS[scope] || 'Sondaggi'} — GD Madonie News`,
    description: 'Rilevazioni sulle intenzioni di voto, nazionali e regionali, aggiornate dal circolo dei Giovani Democratici Madonie.',
    url: typeof window !== 'undefined' ? window.location.href : undefined
  });

  useJsonLd(latest ? {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: `${SCOPE_LABELS[scope] || 'Sondaggi'} — rilevazione del ${latest.date}`,
    description: `Sondaggio politico ${SCOPE_LABELS[scope] || ''}${latest.institute ? ' a cura di ' + latest.institute : ''}, del ${latest.date}.`,
    creator: latest.institute ? { '@type': 'Organization', name: latest.institute } : undefined,
    datePublished: latest.date,
    publisher: { '@type': 'Organization', name: 'GD Madonie News' },
    variableMeasured: (latestChartData || []).map((d) => ({
      '@type': 'PropertyValue',
      name: d.party.replace('\n', ' '),
      value: d.percentage,
      unitText: 'percentuale'
    }))
  } : null);
  const [shareChoiceOpen, setShareChoiceOpen] = useState(false);
  const [sharingPoll, setSharingPoll] = useState(false);
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/sondaggi` : '';
  const shareLinkUrl = typeof window !== 'undefined' ? `${window.location.origin}/functions/shareSondaggi?scope=${scope}` : shareUrl;

  const generatePollImage = async (imgFormat) => {
    const pollCfg = { brand_title: 'Madonie News', brand_subtitle: 'Giovani Democratici Madonie', logo_url: '', logo_size: 140, background_color: '#f5f5f5', title_color: '', category_bg_color: '#ffffff', category_text_color: '#0F1B3A', domain_text: 'gdmadonie-news.com', show_category: true, show_domain: true, top_band_enabled: false, top_band_color: '#000000', top_band_opacity: 0.35, category_gap: 28 };
    try {
      const cfgs = await sb44.entities.StoryShareConfig.filter({ key: 'poll_share' }, '-updated_date', 1);
      if (cfgs?.[0]) Object.assign(pollCfg, cfgs[0]);
    } catch {}
    const subtitle = [
    format(new Date(latest.date), 'd MMMM yyyy', { locale: it }),
    latest.institute,
    latest.turnout ? `affluenza ${latest.turnout}` : null,
    latest.undecided ? `non si esprime ${latest.undecided}` : null].
    filter(Boolean).join(' · ');
    const blob = await buildPollChartBlob({
      format: imgFormat,
      category: SCOPE_LABELS[scope] || 'Sondaggi',
      subtitle,
      items: latestChartData,
      domain: pollCfg.domain_text || getContent(siteContent, 'site_domain') || 'gdmadonie-news.com',
      primaryColor: pollCfg.background_color || '#f5f5f5',
      logoUrl: pollCfg.logo_url || getContent(siteContent, 'site_logo_url'),
      brandTitle: pollCfg.brand_title,
      brandSubtitle: pollCfg.brand_subtitle,
      bgGradientStart: pollCfg.background_color || '#f5f5f5',
      bgGradientEnd: pollCfg.background_color || '#f5f5f5',
      categoryBg: pollCfg.category_bg_color,
      categoryText: pollCfg.category_text_color,
      titleColor: pollCfg.title_color || undefined,
      logoSize: pollCfg.logo_size,
      showCategory: pollCfg.show_category,
      showDomain: pollCfg.show_domain,
      topBandEnabled: pollCfg.top_band_enabled,
      topBandColor: pollCfg.top_band_color,
      topBandOpacity: pollCfg.top_band_opacity,
      categoryGap: pollCfg.category_gap
    });
    const file = new File([blob], 'sondaggio.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Sondaggi politici' });
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sondaggio-gdmadonie.png';
      a.click();
      URL.revokeObjectURL(url);
      alert('Immagine scaricata e link copiato: aprila in Instagram/Facebook/WhatsApp.');
    }
  };

  const shareStory = () => {
    if (!latest || sharingPoll) return;
    setShareChoiceOpen(true);
  };

  const pickShareChoice = async (imgFormat) => {
    setShareChoiceOpen(false);
    setSharingPoll(true);
    try {await navigator.clipboard?.writeText(shareLinkUrl);} catch {}
    try {
      await generatePollImage(imgFormat);
    } catch {
      try {
        await generatePollImage(imgFormat);
      } catch {
        alert('Non sono riuscito a preparare la condivisione. Riprova.');
      }
    }
    setSharingPoll(false);
  };

  const shareWa = `https://wa.me/?text=${encodeURIComponent('Sondaggi politici · ' + shareLinkUrl)}`;
  const shareFb = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareLinkUrl)}`;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-serif font-bold text-foreground">Sondaggi politici</h1>
        <p className="text-sm text-muted-foreground mt-1">Rilevazioni sulle intenzioni di voto, nazionali e regionali.</p>
      </div>

      <div className="flex bg-muted rounded-full p-1 text-sm font-medium w-fit flex-wrap gap-1">
        <button onClick={() => setScope('nazionale')} className={`px-4 py-2 rounded-full transition-all border ${scope === 'nazionale' ? 'bg-card shadow-sm text-foreground border-transparent scale-[1.04]' : 'text-muted-foreground border-border/50'}`}>Nazionale</button>
        <button onClick={() => setScope('regionale')} className={`px-4 py-2 rounded-full transition-all border ${scope === 'regionale' ? 'bg-card shadow-sm text-foreground border-transparent scale-[1.04]' : 'text-muted-foreground border-border/50'}`}>Regionale (liste)</button>
        <button onClick={() => setScope('candidati_sicilia')} className={`px-4 py-2 rounded-full transition-all border ${scope === 'candidati_sicilia' ? 'bg-card shadow-sm text-foreground border-transparent scale-[1.04]' : 'text-muted-foreground border-border/50'}`}>Intenzioni di voto regionali siciliane - candidati</button>
      </div>

      {isLoading ?
      <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div> :
      !latest ?
      <p className="text-sm text-muted-foreground py-8 text-center">Nessun sondaggio {scope} ancora inserito.</p> :

      <>
          <div style={cardStyle} className={`relative overflow-hidden border border-border rounded-2xl p-5 space-y-4 ${cardStyle ? '' : 'bg-card'}`}>
            <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/10 to-transparent" />
            <div>
              <h2 className="text-base font-semibold text-foreground">Ultima rilevazione</h2>
              <p className="text-xs text-muted-foreground">
                {format(new Date(latest.date), 'd MMMM yyyy', { locale: it })}
                {latest.institute ? ` · ${latest.institute}` : ''}
                {latest.turnout ? ` · affluenza stimata ${latest.turnout}` : ''}
                {latest.undecided ? ` · non si esprime ${latest.undecided}` : ''}
              </p>
              {previous &&
            <p className="text-xs font-medium text-foreground">Variazione rispetto al sondaggio del {format(new Date(previous.date), 'd MMMM yyyy', { locale: it })}{previous.institute ? ` (${previous.institute})` : ''}:</p>
            }
            </div>
            <div ref={mainChartRef} style={{ width: '100%', height: Math.max(isMobile ? 240 : 260, latestChartData.length * (isMobile ? 54 : 64)) }}>
              <ResponsiveContainer>
                <BarChart data={mainChartInView ? latestChartData : []} layout="vertical" margin={{ left: isMobile ? 0 : 8, right: isMobile ? 20 : 40, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" domain={[0, 'dataMax + 5']} tickFormatter={(v) => `${v}%`} tick={{ fontSize: isMobile ? 10 : 13 }} />
                  <YAxis type="category" dataKey="party" width={yAxisWidth} tick={renderPartyTick} />
                  <Bar dataKey="percentage" radius={[0, 6, 6, 0]} barSize={isMobile ? 22 : 36}>
                    {latestChartData.map((d, i) => <Cell key={i} fill={d.color || colorFor(d.party, i)} />)}
                    <LabelList
                    dataKey="percentage"
                    position="right"
                    formatter={(v) => `${v}%`}
                    style={{ fill: 'hsl(var(--foreground))', fontSize: isMobile ? 11 : 15, fontWeight: 700 }} />

                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {previous &&
          <div className="space-y-2 pt-2 border-t border-border">
                {latestChartData.map((d) =>
            <div key={d.party} className="flex items-center justify-between text-base px-1">
                    <span className="flex items-center gap-2.5 text-foreground font-medium">
                      {d.logo_url && <img src={d.logo_url} alt="" className="w-8 h-8 sm:w-11 sm:h-11 rounded-full object-cover shrink-0" />}
                      {d.party.replace('\n', ' ')}
                    </span>
                    <span className={`flex items-center gap-1 font-semibold text-base ${d.delta > 0 ? 'text-emerald-600' : d.delta < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                      {d.delta == null ? '—' :
                d.delta > 0 ? <ArrowUp className="w-4 h-4" /> :
                d.delta < 0 ? <ArrowDown className="w-4 h-4" /> :
                <Minus className="w-4 h-4" />}
                      {d.delta != null && `${d.delta > 0 ? '+' : ''}${d.delta} pt`}
                    </span>
                  </div>
            )}
              </div>
          }
          </div>

          {ADS_ENABLED && <AdSlot slot="6403185298" />}

          {coalitionTotals.length > 0 &&
        <div style={cardStyle} className={`relative overflow-hidden border border-border rounded-2xl p-5 space-y-4 ${cardStyle ? '' : 'bg-card'}`}>
              <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/10 to-transparent" />
              <div>
                <h2 className="relative text-base font-semibold text-foreground">Coalizioni</h2>
                <p className="relative text-xs text-muted-foreground">Somma dei partiti di ciascun gruppo, ultima rilevazione.</p>
              </div>
              <div ref={coalitionChartRef} style={{ width: '100%', height: Math.max(isMobile ? 160 : 180, coalitionTotals.length * (isMobile ? 56 : 64)) }}>
                <ResponsiveContainer>
                  <BarChart data={coalitionChartInView ? coalitionTotals : []} layout="vertical" margin={{ left: isMobile ? 0 : 8, right: isMobile ? 44 : 60, top: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                    <XAxis type="number" domain={[0, 'dataMax + 5']} tickFormatter={(v) => `${v}%`} tick={{ fontSize: isMobile ? 10 : 13 }} />
                    <YAxis type="category" dataKey="label" width={isMobile ? 130 : 190} tick={{ fontSize: isMobile ? 11.5 : 14, fontWeight: 500, fill: 'hsl(var(--foreground))' }} />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={isMobile ? 26 : 38}>
                      {coalitionTotals.map((g, i) => <Cell key={i} fill={g.color} />)}
                      <LabelList
                      dataKey="value"
                      position="right"
                      formatter={(v) => `${v}%`}
                      style={{ fill: 'hsl(var(--foreground))', fontSize: isMobile ? 12 : 15, fontWeight: 700 }} />

                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="relative grid sm:grid-cols-2 gap-2 pt-2 border-t border-border">
                {coalitionTotals.map((g) =>
            <div key={g.key} className="flex items-center justify-between gap-2 px-1">
                    <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: g.color }} />
                      {g.label}
                    </span>
                    {g.delta != null &&
              <span className={`flex items-center gap-0.5 text-xs font-semibold shrink-0 ${g.delta > 0 ? 'text-emerald-600' : g.delta < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                        {g.delta > 0 ? <ArrowUp className="w-3.5 h-3.5" /> : g.delta < 0 ? <ArrowDown className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
                        {g.delta > 0 ? '+' : ''}{g.delta} pt
                      </span>
              }
                  </div>
            )}
              </div>
            </div>
        }

          {coalitionTrendData.length > 1 && coalitionGroups?.length > 0 &&
        <div style={cardStyle} className={`relative overflow-hidden border border-border rounded-2xl p-5 space-y-5 ${cardStyle ? '' : 'bg-card'}`}>
              <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/10 to-transparent" />
              <div>
                <h2 className="text-base font-semibold text-foreground">Coalizioni nel tempo</h2>
                <p className="text-xs text-muted-foreground">Stesso andamento, sommato per coalizione invece che per singolo partito.</p>
              </div>
              <div style={{ width: '100%', height: isMobile ? 260 : 340 }}>
                <ResponsiveContainer>
                  <LineChart data={coalitionTrendData} margin={{ left: isMobile ? 0 : -8, right: isMobile ? 24 : 40, top: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: isMobile ? 9 : 13 }} interval={isMobile ? 'preserveStartEnd' : 0} />
                    <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: isMobile ? 10 : 13 }} width={isMobile ? 46 : 44} />
                    {coalitionGroups.map((g) =>
                <Line key={g.id} type="monotone" dataKey={g.label} stroke={g.color || '#0F1B3A'} strokeWidth={isMobile ? 2 : 3} dot={renderCoalitionDot(g.color || '#0F1B3A')} activeDot={false} connectNulls />
                )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="grid sm:grid-cols-2 gap-x-4 gap-y-2 pt-2 border-t border-border">
                {coalitionGroups.map((g) =>
            <div key={g.id} className="flex items-center gap-2.5 text-sm">
                    <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: g.color || '#0F1B3A' }} />
                    <span className="text-foreground font-medium truncate">{g.label}</span>
                  </div>
            )}
              </div>
            </div>
        }

          {surveys.length > 1 &&
        <div style={cardStyle} className={`relative overflow-hidden border border-border rounded-2xl p-5 space-y-5 ${cardStyle ? '' : 'bg-card'}`}>
              <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/10 to-transparent" />
              <div>
                <h2 className="text-base font-semibold text-foreground">Andamento nel tempo</h2>
                <p className="text-xs text-muted-foreground">{surveys.length} sondaggi raccolti, dal {format(new Date(surveys[0].date), 'd MMMM yyyy', { locale: it })} a oggi.</p>
              </div>
              <div style={{ width: '100%', height: isMobile ? 340 : 460 }}>
                <ResponsiveContainer>
                  <LineChart data={trendData} margin={{ left: isMobile ? 0 : -8, right: isMobile ? 24 : 40, top: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: isMobile ? 9 : 13 }} interval={isMobile ? 'preserveStartEnd' : 0} />
                    <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: isMobile ? 10 : 13 }} width={isMobile ? 46 : 44} />
                    {partiesOrdered.map((party, i) =>
                <Line key={party} type="monotone" dataKey={party} stroke={colorFor(party, i)} strokeWidth={isMobile ? 2 : 3} dot={renderLineDot(colorFor(party, i))} activeDot={false} connectNulls />
                )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="grid sm:grid-cols-2 gap-x-4 gap-y-2.5 pt-2 border-t border-border">
                {partiesOrdered.map((party, i) =>
            <div key={party} className="flex items-center gap-2.5 text-sm">
                    {logoFor(party) ?
              <img src={logoFor(party)} alt="" className="w-6 h-6 rounded-full object-cover shrink-0 border" style={{ borderColor: colorFor(party, i) }} /> :

              <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: colorFor(party, i) }} />
              }
                    <span className="text-foreground font-medium truncate">{party.replace('\n', ' ')}</span>
                  </div>
            )}
              </div>
            </div>
        }
        </>
      }

      {latest &&
      <div className="flex items-center gap-2 flex-wrap pt-2">
          <span className="text-xs text-muted-foreground mr-1 flex items-center gap-1"><Share2 className="w-3.5 h-3.5" /> Condividi:</span>
          <a href={shareWa} target="_blank" rel="noopener noreferrer" className="text-xs font-medium bg-[#25D366] text-white px-3 py-2.5 min-h-[44px] rounded-lg flex items-center">WhatsApp</a>
          <a href={shareFb} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-white px-3 py-2.5 min-h-[44px] rounded-lg flex items-center" style={{ backgroundColor: '#1877F2' }}>Facebook</a>
          <button onClick={shareStory} disabled={sharingPoll} className="text-xs font-medium text-white px-3 py-2.5 min-h-[44px] rounded-lg flex items-center gap-1.5 disabled:opacity-60 bg-gradient-to-tr from-[#f58529] via-[#dd2a7b] to-[#8134af]">
            {sharingPoll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Instagram className="w-3.5 h-3.5" />} Condividi
          </button>
        </div>
      }

      <Dialog open={shareChoiceOpen} onOpenChange={setShareChoiceOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Come vuoi condividere?</DialogTitle>
            <DialogDescription>Scegli il formato più adatto a dove la pubblichi.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <button onClick={() => pickShareChoice('story')} className="w-full flex items-start gap-3 text-left p-4 rounded-xl border border-border hover:bg-muted transition-colors">
              <ImageIcon className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <span>
                <span className="block font-semibold text-foreground">Immagine per le Storie</span>
                <span className="block text-xs text-muted-foreground mt-0.5">Verticale e stretta, formato Storie Instagram/Facebook/WhatsApp</span>
              </span>
            </button>
            <button onClick={() => pickShareChoice('post')} className="w-full flex items-start gap-3 text-left p-4 rounded-xl border border-border hover:bg-muted transition-colors">
              <ImageIcon className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <span>
                <span className="block font-semibold text-foreground">Immagine per il Feed</span>
                <span className="block text-xs text-muted-foreground mt-0.5">Più quadrata, pensata per un post normale</span>
              </span>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>);

}
