import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { sb44 } from '@/api/supabaseEntities';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { Loader2, Instagram, Image as ImageIcon, Share2 } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { useSiteContent } from '@/lib/useSiteContent';
import { getContent } from '@/lib/siteContent';
import { buildPollChartBlob } from '@/lib/storyImage';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useSEO } from '@/lib/useSEO';
import { useJsonLd } from '@/lib/useJsonLd';
import AdSlot from '@/components/AdSlot';
import { ADS_ENABLED } from '@/lib/adsConfig';

const SCOPE_LABELS = {
  nazionale: 'Sondaggi Nazionali',
  regionale: 'Sondaggi Regionali (liste)',
  candidati_sicilia: 'Intenzioni di voto regionali siciliane - candidati'
};

const FALLBACK_COLORS = ['#0F1B3A', '#2F5BD8', '#0ea5e9', '#16a34a', '#a8262c', '#7c3aed', '#ca8a04', '#0d9488'];

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
  const { data: entries, isLoading } = useQuery({
    queryKey: ['poll-entries', scope],
    queryFn: () => sb44.entities.PollEntry.filter({ scope }, 'survey_date', 1000),
    staleTime: 5 * 60 * 1000
  });

  const [openCoal, setOpenCoal] = useState(null);
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
      const members = (latest.rows || []).
      map((r) => ({ name: (r.party || '').split('\n')[0].trim(), pct: r.percentage })).
      filter((m) => names.includes(m.name)).
      sort((a, b) => b.pct - a.pct);
      const missing = names.filter((n) => !members.some((m) => m.name === n));
      return { key: g.id, label: g.label, color: g.color || '#0F1B3A', value, delta, members, missing };
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

  const buildPollFile = async (imgFormat) => {
    const pollCfg = { brand_title: 'GD Madonie News', brand_subtitle: 'Giovani Democratici Madonie', logo_url: '', logo_size: 140, background_color: '#F4F6FD', title_color: '', category_bg_color: '#2F5BD8', category_text_color: '#FFFFFF', domain_text: 'gdmadonie-news.com', show_category: true, show_domain: true, top_band_enabled: false, top_band_color: '#000000', top_band_opacity: 0.35, category_gap: 28 };
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
      logoUrl: null,
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
    let out = blob;
    try {
      const bmp = await createImageBitmap(blob);
      const c = document.createElement('canvas');
      c.width = bmp.width; c.height = bmp.height;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#F4F6FD'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(bmp, 0, 0);
      const jpg = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.92));
      if (jpg) out = jpg;
    } catch {}
    return new File([out], `sondaggio-${imgFormat}.${out.type === 'image/jpeg' ? 'jpg' : 'png'}`, { type: out.type || 'image/png' });
  };

  // File pronti prima del tocco: navigator.share() deve partire subito.
  const [preparedPoll, setPreparedPoll] = useState({});
  const [pollShareMsg, setPollShareMsg] = useState('');
  useEffect(() => {
    if (!shareChoiceOpen || !latest) return;
    let cancelled = false;
    setPreparedPoll({}); setPollShareMsg('');
    ['story', 'post'].forEach(async (key) => {
      for (let i = 0; i < 2; i++) {
        try { const f = await buildPollFile(key); if (!cancelled) setPreparedPoll((p) => ({ ...p, [key]: f })); return; }
        catch { await new Promise((r) => setTimeout(r, 400)); }
      }
      if (!cancelled) setPollShareMsg('Non riesco a preparare l\'immagine. Riprova tra poco.');
    });
    return () => { cancelled = true; };
  }, [shareChoiceOpen, scope, latest?.id]);

  const shareStory = () => {
    if (!latest || sharingPoll) return;
    setShareChoiceOpen(true);
  };

  const downloadPoll = (file) => {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url; a.download = file.name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    setPollShareMsg('Immagine scaricata e link copiato: aprila in Instagram, Facebook o WhatsApp.');
  };

  const pickShareChoice = (imgFormat) => {
    const file = preparedPoll[imgFormat];
    if (!file) return;
    try { navigator.clipboard?.writeText(shareLinkUrl).catch(() => {}); } catch {}
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file] }).
      then(() => setShareChoiceOpen(false)).
      catch((e) => { if (e?.name !== 'AbortError') setPollShareMsg('Non è stato possibile aprire la condivisione. Usa "Scarica".'); });
    } else {
      downloadPoll(file);
    }
  };

  const shareWa = `https://wa.me/?text=${encodeURIComponent('Sondaggi politici · ' + shareLinkUrl)}`;
  const shareFb = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareLinkUrl)}`;

  const pctTxt = (n) => `${Number(n).toFixed(1).replace('.', ',')}%`;
  const Delta = ({ d }) => {
    if (d == null) return <span className="delta flat">—</span>;
    const c = d > 0 ? 'up' : d < 0 ? 'down' : 'flat';
    const ar = d > 0 ? '▲' : d < 0 ? '▼' : '—';
    return <span className={`delta ${c}`}>{ar} {d > 0 ? '+' : ''}{d.toFixed(1).replace('.', ',')}</span>;
  };
  const maxPct = latestChartData.length ? Math.max(...latestChartData.map((d) => d.percentage)) : 1;
  const scopeTabs = [['nazionale', 'Nazionale'], ['regionale', 'Regionale (liste)'], ['candidati_sicilia', 'Candidati Sicilia']];

  return (
    <div className="rd-page">
      <div className="page-head"><div className="hero-glow" /><div className="wrap-wide">
        <span className="section-kicker">Intenzioni di voto</span>
        <h1>SONDAGGI<br />POLITICI</h1>
        <p>Le ultime rilevazioni nazionali e regionali, con variazioni e andamento nel tempo.</p>
        <div className="tabs">
          {scopeTabs.map(([k, l]) => <button key={k} onClick={() => setScope(k)} className={`tab ${scope === k ? 'active' : ''}`}>{l}</button>)}
        </div>
      </div></div>

      <div className="wrap-wide sond-body">
        {isLoading ?
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}><Loader2 className="w-6 h-6 animate-spin" style={{ opacity: .5 }} /></div> :
        !latest ?
        <p style={{ textAlign: 'center', padding: '32px 0', opacity: .6 }}>Nessun sondaggio {scope} ancora inserito.</p> :
        <>
            {coalitionTotals.length > 0 &&
          <div className="coal-tiles">
                {coalitionTotals.map((c) =>
            <button type="button" key={c.key} className="coal-tile" onClick={() => setOpenCoal(c)} aria-label={`Vedi i partiti di ${c.label}`} style={{ '--c': c.color === '#0F2A5C' || c.color === '#0F1B3A' ? '#2F5BD8' : c.color }}>
                    <span className="coal-name">{c.label}</span>
                    <span className="coal-pct">{pctTxt(c.value)}</span>
                    <span style={{ textAlign: 'left', display: 'block' }}><Delta d={c.delta} /></span>
                    <span className="coal-more">Vedi i partiti →</span>
                  </button>
            )}
              </div>}
            <Dialog open={!!openCoal} onOpenChange={(o) => { if (!o) setOpenCoal(null); }}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{openCoal?.label}</DialogTitle>
                  <DialogDescription>Partiti che ne fanno parte · totale {openCoal ? pctTxt(openCoal.value) : ''}</DialogDescription>
                </DialogHeader>
                <div className="coal-members">
                  {openCoal?.members.map((m) => <div key={m.name} className="coal-member"><b>{m.name}</b><span>{pctTxt(m.pct)}</span></div>)}
                  {openCoal?.missing.map((n) => <div key={n} className="coal-member" style={{ opacity: .55 }}><b>{n}</b><span>n.d.</span></div>)}
                </div>
              </DialogContent>
            </Dialog>

            <div className="sond-grid">
              <div>
                <div className="sondaggi-card">
                  <h2>Ultima rilevazione</h2>
                  <div className="card-meta">
                    {format(new Date(latest.date), 'd MMMM yyyy', { locale: it })}
                    {latest.institute ? ` · ${latest.institute}` : ''}
                    {latest.turnout ? ` · affluenza stimata ${latest.turnout}` : ''}
                    {latest.undecided ? ` · non si esprime ${latest.undecided}` : ''}
                  </div>
                  {latestChartData.map((d, i) =>
                <div className="poll-item" key={d.party}>
                      <div className="poll-row">
                        {d.logo_url ? <img src={d.logo_url} alt="" style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover' }} /> : <span className="poll-dot" style={{ background: d.color || colorFor(d.party, i) }} />}
                        <span className="poll-party">{d.party.replace('\n', ' ')}</span>
                        <span className="poll-pct">{pctTxt(d.percentage)}</span>
                        {previous && <Delta d={d.delta} />}
                      </div>
                      <div className="poll-track"><div className="poll-fill" style={{ width: `${d.percentage / maxPct * 100}%`, background: d.color || colorFor(d.party, i) }} /></div>
                    </div>
                )}
                </div>
                {ADS_ENABLED && <AdSlot slot="6403185298" />}
              </div>

              <div>
                {coalitionTrendData.length > 1 && coalitionGroups?.length > 0 &&
              <div className="sondaggi-card">
                    <h2>Coalizioni nel tempo</h2>
                    <div className="card-meta">Andamento, somma dei partiti di ciascuna coalizione</div>
                    <div style={{ width: '100%', height: isMobile ? 240 : 300 }}>
                      <ResponsiveContainer>
                        <LineChart data={coalitionTrendData} margin={{ left: isMobile ? 0 : -8, right: isMobile ? 16 : 24, top: 8, bottom: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(28,34,51,.1)" />
                          <XAxis dataKey="label" tick={{ fontSize: isMobile ? 9 : 12 }} interval={isMobile ? 'preserveStartEnd' : 0} />
                          <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: isMobile ? 10 : 12 }} width={isMobile ? 46 : 44} />
                          {coalitionGroups.map((g) => <Line key={g.id} type="monotone" dataKey={g.label} stroke={g.color || '#0F1B3A'} strokeWidth={isMobile ? 2 : 3} dot={renderCoalitionDot(g.color || '#0F1B3A')} activeDot={false} connectNulls />)}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="trend-legend">{coalitionGroups.map((g) => <span key={g.id}><i style={{ background: g.color || '#0F1B3A' }} />{g.label}</span>)}</div>
                  </div>}

                {surveys.length > 1 &&
              <div className="sondaggi-card">
                    <h2>Andamento nel tempo</h2>
                    <div className="card-meta">{surveys.length} sondaggi raccolti, dal {format(new Date(surveys[0].date), 'd MMMM yyyy', { locale: it })} a oggi.</div>
                    <div style={{ width: '100%', height: isMobile ? 300 : 380 }}>
                      <ResponsiveContainer>
                        <LineChart data={trendData} margin={{ left: isMobile ? 0 : -8, right: isMobile ? 16 : 24, top: 8, bottom: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(28,34,51,.1)" />
                          <XAxis dataKey="label" tick={{ fontSize: isMobile ? 9 : 12 }} interval={isMobile ? 'preserveStartEnd' : 0} />
                          <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: isMobile ? 10 : 12 }} width={isMobile ? 46 : 44} />
                          {partiesOrdered.map((party, i) => <Line key={party} type="monotone" dataKey={party} stroke={colorFor(party, i)} strokeWidth={isMobile ? 2 : 3} dot={renderLineDot(colorFor(party, i))} activeDot={false} connectNulls />)}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="trend-legend">{partiesOrdered.map((party, i) => <span key={party}><i style={{ background: colorFor(party, i) }} />{party.replace('\n', ' ')}</span>)}</div>
                  </div>}

                <div className="sondaggi-card">
                  <h2>Scheda rilevazione</h2>
                  <div className="card-meta">Dettagli</div>
                  <div className="info-list">
                    <div><b>Istituto</b><span>{latest.institute || '—'}</span></div>
                    <div><b>Data</b><span>{format(new Date(latest.date), 'd MMMM yyyy', { locale: it })}</span></div>
                    {previous && <div><b>Confronto con</b><span>{format(new Date(previous.date), 'd MMMM yyyy', { locale: it })}</span></div>}
                    <div><b>Ambito</b><span>{SCOPE_LABELS[scope]}</span></div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', paddingTop: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, opacity: .6, display: 'flex', alignItems: 'center', gap: 6 }}><Share2 size={14} /> Condividi:</span>
              <a href={shareWa} target="_blank" rel="noopener noreferrer" className="share-btn">WhatsApp</a>
              <button onClick={shareStory} className="share-btn share-primary"><Instagram size={16} /> Storie e Post</button>
            </div>
          </>}
      </div>

      <Dialog open={shareChoiceOpen} onOpenChange={(o) => { setShareChoiceOpen(o); if (!o) setPollShareMsg(''); }}>
        <DialogContent className="max-w-sm share-dialog">
          <DialogHeader>
            <DialogTitle>Condividi il sondaggio</DialogTitle>
            <DialogDescription>Scegli il formato: si apre la condivisione del telefono, poi scegli Instagram, Facebook o WhatsApp.</DialogDescription>
          </DialogHeader>
          <div className="share-options">
            {[['story', 'Immagine per le Storie', 'Verticale 9:16, per Storie Instagram, Facebook e WhatsApp'], ['post', 'Immagine per il Feed', 'Più quadrata 4:5, per un post normale']].map(([key, title, desc]) =>
            <button key={key} onClick={() => pickShareChoice(key)} disabled={!preparedPoll[key]} className="share-option">
              <span className="share-ico">{preparedPoll[key] ? <ImageIcon className="w-5 h-5" /> : <Loader2 className="w-5 h-5 animate-spin" />}</span>
              <span><b>{title}</b><small>{preparedPoll[key] ? desc : 'Preparo il file…'}</small></span>
            </button>
            )}
            {pollShareMsg && <p className="share-msg">{pollShareMsg}</p>}
            {(preparedPoll.story || preparedPoll.post) && !pollShareMsg && <button className="share-dl" onClick={() => downloadPoll(preparedPoll.story || preparedPoll.post)}>Oppure scarica l'immagine</button>}
          </div>
        </DialogContent>
      </Dialog>
    </div>);

}
