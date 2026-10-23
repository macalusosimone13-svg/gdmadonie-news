import { NavLink, Outlet, useLocation, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { CasellaChiedi, Risposta } from '@/components/ars/Chiedi';
import '@/ars.css';

// Contenitore di tutte le pagine /ars: fascia blu con la ricerca IA e le
// schede, poi la pagina. La domanda all'IA sta nell'indirizzo (?chiedi=...)
// cosi' si puo' condividere e il tasto "indietro" funziona.

export function useUltimoControllo() {
  return useQuery({
    queryKey: ['ars-ultimo'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from('ars_meta').select('valore, updated_at').eq('chiave', 'ultimo_controllo').maybeSingle();
      return data?.valore?.at || data?.updated_at || null;
    },
  });
}

function quando(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const ore = (Date.now() - d.getTime()) / 3600_000;
  const ora = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' });
  if (ore < 20 && new Date().toDateString() === d.toDateString()) return `oggi alle ${ora}`;
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', timeZone: 'Europe/Rome' }) + ` alle ${ora}`;
}

const TABS = [
  ['/ars', 'Panoramica', true],
  ['/ars/leggi', 'Leggi'],
  ['/ars/domande', 'Domande al Governo'],
  ['/ars/aula', 'Aula e commissioni'],
  ['/ars/deputati', 'Deputati'],
];

export default function ArsLayout() {
  const loc = useLocation();
  const [sp, setSp] = useSearchParams();
  const domanda = sp.get('chiedi') || '';
  const { data: ultimo } = useUltimoControllo();
  const principale = loc.pathname === '/ars' || loc.pathname === '/ars/';
  const vecchio = ultimo && Date.now() - new Date(ultimo).getTime() > 6 * 3600_000;

  const chiedi = (q) => { const n = new URLSearchParams(sp); n.set('chiedi', q); setSp(n); };
  const chiudi = () => { const n = new URLSearchParams(sp); n.delete('chiedi'); setSp(n); };

  return (
    <div className="ars">
      <section className={`ars-hero${principale ? '' : ' compatta'}`}>
        <div className="wrap-a">
          <span className={`live${vecchio ? ' vecchio' : ''}`}><i /> Aggiornato in automatico dal sito dell'ARS{ultimo ? ` · ultimo controllo ${quando(ultimo)}` : ''}</span>
          {principale ? <h1>Cosa decide<br /><em>l'ARS</em></h1> : <div className="eyebrow" style={{ color: 'var(--a-on-navy-muted)' }}>Assemblea Regionale Siciliana</div>}
          {principale && <p className="ars-lead">Le leggi della Regione, i voti in Aula e le domande dei deputati al Governo, spiegati in parole semplici. Chiedi quello che vuoi: l'intelligenza artificiale cerca in tutti gli atti dal 2022 a oggi.</p>}
          <CasellaChiedi onChiedi={chiedi} iniziale={domanda} />
          <nav className="ars-tabs" aria-label="Sezione ARS">
            {TABS.map(([to, lab, end]) => <NavLink key={to} to={to} end={!!end} className={({ isActive }) => (isActive ? 'on' : '')}>{lab}</NavLink>)}
          </nav>
        </div>
      </section>
      <main className="wrap-a ars-main">
        {domanda && <div style={{ marginBottom: 28 }}><Risposta domanda={domanda} onChiudi={chiudi} /></div>}
        <Outlet />
      </main>
    </div>);
}
