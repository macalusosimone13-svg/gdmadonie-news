import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { slugDeputato } from '@/lib/ars';

// Tutti i deputati della legislatura (in carica e non piu' in carica), con lo
// slug per l'indirizzo del profilo. Una sola richiesta, tenuta in memoria.
export function useDeputati() {
  return useQuery({
    queryKey: ['ars-deputati-tutti'],
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from('ars_deputati').select('*').order('nome');
      if (error) throw error;
      return (data || []).map((d) => ({ ...d, slug: slugDeputato(d.nome), gruppoNome: d.gruppo_breve || d.gruppo || 'Gruppo non indicato' }));
    },
  });
}

// L'incarico piu' importante da mostrare sulla scheda (uno solo).
const PRIORITA = [/^Presidente della Regione/i, /^Presidente dell'Assemblea/i, /^Assessore/i, /^Vicepresidente dell'Assemblea/i, /^Questore/i,
  /^Presidente della commissione/i, /^Presidente del gruppo/i, /^Vicepresidente della commissione/i, /^Segretario della commissione/i,
  /^Vicepresidente del gruppo/i, /^Componente della commissione/i];
export function incaricoPrincipale(ruoli) {
  const r = ruoli || [];
  for (const re of PRIORITA) {
    const x = r.find((v) => re.test(v));
    if (x) return x.replace(/^Componente della commissione /i, 'Commissione ');
  }
  return r[0] || '';
}
