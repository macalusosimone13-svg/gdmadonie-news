import { useSyncExternalStore } from 'react';

// Destinazione della freccia "indietro" dell'header nelle pagine di dettaglio.
let target = null;
const subs = new Set();
export const setBackTarget = (t) => { if (t !== target) { target = t; subs.forEach((f) => f()); } };
export const useBackTarget = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => target);

const GD_CATS = ['comunicato', 'news_gd', 'proposta', 'approfondimento'];
export const sectionForPost = (post) => {
  if (!post) return null;
  if (post.source_type === 'gd_madonie' || GD_CATS.includes(post.category)) return '/gd-madonie';
  if (post.category === 'politica_nazionale') return '/rassegna-stampa/nazionale';
  if (post.category === 'politica_regionale') return '/rassegna-stampa/regionale';
  return '/rassegna-stampa';
};
