export const DEFAULT_UX_CONFIG = {
  key: 'main',
  primary_color: '#b91c1c',
  primary_fg: '#ffffff',
  background_color: '#ffffff',
  foreground_color: '#0f172a',
  card_bg_color: '#ffffff',
  accent_color: '#fbe2e8',
  accent_fg: '#8b1a1a',
  muted_bg_color: '#f5f5f5',
  muted_fg_color: '#6b6b6b',
  border_color: '#e5e5e5',
  header_bg_color: '#0F1B3A',
  header_fg_color: '#ffffff',
  heading_font: 'system',
  body_font: 'system',
  base_font_size: 16,
  card_radius: 12,
  shadow_style: 'none',
  show_banner: false,
  banner_text: '',
  show_categories: true,
  show_rassegna: true,
  team_cards_border: true,
  team_cards_bg_color: '',
  header_glow_enabled: false,
  header_glow_color: '#000000',
  home_title: '',
  home_subtitle: ''
};

export const FONT_STACKS = {
  system: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  helvetica: 'Helvetica, Arial, sans-serif'
};

export const SHADOW_PRESETS = {
  none: 'none',
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.06)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.10), 0 2px 4px -2px rgb(0 0 0 / 0.08)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.12), 0 4px 6px -4px rgb(0 0 0 / 0.10)'
};

function hexToHslChannels(hex) {
  if (!hex || typeof hex !== 'string') return null;
  const m = hex.replace('#', '').trim();
  if (m.length < 6) return null;
  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;
  if ([r, g, b].some(Number.isNaN)) return null;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (mx + mn) / 2;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

// Redesign: colori, font e raggi sono fissi nel CSS (redesign.css / index.css),
// cosi' la configurazione UX salvata nel database (condivisa col sito attuale)
// non li sovrascrive. Restano applicati solo i colori dell'header.
export function applyConfigToDom() {}
