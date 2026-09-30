import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Loader2, EyeOff, Eye, ExternalLink, RefreshCw } from 'lucide-react';

// Notizie della sezione Paesi (tabella comuni_notizie), raccolte in automatico
// dalla funzione aggrega-paesi. Da qui si nasconde con un tocco una notizia
// sbagliata o fuori tema, si rimette quella nascosta, o si pubblica una
// notizia che l'IA aveva scartato.
const FILTRI = [
  { id: 'pubblicata', label: 'Pubblicate' },
  { id: 'nascosta', label: 'Nascoste da te' },
  { id: 'scartata', label: "Scartate dall'IA" },
];

export default function PaesiPanel() {
  const [comuni, setComuni] = useState([]);
  const [comune, setComune] = useState('tutti');
  const [filtro, setFiltro] = useState('pubblicata');
  const [righe, setRighe] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [aggiorno, setAggiorno] = useState(false);
  const [esito, setEsito] = useState('');

  useEffect(() => {
    supabase.from('comuni').select('slug, nome').eq('attivo', true).order('sort_order').then(({ data }) => setComuni(data || []));
  }, []);

  const carica = async () => {
    setLoading(true); setErr('');
    let q = supabase.from('comuni_notizie').select('id, comune_slug, titolo, riassunto, tema, fonte_nome, link, published_date, stato').eq('stato', filtro).order('published_date', { ascending: false }).limit(150);
    if (comune !== 'tutti') q = q.eq('comune_slug', comune);
    const { data, error } = await q;
    if (error) setErr(error.message);
    setRighe(data || []);
    setLoading(false);
  };
  useEffect(() => { carica(); }, [comune, filtro]);

  const nomeDi = (slug) => comuni.find((c) => c.slug === slug)?.nome || slug;

  const cambia = async (r, stato) => {
    setErr('');
    const { error } = await supabase.from('comuni_notizie').update({ stato }).eq('id', r.id);
    if (error) { setErr(error.message); return; }
    // "Il punto" del paese va riscritto senza questa notizia (o con questa): al prossimo giro automatico
    await supabase.from('comuni').update({ punto_aggiornato_at: null }).eq('slug', r.comune_slug);
    setRighe((prev) => prev.filter((x) => x.id !== r.id));
  };

  const aggiornaOra = async () => {
    setAggiorno(true); setEsito('');
    const { data, error } = await supabase.functions.invoke(`aggrega-paesi${comune !== 'tutti' ? `?comune=${comune}` : ''}`, {});
    if (error) setEsito('Aggiornamento non riuscito, riprova tra poco.');
    else {
      const n = (data?.risultati || []).reduce((s, r) => s + (r.pubblicate || 0), 0);
      setEsito(`Fatto: ${n} notizi${n === 1 ? 'a nuova' : 'e nuove'}.`);
      carica();
    }
    setAggiorno(false);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Le notizie dei paesi arrivano da sole ogni mezz'ora. Qui puoi togliere quelle sbagliate o fuori tema: spariscono subito dalla pagina del paese.</p>
      <div className="flex flex-wrap items-center gap-2">
        <select value={comune} onChange={(e) => setComune(e.target.value)} className="rounded-full border border-border bg-card px-4 py-2 text-sm font-bold">
          <option value="tutti">Tutti i paesi</option>
          {comuni.map((c) => <option key={c.slug} value={c.slug}>{c.nome}</option>)}
        </select>
        {FILTRI.map((f) =>
          <button key={f.id} type="button" onClick={() => setFiltro(f.id)}
            className={`px-4 py-2 rounded-full text-sm font-bold border ${filtro === f.id ? 'bg-[#0F1B3A] text-white border-[#0F1B3A]' : 'bg-card text-foreground border-border'}`}>
            {f.label}
          </button>)}
        <button type="button" onClick={aggiornaOra} disabled={aggiorno} className="ml-auto inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold border border-border bg-card disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${aggiorno ? 'animate-spin' : ''}`} />{aggiorno ? 'Aggiorno…' : 'Aggiorna ora'}
        </button>
      </div>
      {esito && <p className="text-sm text-emerald-700">{esito}</p>}
      {err && <p className="text-sm text-red-600">{err}</p>}
      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> :
        righe.length === 0 ? <p className="text-sm text-muted-foreground">Nessuna notizia qui.</p> :
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{righe.length} notizi{righe.length === 1 ? 'a' : 'e'}</p>
          {righe.map((r) =>
            <div key={r.id} className="bg-card border border-border rounded-xl p-4 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-bold text-[#2F5BD8] uppercase">{nomeDi(r.comune_slug)}</span>
                <span className="text-muted-foreground">{r.fonte_nome} · {r.published_date ? format(new Date(r.published_date), 'd MMM yyyy', { locale: it }) : ''}</span>
                {r.tema && <span className="px-2 py-0.5 rounded-full bg-[#EAF0FD] text-[#2F5BD8] font-bold">{r.tema}</span>}
              </div>
              <p className="font-bold leading-snug">{r.titolo}</p>
              {r.riassunto && <p className="text-sm text-muted-foreground line-clamp-3">{r.riassunto}</p>}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {r.stato === 'pubblicata' ?
                  <button type="button" onClick={() => cambia(r, 'nascosta')} className="inline-flex items-center gap-1.5 text-sm font-bold px-3 py-2 rounded-full border border-red-200 text-red-700 bg-red-50">
                    <EyeOff className="w-4 h-4" />Nascondi dal sito
                  </button> :
                  <button type="button" onClick={() => cambia(r, 'pubblicata')} className="inline-flex items-center gap-1.5 text-sm font-bold px-3 py-2 rounded-full text-white bg-[#2F5BD8]">
                    <Eye className="w-4 h-4" />{r.stato === 'scartata' ? 'Pubblica comunque' : 'Rimetti sul sito'}
                  </button>}
                <a href={r.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-bold text-muted-foreground underline px-1">Apri la fonte <ExternalLink className="w-3.5 h-3.5" /></a>
              </div>
            </div>)}
        </div>}
    </div>);
}
