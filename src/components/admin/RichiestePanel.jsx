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
// Frase chiara sul motivo della richiesta, e oggetto già pronto per la risposta via email.
const MOTIVI = {
  iscrizione: { frase: 'vuole iscriversi ai Giovani Democratici Madonie', oggetto: 'La tua iscrizione ai GD Madonie' },
  segnalazione: { frase: 'vuole segnalarti un problema del suo territorio', oggetto: 'La tua segnalazione a GD Madonie' },
  proposta: { frase: 'ti propone una notizia o un tema da raccontare', oggetto: 'La tua proposta a GD Madonie News' },
  altro: { frase: 'ti ha scritto per un altro motivo', oggetto: 'Il tuo messaggio a GD Madonie' },
};
const FILTRI = [
  { id: 'aperte', label: 'Da gestire' },
  { id: 'gestita', label: 'Gestite' },
  { id: 'tutte', label: 'Tutte' },
];

// Le risposte partono dalla casella di GD Madonie, non da quella personale di chi è collegato.
const GD_EMAIL = 'gdmadonie@gmail.com';
const corpoRisposta = (r) => `Ciao ${String(r.nome || '').split(' ')[0]},\n\ngrazie per averci scritto dal sito.\n\n\nGiovani Democratici Madonie\nwww.gdmadonie-news.com`;
// Apre la finestra "Scrivi" di Gmail già sull'account GD Madonie (authuser), con destinatario, oggetto e testo pronti.
const gmailHref = (r, oggetto) => `https://mail.google.com/mail/?authuser=${encodeURIComponent(GD_EMAIL)}&view=cm&fs=1&to=${encodeURIComponent(r.contatto)}&su=${encodeURIComponent(oggetto)}&body=${encodeURIComponent(corpoRisposta(r))}`;
const mailtoHref = (r, oggetto) => `mailto:${r.contatto}?subject=${encodeURIComponent(oggetto)}&body=${encodeURIComponent(corpoRisposta(r))}`;

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
            const m = MOTIVI[r.tipo] || MOTIVI.altro;
            return (
              <div key={r.id} onClick={() => segnaLetta(r)}
                className={`bg-card border rounded-xl p-4 space-y-2 ${r.stato === 'nuova' ? 'border-[#2F5BD8]' : 'border-border'} ${r.stato === 'gestita' ? 'opacity-70' : ''}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${t.cls}`}>{t.label}</span>
                  {r.stato === 'nuova' && <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[#2F5BD8] text-white">Nuova</span>}
                  <span className="text-xs text-muted-foreground ml-auto">{format(new Date(r.created_at), "d MMM yyyy, HH:mm", { locale: it })}</span>
                </div>
                <p className="text-base text-foreground leading-snug">
                  <b>{r.nome}</b>{r.comune ? <> da <b>{r.comune}</b></> : ''} {m.frase}.
                </p>
                <div className="rounded-lg bg-muted/60 px-3 py-2">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-1">Cosa ti ha scritto</p>
                  {r.messaggio ?
                    <p className="text-sm text-foreground whitespace-pre-line">{r.messaggio}</p> :
                    <p className="text-sm text-muted-foreground italic">Nessun messaggio: ha lasciato solo i suoi dati per essere ricontattato.</p>}
                </div>
                <p className="text-sm text-foreground pt-1">
                  {isEmail(r.contatto) ?
                    <>Ti ha lasciato la sua <b>email</b>: rispondigli dalla casella di GD Madonie.</> :
                    <>Ti ha lasciato il suo <b>numero di telefono</b>: chiamalo o scrivigli su WhatsApp.</>}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {isEmail(r.contatto) ?
                    <>
                      <a href={gmailHref(r, m.oggetto)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1.5 text-sm font-bold text-white px-3 py-2 rounded-full bg-[#2F5BD8]"><Mail className="w-4 h-4" />Rispondi come GD Madonie</a>
                      <a href={mailtoHref(r, m.oggetto)} onClick={(e) => e.stopPropagation()} className="text-xs font-bold text-muted-foreground underline px-1 py-2">oppure con l'app Mail</a>
                      <span className="basis-full text-xs text-muted-foreground">Destinatario: {r.contatto} · la risposta parte da {GD_EMAIL}</span>
                    </> :
                    <>
                      <a href={telHref(r.contatto)} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1.5 text-sm font-bold text-[#2F5BD8] px-3 py-2 rounded-full bg-[#EAF0FD]"><Phone className="w-4 h-4" />Chiama {r.contatto}</a>
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
