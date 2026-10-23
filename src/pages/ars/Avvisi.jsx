import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useSEO } from '@/lib/useSEO';

// Conferma o cancellazione degli avvisi email della sezione ARS (link nelle email).
export default function Avvisi() {
  const [sp] = useSearchParams();
  const conferma = sp.get('conferma');
  const annulla = sp.get('annulla');
  const [stato, setStato] = useState('carico');
  const [cosa, setCosa] = useState('');
  useSEO({ title: 'Avvisi ARS — GD Madonie News', description: 'Conferma o cancella gli avvisi email della sezione ARS.', noindex: true });
  useEffect(() => {
    const token = conferma || annulla;
    if (!token) { setStato('vuoto'); return; }
    supabase.functions.invoke('ars-avvisi', { body: { azione: conferma ? 'conferma' : 'annulla', token } })
      .then(({ data, error }) => { setCosa(data?.cosa || ''); setStato(!error && data?.ok ? (conferma ? 'confermato' : 'annullato') : 'errore'); })
      .catch(() => setStato('errore'));
  }, [conferma, annulla]);
  return (
    <div className="view">
      <section className="panel" style={{ maxWidth: 640 }}>
        <h2>Avvisi dall'ARS</h2>
        {stato === 'carico' && <div className="thinking"><i /> Un attimo…</div>}
        {stato === 'confermato' && <p>Fatto: avviso attivo{cosa ? ` (${cosa})` : ''}. Ti scriveremo solo quando c'è una novità. In ogni email trovi il link per cancellarti.</p>}
        {stato === 'annullato' && <p>Fatto: non riceverai più questo avviso{cosa ? ` (${cosa})` : ''}.</p>}
        {stato === 'errore' && <p>Il link non è valido o è scaduto. Puoi iscriverti di nuovo dalle pagine della sezione ARS.</p>}
        {stato === 'vuoto' && <p>Da qui confermi o cancelli gli avvisi email: usa il link che trovi nell'email.</p>}
        <Link to="/ars" className="btn small">Vai alla sezione ARS</Link>
      </section>
    </div>);
}
