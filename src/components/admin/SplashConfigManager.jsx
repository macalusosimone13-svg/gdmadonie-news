import { useEffect, useState } from 'react';
import { uploadFile } from '@/lib/uploadFile';
import { sb44 } from '@/api/supabaseEntities';
import { Loader2, Upload, Save, Eye, EyeOff } from 'lucide-react';

const DEFAULTS = {
  logo_url: 'https://pub-1b641aacf1b949cfadd9ca8ab453df1b.r2.dev/legacy/2026-09-16/f1422048-c330-4a0a-8892-0a85294ff01b.png',
  background_color: '#0F1B3A',
  show_title: true,
  show_subtitle: true,
  title: 'Madonie News',
  subtitle: 'Giovani Democratici Madonie',
  logo_size: 140,
};

export default function SplashConfigManager() {
  const [config, setConfig] = useState(null);
  const [form, setForm] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploadingLogo] = useState(false);
  const [error, setError] = useState('');
  const [savedAt, setSavedAt] = useState(0);

  useEffect(() => {
    sb44.entities.SplashConfig.list('-updated_date', 10)
      .then((d) => {
        const first = (d || [])[0];
        if (first) {
          setConfig(first);
          setForm({
            logo_url: first.logo_url || DEFAULTS.logo_url,
            background_color: first.background_color || DEFAULTS.background_color,
            show_title: first.show_title !== false,
            show_subtitle: first.show_subtitle !== false,
            title: first.title || DEFAULTS.title,
            subtitle: first.subtitle || DEFAULTS.subtitle,
            logo_size: Number(first.logo_size) || DEFAULTS.logo_size,
          });
        } else {
          setConfig(null);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [savedAt]);

  const onLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    setError('');
    try {
      const { file_url } = await uploadFile(file);
      setForm((f) => ({ ...f, logo_url: file_url }));
    } catch {
      setError('Upload logo non riuscito');
    }
    setUploadingLogo(false);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = { ...form, logo_size: Number(form.logo_size) || DEFAULTS.logo_size };
      if (config?.id) {
        await sb44.entities.SplashConfig.update(config.id, payload);
      } else {
        await sb44.entities.SplashConfig.create(payload);
      }
      setSavedAt(Date.now());
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
    setSaving(false);
  };

  const field = 'w-full px-3 py-2.5 border border-border bg-card rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary';
  const labelCls = 'block text-xs font-medium text-muted-foreground mb-1';

  if (loading) return <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <div>
        <h3 className="font-semibold text-foreground">Schermata di avvio (Splash)</h3>
        <p className="text-sm text-muted-foreground">Personalizza logo, colore di sfondo e testi della schermata iniziale.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <form onSubmit={save} className="space-y-3 bg-muted/50 border border-border rounded-xl p-4">
          <div>
            <label className={labelCls}>Logo</label>
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-lg border border-border bg-white flex items-center justify-center overflow-hidden shrink-0">
                {form.logo_url ? <img src={form.logo_url} alt="logo" className="w-full h-full object-contain" /> : <Upload className="w-4 h-4 text-muted-foreground" />}
              </div>
              <label className="inline-flex items-center gap-1.5 text-xs font-medium text-primary cursor-pointer whitespace-nowrap px-3 py-2.5 min-h-[44px] border border-border rounded-lg hover:bg-muted bg-card">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Carica logo
                <input type="file" accept="image/*" onChange={onLogoUpload} className="hidden" disabled={uploading} />
              </label>
              {form.logo_url && <button type="button" onClick={() => setForm({ ...form, logo_url: '' })} className="text-xs text-muted-foreground hover:text-red-600 px-2">Rimuovi</button>}
            </div>
            <input value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} placeholder="URL logo (https://...)" className={`${field} mt-2`} type="url" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Colore sfondo</label>
              <div className="flex items-center gap-2">
                <input type="color" value={form.background_color} onChange={(e) => setForm({ ...form, background_color: e.target.value })} className="w-10 h-10 rounded-lg border border-border cursor-pointer p-1 bg-card" />
                <input value={form.background_color} onChange={(e) => setForm({ ...form, background_color: e.target.value })} className={field} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Dimensione logo (px)</label>
              <input type="number" min="60" max="320" value={form.logo_size} onChange={(e) => setForm({ ...form, logo_size: e.target.value })} className={field} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Titolo</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={field} />
          </div>
          <div>
            <label className={labelCls}>Sottotitolo</label>
            <input value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} className={field} />
          </div>
          <div className="flex flex-wrap items-center gap-4 pt-1">
            <label className="inline-flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input type="checkbox" checked={form.show_title} onChange={(e) => setForm({ ...form, show_title: e.target.checked })} className="w-4 h-4 accent-primary" />
              {form.show_title ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />} Mostra titolo
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input type="checkbox" checked={form.show_subtitle} onChange={(e) => setForm({ ...form, show_subtitle: e.target.checked })} className="w-4 h-4 accent-primary" />
              {form.show_subtitle ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />} Mostra sottotitolo
            </label>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 min-h-[44px] rounded-lg text-sm font-medium disabled:opacity-60">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salva impostazioni
          </button>
        </form>

        <div className="space-y-2">
          <span className="text-xs font-medium text-muted-foreground">Anteprima</span>
          <div
            className="relative rounded-2xl overflow-hidden border border-border flex flex-col items-center justify-center min-h-[280px]"
            style={{ background: form.background_color }}
          >
            {form.logo_url && <img src={form.logo_url} alt="logo" className="object-contain mb-4" style={{ width: Math.min(form.logo_size, 180), height: Math.min(form.logo_size, 180) }} />}
            {form.show_title && <h2 className="text-xl font-extrabold tracking-tight text-white">{form.title}</h2>}
            {form.show_subtitle && <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/70 mt-1.5">{form.subtitle}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
