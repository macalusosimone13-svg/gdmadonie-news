import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, RefreshCw, ExternalLink, Check, X, Wand2, Upload, Link2 } from 'lucide-react';
import { uploadFile } from '@/lib/uploadFile';
import { fmtData, iniziali, kDaSlug, linkAtto, linkLegge, slugDeputato } from '@/lib/ars';

// Sezione ARS: tutto si aggiorna da solo (GitHub Actions ogni 30 minuti +
// funzioni Supabase). Da qui la redazione:
//  1) vede se l'aggiornamento automatico sta funzionando;
//  2) rilegge e pubblica le schede delle leggi preparate dall'IA (bozze);
//  3) aggiunge le foto dei deputati (le carica la redazione: l'aggiornamento automatico non le tocca);
//  4) corregge un atto (titolo o paesi sbagliati): la correzione resta anche
//     quando l'atto viene riletto dal sito dell'ARS, e resta scritta nello storico.
// Le segnalazioni dei lettori ("Segnala un errore") arrivano in "Richieste dal sito".

export default function ArsPanel() {
  return (
    <div className="space-y-5">
      <Stato />
      <Schede />
      <FotoDeputati />
      <Correggi />
    </div>);
}

function Box({ titolo, children, desc }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
      <div>
        <h3 className="font-semibold text-foreground">{titolo}</h3>
        {desc && <p className="text-sm text-muted-foreground mt-1">{desc}</p>}
      </div>
      {children}
    </div>);
}

function Stato() {
  const [s, setS] = useState(null);
  useEffect(() => {
    supabase.from('ars_meta').select('valore, updated_at').eq('chiave', 'ultimo_controllo').maybeSingle().then(({ data }) => setS(data?.valore || null));
  }, []);
  const ore = s?.at ? (Date.now() - new Date(s.at).getTime()) / 3600_000 : null;
  return (
    <Box titolo="Aggiornamento automatico" desc="Ogni 30 minuti il sito legge le novità dal sito dell'ARS: sedute, ordini del giorno, resoconti, commissioni e deputati.">
      {!s ? <p className="text-sm text-muted-foreground">Nessun controllo registrato.</p> :
        <div className="text-sm space-y-1">
          <p className={ore > 3 ? 'text-amber-700 font-semibold' : 'text-emerald-700 font-semibold'}>
            Ultimo controllo: {new Date(s.at).toLocaleString('it-IT', { timeZone: 'Europe/Rome', dateStyle: 'short', timeStyle: 'short' })}
            {ore > 3 ? ' — più di 3 ore fa: controlla il registro attività' : ' — tutto regolare'}
          </p>
          {s.conteggi && <p className="text-muted-foreground">In archivio: {s.conteggi.atti} atti, {s.conteggi.leggi} leggi, {s.conteggi.risposte} risposte del Governo, {s.conteggi.sedute} sedute, {s.conteggi.convocazioni} riunioni di commissione.</p>}
          {s.errori?.length > 0 && <p className="text-red-700">Ultimi errori: {s.errori.slice(0, 3).join(' · ')}</p>}
        </div>}
    </Box>);
}

function Schede() {
  const [leggi, setLeggi] = useState(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [aperta, setAperta] = useState(null);
  const carica = async () => {
    const [{ data }, { data: conTesto }] = await Promise.all([
      supabase.from('ars_leggi').select('id, ddl, titolo, titolo_breve, data, extra').eq('approvata', true).is('unita_a', null).order('data', { ascending: false }),
      supabase.from('ars_leggi').select('id').not('testo', 'is', null),
    ]);
    const t = new Set((conTesto || []).map((x) => x.id));
    setLeggi((data || []).map((l) => ({ ...l, haTesto: t.has(l.id) })));
  };
  useEffect(() => { carica(); }, []);
  const prepara = async (id) => {
    setBusy(id); setMsg('');
    const { data, error } = await supabase.functions.invoke('ars-scheda', { body: { legge: id } });
    if (error || data?.error) setMsg(data?.error || 'Non riuscito, riprova tra poco.');
    else { setMsg('Bozza pronta: rileggila qui sotto.'); setAperta(id); }
    await carica(); setBusy('');
  };
  const decidi = async (id, azione, bozza) => {
    setBusy(id); setMsg('');
    const { data, error } = await supabase.rpc('ars_scheda_decidi', { p_id: id, p_azione: azione, p_bozza: bozza || null });
    if (error || !data?.ok) setMsg(data?.error || error?.message || 'Non riuscito.');
    else setMsg(azione === 'pubblica' ? 'Pubblicata sul sito.' : 'Bozza scartata.');
    await carica(); setBusy(''); setAperta(null);
  };
  if (!leggi) return <Box titolo="Schede delle leggi"><Loader2 className="w-5 h-5 animate-spin" /></Box>;
  const bozze = leggi.filter((l) => l.extra?.bozza);
  const senza = leggi.filter((l) => !l.extra?.bozza && !l.extra?.scheda && !l.extra?.breve);
  return (
    <Box titolo={`Schede delle leggi${bozze.length ? ` · ${bozze.length} da rileggere` : ''}`} desc="Per ogni legge approvata l'IA prepara una spiegazione semplice dal testo del disegno di legge. Sul sito esce solo dopo che la pubblichi da qui. Puoi correggere i testi prima di pubblicare.">
      {msg && <p className="text-sm font-medium text-primary">{msg}</p>}
      {bozze.length === 0 && <p className="text-sm text-muted-foreground">Nessuna bozza da rileggere.</p>}
      {bozze.map((l) => <Bozza key={l.id} l={l} aperta={aperta === l.id} apri={() => setAperta(aperta === l.id ? null : l.id)} busy={busy === l.id} decidi={decidi} rifai={() => prepara(l.id)} />)}
      {senza.length > 0 &&
        <details className="text-sm">
          <summary className="cursor-pointer font-medium">Leggi senza scheda ({senza.length})</summary>
          <ul className="mt-2 space-y-2">
            {senza.map((l) =>
              <li key={l.id} className="flex items-center gap-2 justify-between border-t border-border pt-2">
                <span className="min-w-0"><b>{fmtData(l.data)}</b> · {l.titolo || 'ddl ' + l.ddl}{!l.haTesto && <span className="text-muted-foreground"> (testo non ancora scaricato)</span>}</span>
                <button disabled={!l.haTesto || !!busy} onClick={() => prepara(l.id)} className="flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-40 whitespace-nowrap">
                  {busy === l.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />} Prepara
                </button>
              </li>)}
          </ul>
        </details>}
    </Box>);
}

function Bozza({ l, aperta, apri, busy, decidi, rifai }) {
  const [b, setB] = useState(l.extra.bozza);
  useEffect(() => { setB(l.extra.bozza); }, [l]);
  const set = (k, v) => setB((x) => ({ ...x, [k]: v }));
  const setM = (i, k, v) => setB((x) => ({ ...x, misure: x.misure.map((m, j) => (j === i ? { ...m, [k]: v } : m)) }));
  const togli = (i) => setB((x) => ({ ...x, misure: x.misure.filter((_, j) => j !== i) }));
  return (
    <div className="border border-border rounded-xl p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{fmtData(l.data)} · ddl {l.ddl} · bozza del {new Date(b.creata).toLocaleDateString('it-IT')}</p>
          <p className="font-semibold">{l.titolo}</p>
        </div>
        <a href={linkLegge(l.id)} target="_blank" rel="noopener noreferrer" className="text-muted-foreground p-2" aria-label="Apri la pagina della legge"><ExternalLink className="w-4 h-4" /></a>
      </div>
      <button onClick={apri} className="text-sm font-semibold text-primary">{aperta ? 'Chiudi' : 'Rileggi e pubblica'}</button>
      {aperta &&
        <div className="space-y-3 text-sm">
          <label className="block">Titolo semplice<input className="mt-1 w-full border border-border rounded-lg p-2 bg-background" value={b.titolo_breve || ''} onChange={(e) => set('titolo_breve', e.target.value)} /></label>
          <label className="block">In breve (una frase per riga)<textarea rows={4} className="mt-1 w-full border border-border rounded-lg p-2 bg-background" value={(b.breve || []).join('\n')} onChange={(e) => set('breve', e.target.value.split('\n').filter((x) => x.trim()))} /></label>
          <div className="space-y-2">
            <p className="font-medium">Articoli ({(b.misure || []).length})</p>
            {(b.misure || []).map((m, i) =>
              <div key={i} className="border border-border rounded-lg p-2 space-y-1">
                <div className="flex gap-2">
                  <input className="w-16 border border-border rounded p-1 bg-background" value={m.articolo} onChange={(e) => setM(i, 'articolo', e.target.value)} aria-label="Articolo" />
                  <input className="flex-1 border border-border rounded p-1 bg-background" value={m.titolo} onChange={(e) => setM(i, 'titolo', e.target.value)} aria-label="Titolo" />
                  <button onClick={() => togli(i)} className="text-red-600 px-2" aria-label="Togli questo articolo"><X className="w-4 h-4" /></button>
                </div>
                <textarea rows={2} className="w-full border border-border rounded p-1 bg-background" value={m.sintesi || ''} onChange={(e) => setM(i, 'sintesi', e.target.value)} aria-label="Spiegazione" />
                <input className="w-full border border-border rounded p-1 bg-background" placeholder="Come si chiede (vuoto = nessuna domanda da fare)" value={m.come_si_chiede || ''} onChange={(e) => setM(i, 'come_si_chiede', e.target.value || null)} />
                <p className="text-xs text-muted-foreground">{m.tema || 'senza tema'} · {(m.per || []).join(', ') || 'per tutti'}{m.mln != null ? ` · ${m.mln} mln` : ''}</p>
              </div>)}
          </div>
          {b.nota && <p className="text-xs text-amber-700">Nota dell'IA: {b.nota}</p>}
          <div className="flex flex-wrap gap-2">
            <button disabled={busy} onClick={() => decidi(l.id, 'pubblica', b)} className="flex items-center gap-1 px-3 py-2 rounded-lg bg-emerald-600 text-white font-semibold disabled:opacity-50">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Pubblica sul sito</button>
            <button disabled={busy} onClick={rifai} className="flex items-center gap-1 px-3 py-2 rounded-lg border border-border font-semibold disabled:opacity-50"><RefreshCw className="w-4 h-4" /> Rifai la bozza</button>
            <button disabled={busy} onClick={() => decidi(l.id, 'scarta')} className="flex items-center gap-1 px-3 py-2 rounded-lg border border-red-300 text-red-700 font-semibold disabled:opacity-50"><X className="w-4 h-4" /> Scarta</button>
          </div>
        </div>}
    </div>);
}

function Correggi() {
  const [cerca, setCerca] = useState('');
  const [a, setA] = useState(null);
  const [titolo, setTitolo] = useState('');
  const [luoghi, setLuoghi] = useState('');
  const [msg, setMsg] = useState('');
  const apri = async (e) => {
    e.preventDefault(); setMsg('');
    const k = kDaSlug(cerca.trim().replace(/^.*\/ars\/atto\//, '')) || cerca.trim().toUpperCase().replace(/\s+/g, '');
    const { data } = await supabase.from('ars_atti').select('k, tipo, n, titolo, luoghi, bloccati, correzioni').eq('k', k).maybeSingle();
    if (!data) { setA(null); setMsg('Atto non trovato. Scrivi ad esempio I2743 (interrogazione 2743), M120, P45, D1200, oppure incolla il link della pagina.'); return; }
    setA(data); setTitolo(data.titolo); setLuoghi((data.luoghi || []).join(', '));
  };
  const salva = async () => {
    const nuoviLuoghi = luoghi.split(',').map((x) => x.trim()).filter(Boolean);
    const cambi = [];
    if (titolo !== a.titolo) cambi.push({ campo: 'titolo', prima: a.titolo, dopo: titolo });
    if (nuoviLuoghi.join('|') !== (a.luoghi || []).join('|')) cambi.push({ campo: 'luoghi', prima: a.luoghi, dopo: nuoviLuoghi });
    if (!cambi.length) { setMsg('Nessuna modifica.'); return; }
    const at = new Date().toISOString();
    const bloccati = [...new Set([...(a.bloccati || []), ...cambi.map((c) => c.campo)])];
    const { error } = await supabase.from('ars_atti').update({ titolo, luoghi: nuoviLuoghi, bloccati, correzioni: [...(a.correzioni || []), ...cambi.map((c) => ({ ...c, at }))], updated_at: at }).eq('k', a.k);
    setMsg(error ? 'Errore: ' + error.message : 'Salvato. La correzione resta anche ai prossimi aggiornamenti.');
    if (!error) setA({ ...a, titolo, luoghi: nuoviLuoghi, bloccati });
  };
  return (
    <Box titolo="Correggi un atto" desc="Per un titolo letto male dal PDF o un paese che non c'entra. Le segnalazioni dei lettori arrivano in «Richieste dal sito».">
      <form onSubmit={apri} className="flex gap-2">
        <input className="flex-1 border border-border rounded-lg p-2 bg-background text-sm" placeholder="Numero dell'atto (es. I2743) o link della pagina" value={cerca} onChange={(e) => setCerca(e.target.value)} />
        <button className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold">Apri</button>
      </form>
      {a &&
        <div className="space-y-2 text-sm">
          <a href={linkAtto(a.k)} target="_blank" rel="noopener noreferrer" className="text-primary font-semibold inline-flex items-center gap-1">Pagina dell'atto <ExternalLink className="w-3 h-3" /></a>
          <label className="block">Titolo<textarea rows={3} className="mt-1 w-full border border-border rounded-lg p-2 bg-background" value={titolo} onChange={(e) => setTitolo(e.target.value)} /></label>
          <label className="block">Paesi e luoghi (separati da virgola)<input className="mt-1 w-full border border-border rounded-lg p-2 bg-background" value={luoghi} onChange={(e) => setLuoghi(e.target.value)} /></label>
          <button onClick={salva} className="px-3 py-2 rounded-lg bg-emerald-600 text-white font-semibold">Salva la correzione</button>
          {(a.correzioni || []).length > 0 && <p className="text-xs text-muted-foreground">Correzioni già fatte: {a.correzioni.length}</p>}
        </div>}
      {msg && <p className="text-sm">{msg}</p>}
    </Box>);
}

// Foto dei deputati: si carica un'immagine dal telefono/computer oppure si
// incolla l'indirizzo di un'immagine. Compare su /ars/deputati e sul profilo.
function FotoDeputati() {
  const qc = useQueryClient();
  const [lista, setLista] = useState(null);
  const [cerca, setCerca] = useState('');
  const [soloSenza, setSoloSenza] = useState(true);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState({});
  const carica = async () => {
    const { data } = await supabase.from('ars_deputati').select('nome, gruppo_breve, gruppo, in_carica, foto_url').order('nome');
    setLista(data || []);
  };
  useEffect(() => { carica(); }, []);
  const salva = async (nome, foto_url) => {
    const { error } = await supabase.from('ars_deputati').update({ foto_url }).eq('nome', nome);
    if (error) { setMsg((m) => ({ ...m, [nome]: 'Errore: ' + error.message })); return false; }
    setLista((l) => l.map((d) => (d.nome === nome ? { ...d, foto_url } : d)));
    setMsg((m) => ({ ...m, [nome]: foto_url ? 'Foto salvata ✓' : 'Foto tolta' }));
    qc.invalidateQueries({ queryKey: ['ars-deputati-tutti'] });
    return true;
  };
  const daFile = async (nome, file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setMsg((m) => ({ ...m, [nome]: 'Scegli un\'immagine (jpg, png, webp).' })); return; }
    setBusy(nome);
    try { const r = await uploadFile(file); await salva(nome, r.file_url); } catch (e) { setMsg((m) => ({ ...m, [nome]: 'Caricamento non riuscito: ' + e.message })); }
    setBusy('');
  };
  const daLink = async (nome, url) => {
    const u = String(url || '').trim();
    if (!/^https:\/\/\S+$/i.test(u)) { setMsg((m) => ({ ...m, [nome]: 'Incolla un indirizzo che inizia con https://' })); return false; }
    return salva(nome, u);
  };
  const conFoto = (lista || []).filter((d) => d.foto_url).length;
  const inCarica = (lista || []).filter((d) => d.in_carica).length;
  const vis = useMemo(() => (lista || []).filter((d) => d.in_carica || !soloSenza)
    .filter((d) => !soloSenza || !d.foto_url)
    .filter((d) => !cerca || d.nome.toLowerCase().includes(cerca.toLowerCase()) || String(d.gruppo_breve || d.gruppo || '').toLowerCase().includes(cerca.toLowerCase())), [lista, soloSenza, cerca]);
  return (
    <Box titolo="Foto dei deputati" desc="Carica una foto dal telefono o dal computer, oppure incolla l'indirizzo dell'immagine (ad esempio dalla scheda del deputato sul sito dell'ARS: tieni premuto sulla foto e scegli «Copia indirizzo immagine»). Chi non ha la foto mostra le iniziali.">
      {!lista ? <Loader2 className="w-5 h-5 animate-spin" /> :
        <>
          <p className="text-sm"><b>{conFoto}</b> deputati con la foto su {lista.length} ({inCarica} in carica).</p>
          <div className="flex flex-wrap gap-2 items-center">
            <input className="flex-1 min-w-[180px] border border-border rounded-lg p-2 bg-background text-sm" placeholder="Cerca per nome o gruppo" value={cerca} onChange={(e) => setCerca(e.target.value)} />
            <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={soloSenza} onChange={(e) => setSoloSenza(e.target.checked)} /> Solo quelli senza foto</label>
          </div>
          {vis.length === 0 ? <p className="text-sm text-muted-foreground">{soloSenza ? 'Tutti i deputati in carica hanno la foto. Togli la spunta per vederli.' : 'Nessun deputato trovato.'}</p> :
            <ul className="divide-y divide-border">{vis.map((d) => <RigaFoto key={d.nome} d={d} busy={busy === d.nome} msg={msg[d.nome]} daFile={daFile} daLink={daLink} togli={() => salva(d.nome, null)} />)}</ul>}
        </>}
    </Box>);
}

function RigaFoto({ d, busy, msg, daFile, daLink, togli }) {
  const file = useRef(null);
  const [link, setLink] = useState('');
  const [errImg, setErrImg] = useState(false);
  useEffect(() => { setErrImg(false); }, [d.foto_url]);
  return (
    <li className="py-3 flex flex-wrap gap-3 items-center">
      {d.foto_url && !errImg
        ? <img src={d.foto_url} alt="" onError={() => setErrImg(true)} className="w-14 h-14 rounded-full object-cover object-top bg-muted shrink-0" />
        : <span className="w-14 h-14 rounded-full bg-primary/10 text-primary font-black flex items-center justify-center shrink-0">{iniziali(d.nome)}</span>}
      <div className="min-w-[140px] flex-1">
        <a href={`/ars/deputato/${slugDeputato(d.nome)}`} target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline">{d.nome}</a>
        <div className="text-xs text-muted-foreground">{d.gruppo_breve || d.gruppo}{d.in_carica ? '' : ' · non più in carica'}</div>
        {errImg && <div className="text-xs text-red-600">L'immagine salvata non si apre: caricane un'altra.</div>}
        {msg && <div className="text-xs mt-1">{msg}</div>}
      </div>
      <div className="flex flex-wrap gap-2 items-center w-full sm:w-auto">
        <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => { daFile(d.nome, e.target.files?.[0]); e.target.value = ''; }} />
        <button type="button" disabled={busy} onClick={() => file.current?.click()} className="flex items-center gap-1 text-sm font-semibold px-3 py-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-50">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Carica foto
        </button>
        <form className="flex gap-1 flex-1 sm:flex-none" onSubmit={async (e) => { e.preventDefault(); if (await daLink(d.nome, link)) setLink(''); }}>
          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="oppure incolla l'indirizzo" className="flex-1 sm:w-56 border border-border rounded-lg p-2 bg-background text-sm" />
          <button className="flex items-center gap-1 text-sm font-semibold px-3 py-2 rounded-lg border border-border" aria-label="Salva l'indirizzo della foto"><Link2 className="w-4 h-4" /> Salva</button>
        </form>
        {d.foto_url && <button type="button" onClick={togli} className="text-sm text-red-700 font-semibold px-2">Togli</button>}
      </div>
    </li>);
}
