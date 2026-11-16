import { useEffect, useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";
import { registraVoce } from "@/lib/indietro";

// Gestisce lo scorrimento della pagina quando si cambia pagina:
// - pagina nuova (link): si parte dall'alto (o dall'ancora #...);
// - tasto indietro/avanti (del sito, del browser o del telefono): si torna
//   esattamente al punto in cui si era, anche se la pagina deve ancora
//   caricare le notizie (si aspetta che siano disegnate).
// Il punto di ogni passo della cronologia viene salvato mentre si scorre.

const STORE = "gd_scroll_v1";
let posizioni = null;
const tutte = () => {
  if (!posizioni) {
    try { posizioni = JSON.parse(sessionStorage.getItem(STORE)) || {}; } catch { posizioni = {}; }
  }
  return posizioni;
};
let timerSalva = null;
const salva = () => {
  clearTimeout(timerSalva);
  timerSalva = setTimeout(() => {
    try {
      const p = tutte();
      const chiavi = Object.keys(p);
      if (chiavi.length > 150) for (const k of chiavi.slice(0, chiavi.length - 150)) delete p[k];
      sessionStorage.setItem(STORE, JSON.stringify(p));
    } catch { /* niente */ }
  }, 200);
};

const getHashId = (hash) => {
  const rawId = hash.slice(1);
  try { return decodeURIComponent(rawId); } catch { return rawId; }
};

const vaiA = (y) => window.scrollTo({ top: y, left: 0, behavior: "instant" });

export default function ScrollToTop() {
  const { pathname, search, hash, key } = useLocation();
  const navigationType = useNavigationType();
  const id = `${key}|${pathname}${search}`;
  const idRef = useRef(id);
  const prevPath = useRef(null);

  // Il browser proverebbe a ripristinare da solo il punto, ma lo fa prima
  // che le notizie siano caricate: lo gestiamo noi.
  useEffect(() => {
    try { if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual"; } catch { /* niente */ }
    const onScroll = () => { tutte()[idRef.current] = Math.round(window.scrollY); salva(); };
    const subito = () => { clearTimeout(timerSalva); try { sessionStorage.setItem(STORE, JSON.stringify(tutte())); } catch { /* niente */ } };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", subito);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("pagehide", subito); };
  }, []);

  useLayoutEffect(() => {
    const prima = prevPath.current;
    prevPath.current = pathname;
    idRef.current = id;
    registraVoce(navigationType, pathname + search);

    if (navigationType !== "POP") {
      // Stessa pagina, cambia solo un filtro nell'indirizzo: si resta dove si e'.
      if (prima === pathname && !hash) { tutte()[id] = Math.round(window.scrollY); salva(); return; }
      if (hash) {
        const t = window.setTimeout(() => { document.getElementById(getHashId(hash))?.scrollIntoView({ behavior: "smooth" }); }, 50);
        return () => window.clearTimeout(t);
      }
      vaiA(0);
      return;
    }

    // Indietro / avanti: si torna al punto salvato.
    const target = tutte()[id] || 0;
    if (target <= 0) { vaiA(0); return; }

    let finito = false;
    let raf = 0;
    const inizio = performance.now();
    let ultimaAltezza = -1;
    let stabileDa = inizio;
    const stop = () => {
      if (finito) return;
      finito = true;
      cancelAnimationFrame(raf);
      for (const ev of ["wheel", "touchstart", "keydown", "mousedown"]) window.removeEventListener(ev, stop);
    };
    // Se l'utente tocca o scorre, si smette subito di riportarlo al punto.
    for (const ev of ["wheel", "touchstart", "keydown", "mousedown"]) window.addEventListener(ev, stop, { passive: true });

    const passo = () => {
      if (finito) return;
      const ora = performance.now();
      const altezza = document.documentElement.scrollHeight;
      if (altezza !== ultimaAltezza) { ultimaAltezza = altezza; stabileDa = ora; }
      const massimo = altezza - window.innerHeight;
      if (massimo >= target - 2 && Math.abs(window.scrollY - target) > 2) vaiA(target);
      const arrivato = Math.abs(window.scrollY - target) <= 2;
      // Ci si ferma quando si e' arrivati e la pagina non cambia piu'
      // (immagini e notizie caricate), o dopo 6 secondi al massimo.
      if ((arrivato && ora - stabileDa > 700) || ora - inizio > 6000) { stop(); return; }
      raf = requestAnimationFrame(passo);
    };
    passo();
    return stop;
  }, [id, navigationType, pathname, search, hash]);

  return null;
}
