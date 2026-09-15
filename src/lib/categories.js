export const CATEGORIES = {
  comunicato: { label: 'Comunicato GD', badge: 'bg-[#ff7024] text-white', group: 'gd' },
  news_gd: { label: 'News GD', badge: 'bg-emerald-600 text-white', group: 'gd' },
  proposta: { label: 'Proposta', badge: 'bg-[#ff7024] text-white', group: 'gd' },
  approfondimento: { label: 'Approfondimento', badge: 'bg-amber-600 text-white', group: 'gd' },
  politica_nazionale: { label: 'Politica Naz.', badge: 'bg-blue-700 text-white', group: 'rassegna' },
  politica_regionale: { label: 'Politica Reg.', badge: 'bg-sky-600 text-white', group: 'rassegna' },
  rassegna_stampa: { label: 'Rassegna', badge: 'bg-slate-500 text-white', group: 'rassegna' },
};

// Risolve l'etichetta di una categoria: usa l'override salvato in SiteContent
// (modificabile da admin) o il valore predefinito di CATEGORIES.
export function getCategoryLabel(content, categoryKey) {
  const cat = CATEGORIES[categoryKey];
  if (!cat) return categoryKey;
  const override = content?.[`category_label_${categoryKey}`];
  return override && override.trim() !== '' ? override : cat.label;
}

export const GD_CATEGORIES = ['comunicato', 'news_gd', 'proposta', 'approfondimento'];
export const RASSEGNA_CATEGORIES = ['politica_nazionale', 'politica_regionale', 'rassegna_stampa'];

export const SOURCE_LIST = [
  { key: 'ANSA Politica', label: 'ANSA Politica' },
  { key: 'Repubblica Politica', label: 'Repubblica' },
  { key: 'Il Fatto Quotidiano', label: 'Il Fatto' },
  { key: 'AGI', label: 'AGI' },
  { key: 'AdnKronos', label: 'AdnKronos' },
  { key: 'ANSA Europa', label: 'ANSA Europa' },
  { key: 'Il Manifesto', label: 'Il Manifesto' },
  { key: 'Linkiesta', label: 'Linkiesta' },
  { key: 'ANSA Sicilia', label: 'ANSA Sicilia' },
  { key: 'LiveSicilia', label: 'LiveSicilia' },
  { key: 'Madonie Press', label: 'Madonie Press' },
  { key: 'Castelbuono Live', label: 'Castelbuono Live' },
  { key: 'Espero News', label: 'Espero' },
];
