import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useSEO } from '@/lib/useSEO';
import { AttoRiga, Avvisami, Caricamento, Segnala, Termine } from '@/components/ars/ArsComuni';
import { COMUNI, MADONIE, SITE } from '@/lib/ars';

const PER_PAGINA = 30;
const TIPI_F = [
  ['domande', 'Domande al Governo', ['I', 'P']],
  ['M', 'Mozioni', ['M']],
  ['D', 'Proposte di legge', ['D']],
  ['tutto', 'Tutto', ['I', 'P', 'M', 'D']],
];
const ANNI = ['2026', '2025', '2024', '2023', '2022'];

export default function Domande() {
  const [sp, setSp] = useSearchParams();
  const tipo = sp.get('tipo') || 'domande';
  const risposta = sp.get('risposta') || '';
  const luogo = sp.get('luogo') || '';
  const anno = sp.get('anno') || '';
  const firmatario = sp.get('firmatario') || '';
  const q = sp.get('q') || '';
  const pag = Math.max(0, Number(sp.get('pag') || 0));
  const [testo, setTesto] = useState(q);
  useEffect(() => { setTesto(q); }, [q]);

  const imposta = (k, v) => {
    const n = new URLSearchParams(sp);
    if (v) n.set(k, v); else n.delete(k);
    if (k !== 'pag') n.delete('pag');
    setSp(n, { replace: k !== 'pag' });
  };

  useSEO({
    title: luogo && luogo !== 'Madonie' ? `${luogo} all'ARS: interrogazioni, mozioni e risposte del Governo — GD Madonie News` : "Domande al Governo regionale: interrogazioni, interpellanze e risposte — GD Madonie News",
    description: "Tutte le interrogazioni, interpellanze, mozioni e proposte di legge presentate all'Assemblea Regionale Siciliana dal 2022, con le risposte del Governo. Cerca per paese, tema o deputato.",
    url: `${SITE}/ars/domande`,
  });

  const tipi = (TIPI_F.find((t) => t[0] === tipo) || TIPI_F[0])[2];
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['ars-atti', tipo, risposta, luogo, anno, firmatario, q, pag],
    placeholderData: keepPreviousData,
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      let r = supabase.from('ars_atti').select('k, tipo, n, titolo, data, firmatari, gruppo, luoghi, ha_risposta', { count: 'exact' }).in('tipo', tipi);
      if (risposta === 'si') r = r.eq('ha_risposta', true);
      if (risposta === 'no') r = r.eq('ha_risposta', false);
      if (luogo === 'Madonie') r = r.overlaps('luoghi', MADONIE);
      else if (luogo) r = r.contains('luoghi', [luogo]);
      if (anno) r = r.gte('data', `${anno}-01-01`).lte('data', `${anno}-12-31`);
      if (firmatario) r = r.contains('firmatari', [firmatario]);
      if (q) r = r.textSearch('fts', q, { config: 'ars_it', type: 'websearch' });
      r = r.order('data', { ascending: false, nullsFirst: false }).order('n', { ascending: false }).range(pag * PER_PAGINA, pag * PER_PAGINA + PER_PAGINA - 1);
      const { data: righe, count, error } = await r;
      if (error) throw error;
      return { righe: righe || [], count: count || 0 };
    },
  });
  const tot = data?.count || 0;
  const pagine = Math.ceil(tot / PER_PAGINA);

  return (
    <div className="view">
      <section>
        <div className="sec-h"><h1 style={{ fontSize: 'clamp(26px,5vw,40px)', textTransform: 'uppercase', fontWeight: 900 }}>Domande e proposte</h1></div>
        <p className="sub">Con un'<Termine k="interrogazione">interrogazione</Termine> o un'<Termine k="interpellanza">interpellanza</Termine> un deputato chiede conto al Governo regionale di un problema. Con una <Termine k="mozione">mozione</Termine> chiede all'Aula di impegnare il Governo. Con un <Termine k="ddl">disegno di legge</Termine> propone una legge.</p>
        <div className="filters">
          <div className="seg" role="group" aria-label="Tipo">
            {TIPI_F.map(([k, lab]) => <button key={k} type="button" aria-pressed={tipo === k} onClick={() => imposta('tipo', k === 'domande' ? '' : k)}>{lab}</button>)}
          </div>
          <form className="line" onSubmit={(e) => { e.preventDefault(); imposta('q', testo.trim()); }}>
            <div className="search-mini"><span aria-hidden="true">🔎</span><input type="search" value={testo} onChange={(e) => setTesto(e.target.value)} placeholder="Parole nel testo (es. ospedale Petralia, diga, strada 120)" aria-label="Cerca nel testo degli atti" /><button className="btn small" type="submit">Cerca</button></div>
          </form>
          <div className="line">
            <label>Paese o zona
              <select value={luogo} onChange={(e) => imposta('luogo', e.target.value)}>
                <option value="">Tutta la Sicilia</option>
                <option value="Madonie">Tutte le Madonie</option>
                {COMUNI.map((c) => <option key={c} value={c}>{c}</option>)}
                <option value="Piano Battaglia">Piano Battaglia</option>
                <option value="SS 120">Strada statale 120</option>
              </select>
            </label>
            {tipo !== 'D' && tipo !== 'M' &&
              <label>Risposta del Governo
                <select value={risposta} onChange={(e) => imposta('risposta', e.target.value)}>
                  <option value="">Tutte</option>
                  <option value="si">Ha avuto risposta</option>
                  <option value="no">Ancora senza risposta</option>
                </select>
              </label>}
            <label>Anno
              <select value={anno} onChange={(e) => imposta('anno', e.target.value)}>
                <option value="">Tutti</option>
                {ANNI.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </label>
          </div>
          {firmatario && <div className="line"><span className="pill blue">Firmate da {firmatario}</span><button type="button" className="linkbtn" onClick={() => imposta('firmatario', '')}>Togli</button></div>}
        </div>
      </section>

      <section style={{ display: 'grid', gap: 12 }}>
        <div className="toolbar">
          <span className="count" aria-live="polite">{isLoading ? 'Cerco…' : `${tot.toLocaleString('it-IT')} risultati${pagine > 1 ? ` · pagina ${pag + 1} di ${pagine}` : ''}`}</span>
          {luogo && <Avvisami chiave={`paese:${luogo}`} etichetta={`Avvisami per ${luogo === 'Madonie' ? 'le Madonie' : luogo}`} compatto testo={`Ti scriviamo quando all'ARS arriva un nuovo atto che nomina ${luogo === 'Madonie' ? 'le Madonie' : luogo}.`} />}
        </div>
        {isLoading ? <Caricamento righe={6} /> :
          tot === 0 ? <div className="empty">Nessun atto con questi filtri. Prova a togliere qualche filtro, oppure chiedi all'IA qui sopra.</div> :
            <div className="rows" style={{ opacity: isFetching ? 0.6 : 1 }}>{data.righe.map((a) => <AttoRiga key={a.k} a={a} />)}</div>}
        {pagine > 1 &&
          <div className="pager">
            <button type="button" className="btn ghost small" disabled={pag === 0} onClick={() => { imposta('pag', String(pag - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>← Precedenti</button>
            <button type="button" className="btn ghost small" disabled={pag + 1 >= pagine} onClick={() => { imposta('pag', String(pag + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Successivi →</button>
          </div>}
      </section>
      <div className="sources">Fonte: allegati agli ordini del giorno e resoconti delle sedute dell'ARS (XVIII legislatura, dal 10 novembre 2022). <Segnala pagina="/ars/domande" /></div>
    </div>);
}
