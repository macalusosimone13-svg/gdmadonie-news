import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Info, ArrowRight, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { supabase } from '@/lib/supabaseClient';
import { sb44 } from '@/api/supabaseEntities';
import { useAuth } from '@/lib/AuthContext';

// Termometro Sicilia: stima settimanale di GD Madonie News (NON un sondaggio).
// I numeri stanno nella tabella `termometro_stime`, una riga per settimana.
// Il pubblico vede solo le righe "pubblicata"; l'admin vede anche l'ultima bozza
// e la pubblica da qui.

const num = (n) => String(n).replace('.', ',');
const pct = (n) => `${num(n)}%`;
const forbice = (a, b) => (a === b ? pct(a) : `${num(a)}–${num(b)}%`);
const chiave = (nome) => (nome || '').split(/\r?\n/)[0].trim().toLowerCase();

const TendenzaIcona = ({ t }) => {
  if (t === 'su') return <ArrowUpRight size={14} aria-hidden="true" />;
  if (t === 'giu') return <ArrowDownRight size={14} aria-hidden="true" />;
  return <ArrowRight size={14} aria-hidden="true" />;
};

export default function TermometroSicilia() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const queryClient = useQueryClient();
  const [salvo, setSalvo] = useState(false);
  const [errore, setErrore] = useState('');

  // Con le regole del database chi non è admin riceve solo le stime pubblicate.
  const { data: righe, isLoading } = useQuery({
    queryKey: ['termometro-stime', isAdmin ? 'admin' : 'pubblico'],
    queryFn: async () => {
      const { data, error } = await supabase.
      from('termometro_stime').
      select('*').
      eq('ambito', 'sicilia').
      order('settimana', { ascending: false }).
      limit(1);
      if (error) { console.error('[supabase] termometro_stime', error); return []; }
      return data || [];
    },
    staleTime: 5 * 60 * 1000
  });

  // Colori e loghi delle liste: gli stessi della scheda "Regionale (liste)".
  const { data: listeSito } = useQuery({
    queryKey: ['poll-entries', 'regionale'],
    queryFn: () => sb44.entities.PollEntry.filter({ scope: 'regionale' }, 'survey_date', 1000),
    staleTime: 5 * 60 * 1000
  });
  const stile = useMemo(() => {
    const m = new Map();
    for (const e of listeSito || []) {
      const k = chiave(e.party);
      const prima = m.get(k) || {};
      m.set(k, { colore: e.party_color || prima.colore, logo: e.logo_url || prima.logo });
    }
    return m;
  }, [listeSito]);

  const stima = righe?.[0] || null;
  const d = stima?.dati || {};
  const bozza = stima?.stato === 'bozza';

  const cambiaStato = async (stato) => {
    if (!stima || salvo) return;
    setSalvo(true); setErrore('');
    const { error } = await supabase.from('termometro_stime').update({ stato, updated_at: new Date().toISOString() }).eq('id', stima.id);
    setSalvo(false);
    if (error) { setErrore('Non sono riuscito a salvare. Riprova.'); return; }
    queryClient.invalidateQueries({ queryKey: ['termometro-stime'] });
  };

  if (isLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}><Loader2 className="w-6 h-6 animate-spin" style={{ opacity: .5 }} /></div>;
  }
  if (!stima) {
    return <p style={{ textAlign: 'center', padding: '32px 0', opacity: .6 }}>La prima stima del Termometro Sicilia è in preparazione.</p>;
  }

  // Come nelle tessere delle coalizioni: il blu notte del centrodestra non si legge sulle schede, si usa l'accento.
  const leggibile = (c) => c === '#0F2A5C' || c === '#0F1B3A' ? '#2F5BD8' : c;
  const coalizioni = (d.coalizioni || []).map((c) => ({ ...c, colore: leggibile(c.colore) }));
  const principali = coalizioni.filter((c) => c.principale);
  const altre = coalizioni.filter((c) => !c.principale);
  // Nella barra: prima coalizione a sinistra, seconda a destra, le altre in mezzo.
  const barra = principali.length === 2 ? [principali[0], ...altre, principali[1]] : coalizioni;
  const liste = (d.liste || []).map((l) => {
    const s = stile.get(chiave(l.nome)) || {};
    return { ...l, colore: s.colore || l.colore || 'var(--acc)', logo: s.logo || null };
  });
  const scala = Math.max(20, Math.ceil(Math.max(0, ...liste.map((l) => l.max || l.stima || 0)) / 5) * 5);
  const tacche = [0, 1, 2, 3, 4].map((i) => scala / 4 * i);
  const pos = (v) => `${Math.min(100, Math.max(0, v / scala * 100))}%`;
  const scenario = d.scenario;
  const scenarioMax = scenario ? Math.max(60, ...scenario.righe.map((r) => r.max)) : 60;
  const attenzione = d.attenzione || [];
  const attMax = Math.max(1, ...attenzione.map((a) => a.ora));
  const settimana = format(new Date(stima.settimana), 'd MMMM yyyy', { locale: it });

  return (
    <div className="termo">
      {isAdmin &&
      <div className={`termo-admin ${bozza ? 'bozza' : ''}`}>
          <span>
            <b>{bozza ? 'Bozza' : 'Pubblicata'}</b>
            {bozza ? ' · la vedi solo tu. I visitatori vedono la stima precedente, se c\'è.' : ' · visibile a tutti.'}
          </span>
          <button type="button" className="share-btn share-primary" disabled={salvo} onClick={() => cambiaStato(bozza ? 'pubblicata' : 'bozza')}>
            {salvo ? 'Salvo…' : bozza ? 'Pubblica' : 'Riporta in bozza'}
          </button>
          {errore && <span className="termo-errore">{errore}</span>}
        </div>}

      <div className="sond-grid">
        <div>
          <div className="sondaggi-card">
            <div className="termo-testata">
              <span className="termo-badge"><Info size={14} aria-hidden="true" /> Stima · non è un sondaggio</span>
              <span className="termo-data">Settimana del {settimana}</span>
            </div>
            <h2>Le coalizioni oggi</h2>
            <div className="card-meta">Regionali Sicilia 2027 · stima GD Madonie News</div>
            {principali.length > 0 &&
            <div className="termo-big">
                {principali.map((c) =>
              <div key={c.nome}>
                    <span className="termo-big-pct">{pct(c.valore)}</span>
                    <span className="termo-big-nome"><i style={{ background: c.colore }} />{c.nome}</span>
                    {c.nota && <span className="termo-big-nota">{c.nota}</span>}
                  </div>
              )}
              </div>}
            <div className="termo-stack" role="img" aria-label={coalizioni.map((c) => `${c.nome} ${pct(c.valore)}`).join(', ')}>
              {barra.map((c) => <span key={c.nome} style={{ width: `${c.valore}%`, background: c.colore }} />)}
            </div>
            <div className="termo-legenda">
              {altre.map((c) => <div key={c.nome}><i style={{ background: c.colore }} /><span>{c.nome}</span><b>{pct(c.valore)}</b></div>)}
            </div>
          </div>

          {scenario &&
          <div className="sondaggi-card termo-scenario">
              <span className="termo-kicker">Scenario</span>
              <h2>{scenario.titolo}</h2>
              <div className="termo-scenario-righe">
                {scenario.righe.map((r, i) =>
              <div key={r.nome}>
                    <div className="termo-riga-testa"><span>{r.nome}</span><b>{forbice(r.min, r.max)}</b></div>
                    <div className="termo-scenario-track"><span className={i === 0 ? 'a' : 'b'} style={{ width: `${(r.min + r.max) / 2 / scenarioMax * 100}%` }} /></div>
                  </div>
              )}
              </div>
              {scenario.nota && <p>{scenario.nota}</p>}
            </div>}

          {(d.eventi || []).length > 0 &&
          <div className="sondaggi-card">
              <h2>Cosa ha mosso i numeri</h2>
              <div className="card-meta">Gli eventi della settimana e l'effetto applicato, in punti</div>
              <div className="termo-eventi">
                {d.eventi.map((e) =>
              <div key={e.titolo} className="termo-evento">
                    <span className="termo-evento-data">{e.data}</span>
                    <b>{e.titolo}</b>
                    <div className="termo-chips">
                      {(e.effetti || []).map((f) =>
                  <span key={f.lista} className={f.valore > 0 ? 'piu' : f.valore < 0 ? 'meno' : ''}>
                          {f.lista} {f.valore > 0 ? '+' : f.valore < 0 ? '−' : ''}{num(Math.abs(f.valore).toFixed(1))}
                        </span>
                  )}
                    </div>
                  </div>
              )}
              </div>
            </div>}
        </div>

        <div>
          <div className="sondaggi-card">
            <h2>Le liste</h2>
            <div className="card-meta">Il pallino è la stima. La fascia colorata è la forbice: il valore vero può stare ovunque lì dentro.</div>
            <div className="termo-asse" aria-hidden="true">{tacche.map((t, i) => <span key={t}>{num(t)}{i === tacche.length - 1 ? '%' : ''}</span>)}</div>
            {liste.map((l) =>
            <div className="termo-lista" key={l.nome}>
                <div className="poll-row">
                  {l.logo ? <img src={l.logo} alt="" style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover' }} /> : <span className="poll-dot" style={{ background: l.colore }} />}
                  <span className="poll-party">{l.nome}</span>
                  <span className="poll-pct">{pct(l.stima)}</span>
                </div>
                <div className="termo-range" role="img" aria-label={`${l.nome}: stima ${pct(l.stima)}, forbice ${forbice(l.min, l.max)}`}>
                  <span className="termo-band" style={{ left: pos(l.min), width: `calc(${pos(l.max)} - ${pos(l.min)})`, background: l.colore }} />
                  <span className="termo-dot" style={{ left: pos(l.stima), background: l.colore }} />
                </div>
                <div className="termo-lista-piede">
                  <span>Forbice {forbice(l.min, l.max)}</span>
                  <span className="termo-tendenza"><TendenzaIcona t={l.tendenza} />{l.tendenza_testo}</span>
                </div>
              </div>
            )}
            {(d.minori || []).length > 0 &&
            <div className="termo-minori">
                <b>Liste minori</b>
                {d.minori.map((m) => <span key={m.nome}>{m.nome} <b>{pct(m.stima)}</b></span>)}
              </div>}
          </div>

          {attenzione.length > 0 &&
          <div className="sondaggi-card">
              <h2>Di chi si parla</h2>
              <div className="card-meta">Titoli sui giornali siciliani negli ultimi 14 giorni, e nei 14 prima. Misura l'attenzione, non il consenso.</div>
              {attenzione.map((a) =>
            <div className="poll-item" key={a.nome}>
                  <div className="termo-riga-testa"><span className="poll-party">{a.nome}</span><span><b>{a.ora}</b> <small>· erano {a.prima}</small></span></div>
                  <div className="poll-track"><div className="poll-fill" style={{ width: `${a.ora / attMax * 100}%` }} /></div>
                </div>
            )}
            </div>}

          <div className="sondaggi-card">
            <h2>Come lo calcoliamo</h2>
            <div className="card-meta">Quattro passaggi, sempre gli stessi</div>
            <ol className="termo-passi">
              <li><b>Partiamo dai sondaggi pubblicati.</b> Ne facciamo la media: pesano di più i recenti, quelli con più interviste e gli istituti che in passato hanno sbagliato meno; pesano meno quelli pagati da un partito e i dati isolati, lontani da tutti gli altri.</li>
              <li><b>Teniamo conto del voto vero.</b> Il risultato delle ultime Regionali tira un po' la stima verso di sé: poco quando i sondaggi sono freschi, di più quando sono vecchi.</li>
              <li><b>Leggiamo la settimana.</b> Eventi, tono delle notizie e attenzione spostano la stima di poco: al massimo 1,5 punti per volta.</li>
              <li><b>Diamo una forbice.</b> Ogni percentuale esce con il suo margine: si allarga quando i sondaggi sono pochi, vecchi o in disaccordo tra loro, si stringe quando sono recenti e concordi.</li>
            </ol>
            {d.base?.testo &&
            <div className="termo-fonti" style={{ marginBottom: 10 }}><b>Quanto è solida la base.</b> {d.base.testo}</div>}
            {(d.sondaggi || []).length > 0 &&
            <div className="termo-fonti"><b>Sondaggi usati.</b> {d.sondaggi.join(' · ')}.</div>}
          </div>
        </div>
      </div>

      <p className="termo-nota">Stima a cura di GD Madonie News. Non è un sondaggio e non ha valore statistico: nessuno è stato intervistato.</p>
    </div>);

}
