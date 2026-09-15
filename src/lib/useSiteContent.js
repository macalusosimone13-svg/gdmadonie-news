import { useQuery } from '@tanstack/react-query';
import { loadSiteContent } from '@/lib/siteContent';

// Hook condiviso per i testi del sito modificabili da admin (entità SiteContent).
// TanStack Query deduplica le richieste e tiene in cache i valori.
export function useSiteContent() {
  return useQuery({
    queryKey: ['site-content'],
    queryFn: loadSiteContent,
    staleTime: 5 * 60 * 1000,
  });
}
