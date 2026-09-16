import { useEffect, useState } from 'react';
import { uploadFile } from '@/lib/uploadFile';
import { sb44 } from '@/api/supabaseEntities';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2, Upload, Save, Mail } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const KEY = 'post_notification';
const DEFAULTS = {
  public_url: '',
  logo_url: '',
  logo_size: 72,
  bg_gradient_start: '',
  bg_gradient_end: '',
  subject_prefix: 'Nuovo articolo GD Madonie:',
  header_text: 'Giovani Democratici Madonie',
  header_bg_color: '#b91c1c',
  body_bg_color: '#f1f5f9',
  card_bg_color: '#ffffff',
  text_color: '#0f172a',
  excerpt_color: '#475569',
  button_bg_color: '#b91c1c',
  button_text_color: '#ffffff',
  footer_text: 'Giovani Democratici Madonie · Notifica automatica'
};

export default function EmailTemplateManager() {
  const [rec, setRec] = useState(null);
  const [form, setForm] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    sb44.entities.EmailTemplate.filter({ key: KEY }, '-created_date', 1).then((data) => {
      if (data && data[0]) {setRec(data[0]);setForm({ ...DEFAULTS, ...data[0] });}
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const uploadLogo = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadFile(file);
      set('logo_url', res.file_url);
      toast({ description: 'Logo caricato' });
    } catch {toast({ description: 'Upload fallito', variant: 'destructive' });}
    setUploading(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = { key: KEY, ...form };
      // normalizza public_url senza slash finale
      if (payload.public_url) payload.public_url = payload.public_url.replace(/\/$/, '');
      if (rec) {
        const updated = await sb44.entities.EmailTemplate.update(rec.id, payload);
        setRec(updated);
      } else {
        const created = await sb44.entities.EmailTemplate.create(payload);
        setRec(created);
      }
      toast({ description: 'Template email salvato' });
    } catch {toast({ description: 'Errore nel salvataggio', variant: 'destructive' });}
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Mail className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">Template email nuovi post</h3>
        </div>
        <p className="text-sm text-muted-foreground">Personalizza l'aspetto e i testi delle notifiche email inviate ai registrati quando pubblichi un articolo GD.</p>

        <div className="space-y-1.5">
          <Label>URL pubblico dell'app (produzione) *</Label>
          <Input value={form.public_url} onChange={(e) => set('public_url', e.target.value)} placeholder="https://gd-madonie-news.base44.app" />
          <p className="text-xs text-muted-foreground">Dominio pubblico raggiungibile dai destinatari. Usato per generare i link dell'email. Lascia vuoto per usare il dominio da cui pubblichi.</p>
        </div>

        <div className="space-y-1.5">
          <Label>Logo / immagine mittente</Label>
          <div className="flex items-center gap-3">
            {form.logo_url && <img src={form.logo_url} alt="logo" className="w-16 h-16 rounded-xl object-contain bg-muted border border-border" />}
            <label className="flex items-center gap-2 border border-dashed border-border rounded-xl px-4 py-2.5 cursor-pointer text-sm text-muted-foreground hover:bg-muted min-h-[44px]">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Carica logo
              <input type="file" accept="image/*" className="hidden" onChange={(e) => {if (e.target.files?.[0]) uploadLogo(e.target.files[0]);e.target.value = '';}} />
            </label>
          </div>
          {form.logo_url && <Input value={form.logo_url} onChange={(e) => set('logo_url', e.target.value)} placeholder="URL logo" className="mt-2 text-xs" />}
          <div className="flex items-center gap-3 pt-1">
            <Label className="text-xs whitespace-nowrap">Altezza logo</Label>
            <input type="range" min={32} max={260} step={4} value={form.logo_size || 72} onChange={(e) => set('logo_size', Number(e.target.value))} className="flex-1 accent-primary" />
            <span className="text-xs text-muted-foreground w-12 text-right">{form.logo_size || 85}px</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Sfumatura sfondo email (l'area intorno alla card bianca)</Label>
          <p className="text-xs text-muted-foreground">Il tuo logo è senza sfondo: con una sfumatura qui dietro risalta meglio su tutta l'email. Lascia vuoto per uno sfondo a tinta unita ("Sfondo esterno" qui sotto).</p>
          <div className="grid grid-cols-2 gap-3">
            <ColorField label="Sfumatura (inizio)" value={form.bg_gradient_start} onChange={(v) => set('bg_gradient_start', v)} />
            <ColorField label="Sfumatura (fine)" value={form.bg_gradient_end} onChange={(v) => set('bg_gradient_end', v)} />
          </div>
          {form.bg_gradient_start &&
          <button type="button" onClick={() => {set('bg_gradient_start', '');set('bg_gradient_end', '');}} className="text-xs text-muted-foreground hover:text-red-600 underline">Togli la sfumatura, torna a tinta unita</button>
          }
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Prefisso oggetto</Label><Input value={form.subject_prefix} onChange={(e) => set('subject_prefix', e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Testo intestazione</Label><Input value={form.header_text} onChange={(e) => set('header_text', e.target.value)} /></div>
        </div>

        <div className="space-y-1.5">
          <Label>Testo footer</Label>
          <Textarea value={form.footer_text} onChange={(e) => set('footer_text', e.target.value)} rows={2} />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <ColorField label="Sfondo header" value={form.header_bg_color} onChange={(v) => set('header_bg_color', v)} />
          <ColorField label="Sfondo esterno" value={form.body_bg_color} onChange={(v) => set('body_bg_color', v)} />
          <ColorField label="Sfondo card" value={form.card_bg_color} onChange={(v) => set('card_bg_color', v)} />
          <ColorField label="Colore titolo" value={form.text_color} onChange={(v) => set('text_color', v)} />
          <ColorField label="Colore estratto" value={form.excerpt_color} onChange={(v) => set('excerpt_color', v)} />
          <ColorField label="Sfondo pulsante" value={form.button_bg_color} onChange={(v) => set('button_bg_color', v)} />
          <ColorField label="Testo pulsante" value={form.button_text_color} onChange={(v) => set('button_text_color', v)} />
        </div>

        <Button onClick={save} disabled={saving} className="w-full min-h-[44px]">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} Salva template
        </Button>
      </div>

      {/* Anteprima live */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-foreground">Anteprima</h4>
        <div className="rounded-2xl border border-border overflow-hidden" style={{ background: form.bg_gradient_start ? `linear-gradient(to bottom, ${form.bg_gradient_start}, ${form.bg_gradient_end || form.bg_gradient_start})` : form.body_bg_color }}>
          <div className="p-4" style={form.bg_gradient_start ? { paddingTop: 40, paddingBottom: 40 } : undefined}>
            <div style={{ background: form.card_bg_color, borderRadius: 16, overflow: 'hidden', border: '1px solid #e2e8f0', fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif' }}>
              <div style={{ background: `linear-gradient(to bottom, ${form.header_bg_color}, ${form.card_bg_color})`, padding: '16px 22px 26px', textAlign: 'center' }}>
                <span style={{ color: '#ffffff', fontWeight: 700, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase' }}>{form.header_text || 'Intestazione'}</span>
                {form.logo_url &&
                <div style={{ textAlign: 'center', marginTop: 22 }}>
                    <img src={form.logo_url} alt="logo" style={{ height: form.logo_size || 72, width: 'auto', maxWidth: 220, borderRadius: 14, margin: '0 auto' }} />
                  </div>
                }
              </div>
              <div style={{ padding: '6px 24px 28px' }}>
                <h1 style={{ margin: '0 0 12px', fontSize: 22, lineHeight: 1.3, color: form.text_color }}>Titolo dell'articolo di esempio</h1>
                <p style={{ margin: '0 0 20px', fontSize: 15, lineHeight: 1.6, color: form.excerpt_color }}>Breve estratto del comunicato che riassume il contenuto dell'articolo pubblicato.</p>
                <span style={{ display: 'inline-block', background: form.button_bg_color, color: form.button_text_color, fontWeight: 600, fontSize: 15, padding: '13px 32px', borderRadius: 999 }}>Leggi l'articolo completo</span>
              </div>
              <div style={{ padding: '14px 24px', background: '#f8fafc', textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>{form.footer_text}</div>
            </div>
          </div>
        </div>
      </div>
    </div>);

}

function ColorField({ label, value, onChange }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <input type="color" value={value || '#000000'} onChange={(e) => onChange(e.target.value)} className="w-9 h-9 rounded-lg border border-border cursor-pointer p-0.5 bg-transparent" />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="text-xs h-9" />
      </div>
    </div>);

}
