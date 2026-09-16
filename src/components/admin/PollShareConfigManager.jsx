import { useEffect, useRef, useState } from 'react';
import { uploadFile } from '@/lib/uploadFile';
import { sb44 } from '@/api/supabaseEntities';
import { buildPollChartBlob } from '@/lib/storyImage';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Upload, X } from 'lucide-react';

const POLL_SHARE_DEFAULTS = {
  brand_title: 'Madonie News',
  brand_subtitle: 'Giovani Democratici Madonie',
  logo_url: '',
  logo_size: 140,
  background_color: '#f5f5f5',
  title_color: '',
  category_bg_color: '#ffffff',
  category_text_color: '#0F1B3A',
  domain_text: 'gdmadonie-news.com',
  show_category: true,
  show_domain: true,
  top_band_enabled: false,
  top_band_color: '#000000',
  top_band_opacity: 0.35,
  category_gap: 28
};

const SAMPLE_ITEMS = [
{ party: "Fratelli d'Italia", percentage: 26.8, color: '#0F2A5C', logo_url: '' },
{ party: 'Partito Democratico', percentage: 20.7, color: '#E4032E', logo_url: '' },
{ party: 'Movimento 5 Stelle', percentage: 12.7, color: '#FFD23F', logo_url: '' },
{ party: 'Futuro Nazionale\nVannacci', percentage: 7.5, color: '#0F1B3A', logo_url: '' },
{ party: 'Forza Italia', percentage: 7.1, color: '#1E88E5', logo_url: '' }];


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

export default function PollShareConfigManager() {
  const [form, setForm] = useState({ ...POLL_SHARE_DEFAULTS, id: null });
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
    sb44.entities.StoryShareConfig.filter({ key: 'poll_share' }, '-updated_date', 1),
    sb44.entities.SiteContent.filter({ key: 'site_logo_url' }, '-updated_date', 1)]
    ).then(([configs, logos]) => {
      if (configs?.[0]) setForm({ ...POLL_SHARE_DEFAULTS, ...configs[0] });
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
            const created = await sb44.entities.StoryShareConfig.create({ ...payload, key: 'poll_share' });
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
        const blob = await buildPollChartBlob({
          format: previewFormat,
          category: 'Sondaggi Nazionali',
          subtitle: '31 agosto 2026 · SWG',
          items: SAMPLE_ITEMS,
          domain: form.domain_text,
          primaryColor: form.background_color,
          logoUrl: form.logo_url || siteLogo,
          brandTitle: form.brand_title,
          brandSubtitle: form.brand_subtitle,
          bgGradientStart: form.background_color,
          bgGradientEnd: form.background_color,
          categoryBg: form.category_bg_color,
          categoryText: form.category_text_color,
          titleColor: form.title_color || undefined,
          logoSize: form.logo_size,
          showCategory: form.show_category,
          showDomain: form.show_domain,
          topBandEnabled: form.top_band_enabled,
          topBandColor: form.top_band_color,
          topBandOpacity: form.top_band_opacity,
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
  form.domain_text, form.logo_url, form.brand_title, form.brand_subtitle,
  form.background_color, form.category_bg_color, form.category_text_color,
  form.title_color, form.logo_size, form.show_category, form.show_domain,
  form.top_band_enabled, form.top_band_color, form.top_band_opacity, form.category_gap,
  previewFormat, siteLogo]
  );

  if (loading) return <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />;

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="space-y-4">
        <div>
          <h3 className="font-semibold text-foreground text-sm">Storia Sondaggi</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Personalizza l'immagine generata quando si condivide la pagina Sondaggi. Ogni modifica si salva da sola.</p>
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
          <Label className="text-xs">Logo (vuoto = usa il logo generale del sito)</Label>
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

        <div className="pt-2 border-t border-border">
          <ColorField label="Colore di sfondo" value={form.background_color} onChange={(v) => set('background_color', v)} />
          <p className="text-[11px] text-muted-foreground mt-1">Il colore del testo (chiaro/scuro) si adatta da solo per restare leggibile.</p>
        </div>

        <div className="space-y-1.5 pt-2 border-t border-border">
          <ColorField label="Titolo - colore testo (vuoto = automatico)" value={form.title_color} onChange={(v) => set('title_color', v)} />
        </div>

        <div className="pt-2 border-t border-border space-y-1">
          <ToggleRow label="Mostra etichetta ambito" value={form.show_category} onChange={(v) => set('show_category', v)} />
          <ToggleRow label="Mostra testo in basso (dominio)" value={form.show_domain} onChange={(v) => set('show_domain', v)} />
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
          <ColorField label="Etichetta ambito - sfondo" value={form.category_bg_color} onChange={(v) => set('category_bg_color', v)} />
          <ColorField label="Etichetta ambito - testo" value={form.category_text_color} onChange={(v) => set('category_text_color', v)} />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Distanza tra etichetta ambito e titolo</Label>
          <div className="flex items-center gap-2">
            <input type="range" min={0} max={100} step={2} value={form.category_gap} onChange={(e) => set('category_gap', Number(e.target.value))} className="flex-1 accent-primary" />
            <span className="text-xs text-muted-foreground w-12 text-right">{form.category_gap}px</span>
          </div>
        </div>

        <div className="space-y-1.5 pt-2 border-t border-border">
          <Label className="text-xs">Testo in basso (dominio)</Label>
          <Input value={form.domain_text} onChange={(e) => set('domain_text', e.target.value)} placeholder="gdmadonie-news.com" />
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
