import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useSEO } from '@/lib/useSEO';
import { Avvisami, Caricamento, Segnala, Termine } from '@/components/ars/ArsComuni';
import { SITE, fmtData, linkLegge, nomeCommissione, titoloLegge } from '@/lib/ars';

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default function Leggi() {
  useSEO({
    title: "Leggi approvate dall'ARS dal 2022 a oggi — GD Madonie News",
    description: "Tutte le leggi votate dall'Assemblea Regionale Siciliana nella XVIII legislatura: titolo, data, voti favorevoli e contrari, percorso in commissione. Aggiornato in automatico.",
    url: `${SITE}/ars/leggi`,
  });
  const [anno, setAnno] = useState('tutti');
  const [q, setQ] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['ars-leggi'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => (await supabase.from('ars_leggi').select('id, ddl, titolo, titolo_breve, data, approvata, favorevoli, contrari, astenuti, commissione, manuale, gurs').is('unita_a', null).order('data', { ascending: false })).data || [],
  });
  const anni = useMemo(() => [...new Set((data || []).map((l) => (l.data || '').slice(0, 4)).filter(Boolean))], [data]);
  const lista = (data || []).filter((l) => (anno === 'tutti' || (l.data || '').startsWith(anno)) && (!q || norm(titoloLegge(l) + ' ' + l.titolo + ' ' + l.ddl).includes(norm(q))));

  return (
    <div className="view">
      <section>
        <div className="sec-h"><h1 style={{ fontSize: 'clamp(26px,5vw,40px)', textTransform: 'uppercase', fontWeight: 900 }}>Le leggi approvate</h1><Avvisami chiave="leggi" etichetta="Avvisami per ogni nuova legge" compatto testo="Ti scriviamo quando l'ARS approva una legge, con il link alla scheda." /></div>
        <p className="sub">Ogni <Termine k="ddl">disegno di legge</Termine> approvato con il voto finale in Aula. Diventa legge quando viene pubblicato sulla <Termine k="gurs">Gazzetta ufficiale</Termine>.</p>
        <div className="filters">
          <div className="line">
            <div className="search-mini"><span aria-hidden="true">🔎</span><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca una legge (es. energia, cimiteri, bilancio)" aria-label="Cerca tra le leggi" /></div>
          </div>
          <div className="chips" role="group" aria-label="Anno">
            {['tutti', ...anni].map((a) => <button key={a} type="button" className="chip" aria-pressed={anno === a} onClick={() => setAnno(a)}>{a === 'tutti' ? 'Tutti gli anni' : a}<span className="c">{a === 'tutti' ? (data || []).length : (data || []).filter((l) => (l.data || '').startsWith(a)).length}</span></button>)}
          </div>
        </div>
      </section>
      {isLoading ? <Caricamento righe={6} /> :
        lista.length === 0 ? <div className="empty">Nessuna legge con questi filtri.</div> :
          <div className="rows">
            {lista.map((l) =>
              <Link key={l.id} to={linkLegge(l.id)} className="lawrow">
                <div style={{ display: 'grid', gap: 6, minWidth: 0 }}>
                  <span className={`pill ${l.approvata ? 'ok' : 'warn'}`}>{l.approvata ? '✓ Approvata' : 'Respinta'} · {fmtData(l.data)}</span>
                  <h3 className="plain">{titoloLegge(l)}</h3>
                  <p>Ddl {l.ddl}{l.favorevoli != null ? ` · ${l.favorevoli} sì, ${l.contrari ?? 0} no, ${l.astenuti ?? 0} astenuti` : ''}{l.commissione ? ` · ${nomeCommissione(l.commissione)}` : ''}</p>
                </div>
                <span className="btn ghost small">Apri</span>
              </Link>)}
          </div>}
      <div className="sources">Le leggi sono ricavate dai voti finali scritti nei resoconti ufficiali delle sedute. Se manca qualcosa, <Segnala pagina="/ars/leggi" /></div>
    </div>);
}
