import { useEffect, useRef, useState } from 'react';
import { uploadFile } from '@/lib/uploadFile';
import { sb44 } from '@/api/supabaseEntities';
import { buildStoryBlob, STORY_DEFAULTS } from '@/lib/storyImage';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Upload, X } from 'lucide-react';

function ColorField({ label, value, onChange }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <input type="color" value={value || '#000000'} onChange={(e) => onChange(e.target.value)} className="w-9 h-9 rounded-full border border-border bg-transparent cursor-pointer p-0" />
        <Input value={value || ''} onChange={(e) => onChange(e.target.value)} className="text-xs" />
      </div>
    </div>);

}

function ToggleRow({ label, value, onChange }) {
  return (
    <label className="flex items-center justify-between gap-3 py-1 cursor-pointer">
      <span className="text-sm text-foreground">{label}</span>
      <input type="checkbox" checked={value !== false} onChange={(e) => onChange(e.target.checked)} className="w-5 h-5 accent-primary" />
    </label>);

}

export default function StoryShareConfigManager() {
  const [form, setForm] = useState({ ...STORY_DEFAULTS, id: null });
  const [siteLogo, setSiteLogo] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saveTimer, setSaveTimer] = useState(null);
  const [saved, setSaved] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewFormat, setPreviewFormat] = useState('story');
  const previewObjectUrl = useRef(null);

  useEffect(() => {
    Promise.all([
    sb44.entities.StoryShareConfig.filter({ key: 'main' }, '-updated_date', 1),
    sb44.entities.SiteContent.filter({ key: 'site_logo_url' }, '-updated_date', 1)]
    ).then(([configs, logos]) => {
      if (configs?.[0]) setForm({ ...STORY_DEFAULTS, ...configs[0] });
      setSiteLogo(logos?.[0]?.value || '');
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const set = (key, value) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (saveTimer) clearTimeout(saveTimer);
      const t = setTimeout(async () => {
        const { id, ...payload } = next;
        try {
          if (id) await sb44.entities.StoryShareConfig.update(id, payload);
          else {
            const created = await sb44.entities.StoryShareConfig.create({ ...payload, key: 'main' });
            setForm((p) => ({ ...p, id: created.id }));
          }
          setSaved(true);
          setTimeout(() => setSaved(false), 1500);
        } catch {}
      }, 500);
      setSaveTimer(t);
      return next;
    });
  };

  const uploadLogo = async (file) => {
    setUploading(true);
    try {
      const res = await uploadFile(file);
      set('logo_url', res.file_url);
    } catch {
      alert('Caricamento fallito');
    }
    setUploading(false);
  };

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const blob = await buildStoryBlob({
          format: previewFormat,
          category: 'Comunicato GD',
          title: 'Titolo di esempio del comunicato',
          bodyText: 'Questo è un estratto di esempio, così vedi come appare il testo quando il comunicato non ha una foto: titolo ed estratto prendono più spazio possibile.',
          domain: form.domain_text_gd,
          primaryColor: '#0F1B3A',
          logoUrl: form.logo_url || siteLogo,
          brandTitle: form.brand_title,
          brandSubtitle: form.brand_subtitle,
          bgGradientStart: form.bg_gradient_start,
          bgGradientEnd: form.bg_gradient_end,
          categoryBg: form.category_bg_color,
          categoryText: form.category_text_color,
          titleColor: form.title_color,
          overlayIntensity: form.overlay_intensity,
          showCategory: form.show_category,
          showDomain: form.show_domain,
          topBandEnabled: form.top_band_enabled,
          topBandColor: form.top_band_color,
          topBandOpacity: form.top_band_opacity,
          logoSize: form.logo_size,
          categoryGap: form.category_gap
        });
        if (cancelled) return;
        if (previewObjectUrl.current) URL.revokeObjectURL(previewObjectUrl.current);
        const url = URL.createObjectURL(blob);
        previewObjectUrl.current = url;
        setPreviewUrl(url);
      } catch {}
    }, 400);
    return () => {cancelled = true;clearTimeout(t);};
  }, [
  form.domain_text_gd, form.logo_url, form.brand_title, form.brand_subtitle,
  form.bg_gradient_start, form.bg_gradient_end, form.category_bg_color,
  form.category_text_color, form.title_color, form.overlay_intensity,
  form.show_category, form.show_domain, form.top_band_enabled,
  form.top_band_color, form.top_band_opacity, form.logo_size, form.category_gap, previewFormat, siteLogo]
  );

  if (loading) return <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />;

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="space-y-4">
        <div>
          <h3 className="font-semibold text-foreground text-sm">Storia Instagram/Facebook</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Personalizza l'immagine generata quando qualcuno condivide una notizia come storia. Ogni modifica si salva da sola.</p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Titolo marchio</Label>
          <Input value={form.brand_title} onChange={(e) => set('brand_title', e.target.value)} placeholder="Madonie News" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Sottotitolo marchio</Label>
          <Input value={form.brand_subtitle} onChange={(e) => set('brand_subtitle', e.target.value)} placeholder="Giovani Democratici Madonie" />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Logo per la storia (vuoto = usa il logo generale del sito)</Label>
          <div className="flex items-center gap-3">
            {(form.logo_url || siteLogo) && <img src={form.logo_url || siteLogo} alt="" className="w-14 h-14 rounded-xl object-contain bg-muted border border-border" />}
            <label className="flex items-center gap-2 border border-dashed border-border rounded-xl px-4 py-2.5 cursor-pointer text-sm text-muted-foreground hover:bg-muted min-h-[44px]">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Carica logo
              <input type="file" accept="image/*" className="hidden" onChange={(e) => {if (e.target.files?.[0]) uploadLogo(e.target.files[0]);e.target.value = '';}} />
            </label>
            {form.logo_url &&
            <button type="button" onClick={() => set('logo_url', '')} aria-label="Rimuovi, torna al logo del sito" className="text-muted-foreground hover:text-red-600 p-2"><X className="w-4 h-4" /></button>
            }
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Dimensione logo</Label>
          <div className="flex items-center gap-2">
            <input type="range" min={80} max={260} step={4} value={form.logo_size} onChange={(e) => set('logo_size', Number(e.target.value))} className="flex-1 accent-primary" />
            <span className="text-xs text-muted-foreground w-12 text-right">{form.logo_size}px</span>
          </div>
        </div>

        <div className="pt-2 border-t border-border space-y-1">
          <ToggleRow label="Mostra etichetta categoria" value={form.show_category} onChange={(v) => set('show_category', v)} />
          <ToggleRow label="Mostra testo in basso (dominio/fonte)" value={form.show_domain} onChange={(v) => set('show_domain', v)} />
          <ToggleRow label="Fascia semi-trasparente dietro al logo" value={form.top_band_enabled} onChange={(v) => set('top_band_enabled', v)} />
        </div>

        {form.top_band_enabled &&
        <div className="grid grid-cols-2 gap-3 pl-2 border-l-2 border-border">
            <ColorField label="Colore fascia" value={form.top_band_color} onChange={(v) => set('top_band_color', v)} />
            <div className="space-y-1.5">
              <Label className="text-xs">Opacità fascia</Label>
              <div className="flex items-center gap-2">
                <input type="range" min={0} max={1} step={0.05} value={form.top_band_opacity} onChange={(e) => set('top_band_opacity', Number(e.target.value))} className="flex-1 accent-primary" />
                <span className="text-xs text-muted-foreground w-10 text-right">{Math.round(form.top_band_opacity * 100)}%</span>
              </div>
            </div>
          </div>
        }

        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
          <ColorField label="Titolo - colore testo" value={form.title_color} onChange={(v) => set('title_color', v)} />
          <div />
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
          <ColorField label="Etichetta categoria - sfondo" value={form.category_bg_color} onChange={(v) => set('category_bg_color', v)} />
          <ColorField label="Etichetta categoria - testo" value={form.category_text_color} onChange={(v) => set('category_text_color', v)} />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Distanza tra etichetta categoria e titolo</Label>
          <div className="flex items-center gap-2">
            <input type="range" min={0} max={100} step={2} value={form.category_gap} onChange={(e) => set('category_gap', Number(e.target.value))} className="flex-1 accent-primary" />
            <span className="text-xs text-muted-foreground w-12 text-right">{form.category_gap}px</span>
          </div>
          <p className="text-[11px] text-muted-foreground">Più alto = etichetta più lontana dal titolo (meno "attaccata").</p>
        </div>

        <div className="space-y-1.5 pt-2 border-t border-border">
          <Label className="text-xs">Intensità velo scuro sotto il testo</Label>
          <div className="flex items-center gap-3">
            <input type="range" min={0} max={1} step={0.05} value={form.overlay_intensity} onChange={(e) => set('overlay_intensity', Number(e.target.value))} className="flex-1 accent-primary" />
            <span className="text-xs text-muted-foreground w-10 text-right">{Math.round(form.overlay_intensity * 100)}%</span>
          </div>
          <p className="text-[11px] text-muted-foreground">Più alto = testo più leggibile ma foto meno visibile.</p>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
          <ColorField label="Sfondo di riserva (inizio)" value={form.bg_gradient_start} onChange={(v) => set('bg_gradient_start', v)} />
          <ColorField label="Sfondo di riserva (fine)" value={form.bg_gradient_end} onChange={(v) => set('bg_gradient_end', v)} />
        </div>
        <p className="text-[11px] text-muted-foreground -mt-2">Usato solo quando l'articolo non ha una foto, o la foto non si può leggere.</p>

        <div className="space-y-1.5 pt-2 border-t border-border">
          <Label className="text-xs">Testo in basso per i comunicati GD Madonie</Label>
          <Input value={form.domain_text_gd} onChange={(e) => set('domain_text_gd', e.target.value)} placeholder="gdmadonie-news.com" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Prefisso testo in basso per la rassegna</Label>
          <Input value={form.domain_text_rassegna_prefix} onChange={(e) => set('domain_text_rassegna_prefix', e.target.value)} placeholder="via" />
          <p className="text-[11px] text-muted-foreground">Diventa ad es. "{form.domain_text_rassegna_prefix} ANSA" per un articolo di rassegna.</p>
        </div>
        {saved && <p className="text-xs text-emerald-600">Salvato</p>}
      </div>
      <div className="flex flex-col items-center gap-3">
        <div className="flex bg-muted rounded-full p-1 text-xs font-medium">
          <button type="button" onClick={() => setPreviewFormat('story')} className={`px-3 py-1.5 rounded-full ${previewFormat === 'story' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}>Storie (9:16)</button>
          <button type="button" onClick={() => setPreviewFormat('post')} className={`px-3 py-1.5 rounded-full ${previewFormat === 'post' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}>Post (4:5)</button>
        </div>
        {previewUrl ?
        <img src={previewUrl} alt="Anteprima" className={`w-full ${previewFormat === 'post' ? 'max-w-[240px]' : 'max-w-[220px]'} rounded-2xl border border-border shadow-sm`} /> :

        <div className={`w-full ${previewFormat === 'post' ? 'max-w-[240px] aspect-[4/5]' : 'max-w-[220px] aspect-[9/16]'} rounded-2xl bg-muted flex items-center justify-center`}>
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        }
      </div>
    </div>);

}
