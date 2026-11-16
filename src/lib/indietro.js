import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';

// Tutto quello che serve perche' "indietro" riporti esattamente dove si era:
// stessa pagina, stessi filtri, stessa pagina dell'elenco, stesso punto.
//
// Ogni passo della cronologia del browser ha una sua chiave (location.key).
// Qui si salvano, per quella chiave, i filtri scelti (useStatoIndietro) e
// l'indirizzo visitato (registraVoce), in sessionStorage: restano finche'
// la scheda e' aperta, anche se si ricarica la pagina.

const PREFISSO = 'gd_st:';
const VOCI = 'gd_voci_v1';

const leggi = (k) => {
  try { const v = sessionStorage.getItem(k); return v == null ? undefined : JSON.parse(v); } catch { return undefined; }
};
const scrivi = (k, v) => {
  try { sessionStorage.setItem(k, JSON.stringify(v)); } catch { /* spazio pieno o modalita' privata: pazienza */ }
};

// Posizione nella cronologia (0 = prima pagina aperta nel sito in questa scheda).
export const indiceCronologia = () => {
  try { return Number(window.history.state?.idx) || 0; } catch { return 0; }
};

// Si ricorda quale indirizzo c'e' a ogni posizione della cronologia, per
// sapere qual e' la pagina "precedente". Chiamata da ScrollToTop a ogni
// cambio di pagina.
export function registraVoce(tipo, indirizzo) {
  const idx = indiceCronologia();
  let voci = leggi(VOCI);
  if (!Array.isArray(voci)) voci = [];
  // Una pagina nuova (PUSH) cancella le pagine "in avanti" rimaste.
  if (tipo === 'PUSH') voci = voci.slice(0, idx);
  voci[idx] = indirizzo;
  scrivi(VOCI, voci.slice(0, 300));
}

export function paginaPrecedente() {
  const idx = indiceCronologia();
  if (idx <= 0) return null;
  const voci = leggi(VOCI);
  return Array.isArray(voci) ? voci[idx - 1] || null : null;
}

const soloPercorso = (s) => String(s || '').split(/[?#]/)[0].replace(/\/+$/, '') || '/';

// Restituisce una funzione da usare sui link "torna a ...": se la pagina
// precedente e' proprio quella di destinazione si torna indietro nella
// cronologia (cosi' si ritrovano filtri e punto della pagina), altrimenti
// il link funziona normalmente.
export function useLinkIndietro() {
  const navigate = useNavigate();
  return useCallback((e, to) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const prec = paginaPrecedente();
    if (prec && soloPercorso(prec) === soloPercorso(to)) {
      e.preventDefault();
      navigate(-1);
    }
  }, [navigate]);
}

// Come useState, ma il valore resta legato a questo passo della cronologia:
// se si apre una notizia e poi si torna indietro, il filtro (o la pagina
// dell'elenco) e' ancora quello scelto. Aprendo la pagina da un link nuovo,
// invece, si riparte dal valore iniziale.
export function useStatoIndietro(nome, iniziale) {
  const { key, pathname } = useLocation();
  const id = `${PREFISSO}${key}|${pathname}|${nome}`;
  const valoreIniziale = () => {
    const salvato = leggi(id);
    if (salvato !== undefined) return salvato;
    return typeof iniziale === 'function' ? iniziale() : iniziale;
  };
  const tipoNav = useNavigationType();
  const [stato, setStato] = useState(() => ({ id, percorso: pathname, v: valoreIniziale(), toccato: false }));

  // Cambiato passo della cronologia senza smontare la pagina.
  // - Stessa pagina, cambia solo un parametro (es. si apre l'assistente
  //   dell'ARS): si tiene la scelta fatta.
  // - Altra pagina (es. da Nazionale a Regionale) o tasto indietro/avanti:
  //   si rilegge il valore giusto per quel passo.
  let attuale = stato;
  if (stato.id !== id) {
    const stessaPagina = stato.percorso === pathname && tipoNav !== 'POP';
    attuale = stessaPagina
      ? { id, percorso: pathname, v: stato.v, toccato: true }
      : { id, percorso: pathname, v: valoreIniziale(), toccato: false };
    setStato(attuale);
  }

  useEffect(() => {
    if (stato.toccato) scrivi(stato.id, stato.v);
  }, [stato]);

  const imposta = useCallback((agg) => {
    setStato((s) => ({ ...s, v: typeof agg === 'function' ? agg(s.v) : agg, toccato: true }));
  }, []);

  return [attuale.v, imposta];
}

// Porta in cima alla pagina (o all'inizio di un elenco, se si passa
// l'id dell'elemento) dopo un cambio di pagina dell'elenco.
// Si aspetta che il nuovo elenco sia disegnato: sul telefono lo
// scorrimento "morbido" lanciato mentre la pagina cambia veniva annullato
// e si restava in fondo. Sui touch si salta subito al punto giusto.
export function scrollaInCima(idElemento) {
  const vai = () => {
    const touch = typeof window.matchMedia === 'function' && window.matchMedia('(hover: none), (pointer: coarse)').matches;
    const el = idElemento ? document.getElementById(idElemento) : null;
    const top = el ? Math.max(0, el.getBoundingClientRect().top + window.scrollY - 90) : 0;
    window.scrollTo({ top, left: 0, behavior: touch ? 'instant' : 'smooth' });
  };
  requestAnimationFrame(() => requestAnimationFrame(vai));
}
