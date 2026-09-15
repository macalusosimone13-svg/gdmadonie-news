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

export function applyConfigToDom(cfg) {
  if (!cfg || typeof document === 'undefined') return;
  const root = document.documentElement;

  // Themeable colors that have a dark-mode counterpart in index.css are scoped
  // to light mode only — otherwise the inline values would override the .dark
  // token set and the theme switch would have no visible effect.
  const lightDecls = [];
  const pushHsl = (varName, hex) => {
    const ch = hexToHslChannels(hex);
    if (ch) lightDecls.push(`${varName}: ${ch};`);
  };
  pushHsl('--primary', cfg.primary_color);
  pushHsl('--primary-foreground', cfg.primary_fg);
  pushHsl('--background', cfg.background_color);
  pushHsl('--foreground', cfg.foreground_color);
  pushHsl('--card', cfg.card_bg_color);
  pushHsl('--card-foreground', cfg.foreground_color);
  pushHsl('--accent', cfg.accent_color);
  pushHsl('--accent-foreground', cfg.accent_fg);
  pushHsl('--muted', cfg.muted_bg_color);
  pushHsl('--muted-foreground', cfg.muted_fg_color);
  pushHsl('--border', cfg.border_color);
  pushHsl('--input', cfg.border_color);
  pushHsl('--ring', cfg.primary_color);

  let vars = document.getElementById('ux-vars-style');
  if (!vars) {
    vars = document.createElement('style');
    vars.id = 'ux-vars-style';
    document.head.appendChild(vars);
  }
  vars.textContent = `:root:not(.dark) { ${lightDecls.join(' ')} }`;

  // Brand header colors have no dark equivalent — always apply.
  const setHsl = (varName, hex) => {
    const ch = hexToHslChannels(hex);
    if (ch) root.style.setProperty(varName, ch);
  };
  setHsl('--header-bg', cfg.header_bg_color);
  setHsl('--header-fg', cfg.header_fg_color);

  if (cfg.base_font_size) root.style.fontSize = `${cfg.base_font_size}px`;
  if (cfg.heading_font && FONT_STACKS[cfg.heading_font]) root.style.setProperty('--font-heading', FONT_STACKS[cfg.heading_font]);
  if (cfg.body_font && FONT_STACKS[cfg.body_font]) root.style.setProperty('--font-body', FONT_STACKS[cfg.body_font]);

  let dyn = document.getElementById('ux-dynamic-style');
  if (!dyn) {
    dyn = document.createElement('style');
    dyn.id = 'ux-dynamic-style';
    document.head.appendChild(dyn);
  }
  const r = ((cfg.card_radius ?? 12) || 0) / 16;
  const shadow = SHADOW_PRESETS[cfg.shadow_style] || SHADOW_PRESETS.none;
  dyn.textContent = `
    .rounded-xl { border-radius: ${r}rem !important; }
    .rounded-2xl { border-radius: calc(${r}rem + 4px) !important; }
    .bg-card { box-shadow: ${shadow} !important; }
  `;
}
