import { useState } from 'react';
import { useUxConfig } from '@/lib/UxConfigContext';
import { toast } from '@/components/ui/use-toast';
import { Save, RotateCcw, Loader2 } from 'lucide-react';

const FONT_OPTIONS = [
  { value: 'system', label: 'System (sans-serif)' },
  { value: 'serif', label: 'Serif (Georgia)' },
  { value: 'helvetica', label: 'Helvetica / Arial' }
];
const SHADOW_OPTIONS = [
  { value: 'none', label: 'Nessuna' },
  { value: 'sm', label: 'Leggera' },
  { value: 'md', label: 'Media' },
  { value: 'lg', label: 'Forte' }
];

function ColorRow({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm text-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <input type="color" value={value || '#000000'} onChange={(e) => onChange(e.target.value)} className="w-9 h-9 rounded-full border border-border bg-transparent cursor-pointer p-0" aria-label={label} />
        <input type="text" value={value || ''} onChange={(e) => onChange(e.target.value)} className="w-24 text-xs px-2 py-1.5 border border-border rounded-md bg-card text-foreground" />
      </div>
    </div>
  );
}

function relLuminance(hex) {
  const m = (hex || '').replace('#', '');
  if (m.length < 6) return null;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(m.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  if ([r, g, b].some(Number.isNaN)) return null;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrastRatio(hex1, hex2) {
  const l1 = relLuminance(hex1);
  const l2 = relLuminance(hex2);
  if (l1 == null || l2 == null) return null;
  const [lighter, darker] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (lighter + 0.05) / (darker + 0.05);
}
function ContrastWarning({ fg, bg, label }) {
  const ratio = contrastRatio(fg, bg);
  if (ratio == null || ratio >= 4.5) return null;
  return (
    <p className="text-xs text-amber-700 bg-amber-50 rounded-md px-2.5 py-1.5 -mt-1">
      Contrasto basso ({ratio.toFixed(1)}:1) tra {label} — rischia di essere poco leggibile. Consigliato almeno 4,5:1.
    </p>);

}

function ToggleRow({ label, value, onChange }) {
  return (
    <button type="button" onClick={() => onChange(!value)} className="flex items-center justify-between gap-3 w-full py-2 text-left">
      <span className="text-sm text-foreground">{label}</span>
      <span className={`relative w-11 h-6 rounded-full transition-colors ${value ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-5' : ''}`} />
      </span>
    </button>
  );
}

function Section({ title, children }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <h3 className="font-semibold text-foreground mb-2 text-sm">{title}</h3>
      <div className="divide-y divide-border">{children}</div>
    </div>
  );
}

function SelectRow({ label, value, options, onChange }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="text-sm text-foreground">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="text-sm px-2 py-1.5 border border-border rounded-md bg-card text-foreground max-w-[55%]">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function TextRow({ label, value, placeholder, onChange }) {
  return (
    <div className="py-2 space-y-1.5">
      <label className="text-sm text-foreground">{label}</label>
      <input type="text" value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full text-sm px-3 py-2 border border-border rounded-md bg-card text-foreground" />
    </div>
  );
}

export default function UxDesignManager() {
  const { config, update, save, reset } = useUxConfig();
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await save();
      toast({ title: 'Configurazione salvata', description: "Le modifiche sono attive sull'intera app." });
    } catch (e) {
      toast({ title: 'Errore', description: e.message || 'Salvataggio non riuscito', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    try {
      await reset();
      toast({ title: 'Ripristinato', description: 'Valori predefiniti ripristinati e salvati.' });
    } catch (e) {
      toast({ title: 'Errore', description: e.message || 'Ripristino non riuscito', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-semibold text-foreground">Personalizzazione UX / Design</h3>
          <p className="text-sm text-muted-foreground">Modifica colori, font, layout e testi. Le modifiche si applicano in tempo reale all'interfaccia.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleReset} className="flex items-center gap-1.5 text-sm border border-border px-3 py-2.5 min-h-[44px] rounded-xl hover:bg-muted">
            <RotateCcw className="w-4 h-4" /> Ripristina Default
          </button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2.5 min-h-[44px] rounded-xl text-sm font-medium disabled:opacity-60">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salva Configurazione
          </button>
        </div>
      </div>

      <Section title="Tavolozza Colori">
        <ColorRow label="Colore primario" value={config.primary_color} onChange={(v) => update({ primary_color: v })} />
        <ColorRow label="Testo su primario" value={config.primary_fg} onChange={(v) => update({ primary_fg: v })} />
        <ContrastWarning fg={config.primary_fg} bg={config.primary_color} label="testo su primario / primario" />
        <ColorRow label="Sfondo app" value={config.background_color} onChange={(v) => update({ background_color: v })} />
        <ColorRow label="Testo principale" value={config.foreground_color} onChange={(v) => update({ foreground_color: v })} />
        <ContrastWarning fg={config.foreground_color} bg={config.background_color} label="testo principale / sfondo app" />
        <ColorRow label="Sfondo card" value={config.card_bg_color} onChange={(v) => update({ card_bg_color: v })} />
        <ContrastWarning fg={config.foreground_color} bg={config.card_bg_color} label="testo principale / sfondo card" />
        <ColorRow label="Colore accento" value={config.accent_color} onChange={(v) => update({ accent_color: v })} />
        <ColorRow label="Testo accento" value={config.accent_fg} onChange={(v) => update({ accent_fg: v })} />
        <ContrastWarning fg={config.accent_fg} bg={config.accent_color} label="testo accento / accento" />
        <ColorRow label="Sfondo neutro (muted)" value={config.muted_bg_color} onChange={(v) => update({ muted_bg_color: v })} />
        <ColorRow label="Testo neutro" value={config.muted_fg_color} onChange={(v) => update({ muted_fg_color: v })} />
        <ContrastWarning fg={config.muted_fg_color} bg={config.muted_bg_color} label="testo neutro / sfondo neutro" />
        <ColorRow label="Bordi" value={config.border_color} onChange={(v) => update({ border_color: v })} />
        <ColorRow label="Sfondo header/navbar" value={config.header_bg_color} onChange={(v) => update({ header_bg_color: v })} />
        <ColorRow label="Testo header/navbar" value={config.header_fg_color} onChange={(v) => update({ header_fg_color: v })} />
        <ContrastWarning fg={config.header_fg_color} bg={config.header_bg_color} label="testo header / sfondo header" />
      </Section>

      <Section title="Tipografia">
        <SelectRow label="Font titoli" value={config.heading_font} options={FONT_OPTIONS} onChange={(v) => update({ heading_font: v })} />
        <SelectRow label="Font testo" value={config.body_font} options={FONT_OPTIONS} onChange={(v) => update({ body_font: v })} />
        <div className="flex items-center justify-between gap-3 py-2">
          <span className="text-sm text-foreground">Dimensione testo base (px)</span>
          <input type="number" min="12" max="22" value={config.base_font_size} onChange={(e) => update({ base_font_size: Number(e.target.value) })} className="w-20 text-sm px-2 py-1.5 border border-border rounded-md bg-card text-foreground" />
        </div>
      </Section>

      <Section title="Layout e Stili">
        <div className="flex items-center justify-between gap-3 py-2">
          <span className="text-sm text-foreground">Raggio bordi card (px)</span>
          <input type="number" min="0" max="32" value={config.card_radius} onChange={(e) => update({ card_radius: Number(e.target.value) })} className="w-20 text-sm px-2 py-1.5 border border-border rounded-md bg-card text-foreground" />
        </div>
        <SelectRow label="Ombreggiatura card" value={config.shadow_style} options={SHADOW_OPTIONS} onChange={(v) => update({ shadow_style: v })} />
      </Section>

      <Section title="Visibilità e Moduli">
        <ToggleRow label="Mostra banner in alto" value={config.show_banner} onChange={(v) => update({ show_banner: v })} />
        <ToggleRow label="Mostra filtri categoria (Home)" value={config.show_categories} onChange={(v) => update({ show_categories: v })} />
        <ToggleRow label="Mostra Rassegna Stampa in navigazione" value={config.show_rassegna} onChange={(v) => update({ show_rassegna: v })} />
        <ToggleRow label='Contorno schede "In evidenza" (Home)' value={config.team_cards_border} onChange={(v) => update({ team_cards_border: v })} />
        <div className="flex items-center justify-between gap-3 py-1.5">
          <span className="text-sm text-foreground">Sfondo schede "In evidenza" (Home)</span>
          <div className="flex items-center gap-2">
            <input type="color" value={config.team_cards_bg_color || '#ffffff'} onChange={(e) => update({ team_cards_bg_color: e.target.value })} className="w-9 h-9 rounded-full border border-border bg-transparent cursor-pointer p-0" aria-label='Sfondo schede "In evidenza"' />
            <input type="text" value={config.team_cards_bg_color || ''} onChange={(e) => update({ team_cards_bg_color: e.target.value })} placeholder="Trasparente" className="w-24 text-xs px-2 py-1.5 border border-border rounded-md bg-card text-foreground" />
            {config.team_cards_bg_color &&
            <button type="button" onClick={() => update({ team_cards_bg_color: '' })} className="text-xs text-muted-foreground hover:text-red-600 underline">Svuota</button>
            }
          </div>
        </div>
      </Section>

      <Section title="Header trasparente (Home)">
        <ToggleRow label="Sfumatura di contrasto sotto logo/pulsanti" value={config.header_glow_enabled} onChange={(v) => update({ header_glow_enabled: v })} />
        <ColorRow label="Colore sfumatura" value={config.header_glow_color} onChange={(v) => update({ header_glow_color: v })} />
      </Section>

      <Section title="Testi e Microcopy">
        <TextRow label="Testo banner" value={config.banner_text} placeholder="Es: Iscriviti al prossimo evento!" onChange={(v) => update({ banner_text: v })} />
        <TextRow label="Titolo Home" value={config.home_title} placeholder="Ultime Notizie" onChange={(v) => update({ home_title: v })} />
        <TextRow label="Sottotitolo Home" value={config.home_subtitle} placeholder="Politica nazionale, regionale e le attività del circolo" onChange={(v) => update({ home_subtitle: v })} />
      </Section>
    </div>
  );
}
