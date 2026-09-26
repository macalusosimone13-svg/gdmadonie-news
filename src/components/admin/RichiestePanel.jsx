import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Loader2, Mail, Phone, Trash2, MapPin, Check, RotateCcw } from 'lucide-react';

// Richieste arrivate dal modulo "Partecipa" del sito (tabella partecipa_richieste).
const TIPI = {
  iscrizione: { label: 'Iscrizione', cls: 'bg-[#EAF0FD] text-[#2F5BD8]' },
  segnalazione: { label: 'Segnalazione', cls: 'bg-amber-100 text-amber-700' },
  proposta: { label: 'Proposta notizia', cls: 'bg-emerald-100 text-emerald-700' },
  altro: { label: 'Altro', cls: 'bg-muted text-muted-foreground' },
};
const FILTRI = [
  { id: 'aperte', label: 'Da gestire' },
  { id: 'gestita', label: 'Gestite' },
  { id: 'tutte', label: 'Tutte' },
];

const isEmail = (s) => /@/.test(s || '');
const telHref = (s) => 'tel:' + String(s || '').replace(/[^\d+]/g, '');
const waHref = (s) => {
  let n = String(s || '').replace(/[^\d]/g, '');
  if (n.length === 10 && n.startsWith('3')) n = '39' + n; // cellulare italiano senza prefisso
  return `https://wa.me/${n}`;
};

export default function RichiestePanel() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('aperte');
  const [err, setErr] = useState('');

  const load = async () => {
    setLoading(true); setErr('');
    const { data, error } = await supabase.from('partecipa_richieste').select('*').order('created_at', { ascending: false }).limit(500);
    if (error) setErr('Non riesco a caricare le richieste.');
    setRows(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const setStato = async (r, stato) => {
    setRows((prev) => prev.map((x) => x.id === r.id ? { ...x, stato } : x));
    const { error } = await supabase.from('partecipa_richieste').update({ stato }).eq('id', r.id);
    if (error) load();
  };
  const elimina = async (r) => {
    if (!window.confirm(`Eliminare la richiesta di ${r.nome}?`)) return;
    setRows((prev) => prev.filter((x) => x.id !== r.id));
    const { error } = await supabase.from('partecipa_richieste').delete().eq('id', r.id);
    if (error) load();
  };
  // Aprire una richiesta nuova la segna come letta.
  const segnaLetta = (r) => { if (r.stato === 'nuova') setStato(r, 'letta'); };

  const visibili = rows.filter((r) => filtro === 'tutte' ? true : filtro === 'gestita' ? r.stato === 'gestita' : r.stato !== 'gestita');
  const nuove = rows.filter((r) => r.stato === 'nuova').length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {FILTRI.map((f) =>
          <button key={f.id} type="button" onClick={() => setFiltro(f.id)}
            className={`px-4 py-2 rounded-full text-sm font-bold border ${filtro === f.id ? 'bg-[#0F1B3A] text-white border-[#0F1B3A]' : 'bg-card text-foreground border-border'}`}>
            {f.label}{f.id === 'aperte' && nuove > 0 ? ` · ${nuove} nuove` : ''}
          </button>
        )}
        <span className="text-xs text-muted-foreground ml-auto">Il modulo è su <a href="/partecipa" target="_blank" rel="noopener noreferrer" className="underline">/partecipa</a></span>
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}
      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> :
        visibili.length === 0 ? <p className="text-sm text-muted-foreground">Nessuna richiesta {filtro === 'gestita' ? 'gestita' : filtro === 'aperte' ? 'da gestire' : ''}.</p> :
        <div className="space-y-2">
          {visibili.map((r) => {
            const t = TIPI[r.tipo] || TIPI.altro;
            return (
              <div key={r.id} onClick={() => segnaLetta(r)}
                className={`bg-card border rounded-xl p-4 space-y-2 ${r.stato === 'nuova' ? 'border-[#2F5BD8]' : 'border-border'} ${r.stato === 'gestita' ? 'opacity-70' : ''}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${t.cls}`}>{t.label}</span>
                  {r.stato === 'nuova' && <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[#2F5BD8] text-white">Nuova</span>}
                  <span className="text-xs text-muted-foreground ml-auto">{format(new Date(r.created_at), "d MMM yyyy, HH:mm", { locale: it })}</span>
                </div>
                <p className="font-bold text-foreground">{r.nome}
                  {r.comune && <span className="font-normal text-muted-foreground text-sm inline-flex items-center gap-1 ml-2"><MapPin className="w-3.5 h-3.5" />{r.comune}</span>}
                </p>
                {r.messaggio && <p className="text-sm text-foreground whitespace-pre-line">{r.messaggio}</p>}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {isEmail(r.contatto) ?
                    <a href={`mailto:${r.contatto}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1.5 text-sm font-bold text-[#2F5BD8] px-3 py-2 rounded-full bg-[#EAF0FD]"><Mail className="w-4 h-4" />{r.contatto}</a> :
                    <>
                      <a href={telHref(r.contatto)} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1.5 text-sm font-bold text-[#2F5BD8] px-3 py-2 rounded-full bg-[#EAF0FD]"><Phone className="w-4 h-4" />{r.contatto}</a>
                      <a href={waHref(r.contatto)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-sm font-bold text-emerald-700 px-3 py-2 rounded-full bg-emerald-100">WhatsApp</a>
                    </>
                  }
                  <div className="ml-auto flex items-center gap-1">
                    {r.stato !== 'gestita' ?
                      <button type="button" onClick={(e) => { e.stopPropagation(); setStato(r, 'gestita'); }} className="inline-flex items-center gap-1 text-sm font-bold px-3 py-2 rounded-full border border-border min-h-[40px]"><Check className="w-4 h-4" />Gestita</button> :
                      <button type="button" onClick={(e) => { e.stopPropagation(); setStato(r, 'letta'); }} className="inline-flex items-center gap-1 text-sm font-bold px-3 py-2 rounded-full border border-border min-h-[40px]"><RotateCcw className="w-4 h-4" />Riapri</button>
                    }
                    <button type="button" onClick={(e) => { e.stopPropagation(); elimina(r); }} aria-label="Elimina richiesta" className="text-red-500 hover:text-red-700 p-2 min-w-[40px] min-h-[40px] flex items-center justify-center"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>);
          })}
        </div>
      }
    </div>);
}
