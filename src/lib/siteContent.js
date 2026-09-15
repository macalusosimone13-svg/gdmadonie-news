import { sb44 } from '@/api/supabaseEntities';

// Testi del sito modificabili da admin. Restituisce un dict key -> value.
export async function loadSiteContent() {
  try {
    const data = await sb44.entities.SiteContent.list();
    const map = {};
    (data || []).forEach((c) => { map[c.key] = c.value; });
    return map;
  } catch {
    return {};
  }
}

// Valori predefiniti usati quando un testo non è ancora stato configurato.
export const CONTENT_DEFAULTS = {
  site_logo_url: 'https://base44.app/api/apps/6a81b39b7d72fb1a125621b0/files/mp/public/6a81b39b7d72fb1a125621b0/a29952401_LogoGDMadonieconramodolivo2.png',
  gd_title: 'GD Madonie',
  gd_subtitle: 'Attività, proposte e iniziative del circolo',
  gd_description: 'Il circolo territoriale dei Giovani Democratici della zona delle Madonie. Ci occupiamo di politiche per le aree interne, spopolamento, sanità territoriale, infrastrutture digitali e gestione faunistica, con attenzione alla politica locale e regionale siciliana.',
  org_segretario: 'Simone Macaluso',
  org_vicesegretario: 'Filippo Fiorentino',
  org_resp_comunicazione: '—',
  org_tesoriere: '—',
  category_label_comunicato: 'Comunicato GD',
  category_label_news_gd: 'News GD',
  category_label_proposta: 'Proposta',
  category_label_approfondimento: 'Approfondimento',
  category_label_politica_nazionale: 'Politica Naz.',
  category_label_politica_regionale: 'Politica Reg.',
  category_label_rassegna_stampa: 'Rassegna',
  team_related_label: 'Altri profili'
};

export function getContent(content, key) {
  const v = content?.[key];
  return v && v.trim() !== '' ? v : CONTENT_DEFAULTS[key];
}
