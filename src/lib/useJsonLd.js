import { useEffect } from 'react';

// Inserisce/aggiorna un blocco JSON-LD (dati strutturati) nella pagina, cosi'
// Google puo' "capire" il contenuto (es. che una pagina descrive un sondaggio
// con certi dati) invece di doverlo indovinare dal solo testo visibile.
// Un solo blocco per pagina: se il componente cambia, il contenuto precedente
// viene sostituito, non accumulato.
export function useJsonLd(data) {
  useEffect(() => {
    if (!data) return;
    let el = document.head.querySelector('script[data-jsonld="page"]');
    if (!el) {
      el = document.createElement('script');
      el.type = 'application/ld+json';
      el.setAttribute('data-jsonld', 'page');
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(data);
    return () => {
      // Non lo rimuove allo smontaggio per evitare un lampo senza dati
      // durante il cambio pagina: la pagina successiva lo sovrascrive con
      // il proprio (o lo lascia, se non ne definisce uno — innocuo).
    };
  }, [data]);
}
