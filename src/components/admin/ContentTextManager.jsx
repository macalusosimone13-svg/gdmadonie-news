import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { sb44 } from '@/api/supabaseEntities';
import { Save, Loader2, Type, Upload, X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CONTENT_DEFAULTS } from '@/lib/siteContent';

const CONTENT_KEYS = [
  { key: 'gd_title', label: 'Titolo pagina GD Madonie', multiline: false },
  { key: 'gd_subtitle', label: 'Sottotitolo GD Madonie', multiline: false },
  { key: 'gd_description', label: 'Descrizione "Chi siamo"', multiline: true },
  { key: 'org_segretario', label: 'Organigramma · Segretario', multiline: false },
  { key: 'org_vicesegretario', label: 'Organigramma · Vicesegretario', multiline: false },
  { key: 'org_resp_comunicazione', label: 'Organigramma · Resp. Comunicazione', multiline: false },
  { key: 'org_tesoriere', label: 'Organigramma · Tesoriere', multiline: false },
  { key: 'category_label_comunicato', label: 'Etichetta · Comunicato GD', multiline: false },
  { key: 'category_label_news_gd', label: 'Etichetta · News GD', multiline: false },
  { key: 'category_label_proposta', label: 'Etichetta · Proposta', multiline: false },
  { key: 'category_label_approfondimento', label: 'Etichetta · Approfondimento', multiline: false },
  { key: 'category_label_politica_nazionale', label: 'Etichetta · Politica Nazionale', multiline: false },
  { key: 'category_label_politica_regionale', label: 'Etichetta · Politica Regionale', multiline: false },
  { key: 'category_label_rassegna_stampa', label: 'Etichetta · Rassegna Stampa', multiline: false },
  { key: 'team_related_label', label: 'Etichetta · "Altri profili" (pagina persona)', multiline: false }
];

const TEAM_SLOTS = [1, 2, 3, 4];
const teamKey = (i, field) => `team_${i}_${field}`;

export default function ContentTextManager() {
  const { toast } = useToast();
  const [records, setRecords] = useState({});
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [uploading, setUploading] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await sb44.entities.SiteContent.list();
      const recMap = {};
      const valMap = { site_logo_url: CONTENT_DEFAULTS.site_logo_url };
      CONTENT_KEYS.forEach((k) => { valMap[k.key] = CONTENT_DEFAULTS[k.key] || ''; });
      (data || []).forEach((r) => { recMap[r.key] = r; valMap[r.key] = r.value ?? valMap[r.key]; });
      setRecords(recMap);
      setValues(valMap);
    } catch {
      toast({ title: 'Errore caricamento testi', variant: 'destructive' });
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async (key) => {
    setSaving(key);
    try {
      const existing = records[key];
      if (existing) {
        await sb44.entities.SiteContent.update(existing.id, { value: values[key] });
      } else {
        const created = await sb44.entities.SiteContent.create({ key, value: values[key] });
        setRecords((p) => ({ ...p, [key]: created }));
      }
      toast({ title: 'Testo salvato' });
    } catch (e) {
      toast({ title: 'Errore salvataggio', description: e.message, variant: 'destructive' });
    }
    setSaving(null);
  };

  const uploadPhoto = async (key, file) => {
    if (!file) return;
    setUploading(key);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setValues((p) => ({ ...p, [key]: file_url }));
      const existing = records[key];
      if (existing) {
        await sb44.entities.SiteContent.update(existing.id, { value: file_url });
      } else {
        const created = await sb44.entities.SiteContent.create({ key, value: file_url });
        setRecords((p) => ({ ...p, [key]: created }));
      }
      toast({ title: 'Foto caricata' });
    } catch (e) {
      toast({ title: 'Errore upload', description: e.message, variant: 'destructive' });
    }
    setUploading(null);
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Type className="w-5 h-5 text-primary" />
        <div>
          <h3 className="font-semibold text-foreground">Testi del sito</h3>
          <p className="text-sm text-muted-foreground">Modifica titoli, sottotitoli, descrizioni e organigramma mostrati nell'app.</p>
        </div>
      </div>
      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-4">
          {CONTENT_KEYS.map((k) => (
            <div key={k.key} className="space-y-1.5">
              <Label htmlFor={k.key} className="text-xs text-muted-foreground">{k.label}</Label>
              <div className="flex items-start gap-2">
                {k.multiline ? (
                  <Textarea id={k.key} value={values[k.key] || ''} onChange={(e) => setValues((p) => ({ ...p, [k.key]: e.target.value }))} rows={4} className="flex-1" />
                ) : (
                  <Input id={k.key} value={values[k.key] || ''} onChange={(e) => setValues((p) => ({ ...p, [k.key]: e.target.value }))} className="flex-1" />
                )}
                <button onClick={() => save(k.key)} disabled={saving === k.key} aria-label={`Salva ${k.label}`} className="mt-0.5 flex items-center justify-center min-w-[44px] min-h-[44px] rounded-xl bg-primary text-primary-foreground disabled:opacity-60">
                  {saving === k.key ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="pt-4 border-t border-border">
        <h4 className="font-semibold text-foreground text-sm mb-1">Logo del sito</h4>
        <p className="text-xs text-muted-foreground mb-3">Usato nell'header e nel footer di tutte le pagine.</p>
        <div className="flex items-center gap-3">
          <label className="relative w-16 h-16 rounded-full overflow-hidden cursor-pointer group flex-shrink-0">
            <img src={values.site_logo_url} alt="" className="w-16 h-16 rounded-full object-cover" />
            <span className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
              {uploading === 'site_logo_url' ?
              <Loader2 className="w-4 h-4 animate-spin text-white" /> :

              <Upload className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              }
            </span>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => {if (e.target.files?.[0]) uploadPhoto('site_logo_url', e.target.files[0]);e.target.value = '';}} />
          </label>
          {values.site_logo_url !== CONTENT_DEFAULTS.site_logo_url &&
          <button type="button" onClick={() => {setValues((p) => ({ ...p, site_logo_url: CONTENT_DEFAULTS.site_logo_url }));save('site_logo_url');}} className="text-xs font-medium text-muted-foreground hover:text-red-600 underline">
              Ripristina logo predefinito
            </button>
          }
          <p className="text-xs text-muted-foreground">Clicca sull'anteprima per caricare un'immagine nuova. Meglio quadrata: verrà mostrata tonda.</p>
        </div>
      </div>
      <div className="pt-4 border-t border-border">
        <h4 className="font-semibold text-foreground text-sm mb-1">In evidenza (home, sotto l'hero)</h4>
        <p className="text-xs text-muted-foreground mb-3">Fino a 4 persone mostrate in una riga sotto la notizia principale. Una scheda senza foto non viene mostrata.</p>
        <div className="space-y-5">
          {TEAM_SLOTS.map((i) =>
          <div key={i} className="flex gap-3 items-start bg-muted/40 rounded-xl p-3">
              <div className="flex-shrink-0 space-y-2">
                <p className="text-[10px] text-muted-foreground text-center">Home</p>
                {values[teamKey(i, 'photo')] ?
              <div className="relative w-16 h-16">
                    <img src={values[teamKey(i, 'photo')]} alt="" className="w-16 h-16 rounded-lg object-cover" />
                    <button type="button" onClick={() => {setValues((p) => ({ ...p, [teamKey(i, 'photo')]: '' }));save(teamKey(i, 'photo'));}} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white shadow flex items-center justify-center text-muted-foreground hover:text-red-600">
                      <X className="w-3 h-3" />
                    </button>
                  </div> :

              <label className="w-16 h-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:bg-muted">
                    {uploading === teamKey(i, 'photo') ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : <Upload className="w-4 h-4 text-muted-foreground" />}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => {if (e.target.files?.[0]) uploadPhoto(teamKey(i, 'photo'), e.target.files[0]);e.target.value = '';}} />
                  </label>
              }
              </div>
              <div className="flex-shrink-0 space-y-2">
                <p className="text-[10px] text-muted-foreground text-center">Pagina persona</p>
                {values[teamKey(i, 'detail_photo')] ?
              <div className="relative w-16 h-16">
                    <img src={values[teamKey(i, 'detail_photo')]} alt="" className="w-16 h-16 rounded-lg object-cover" />
                    <button type="button" onClick={() => {setValues((p) => ({ ...p, [teamKey(i, 'detail_photo')]: '' }));save(teamKey(i, 'detail_photo'));}} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white shadow flex items-center justify-center text-muted-foreground hover:text-red-600">
                      <X className="w-3 h-3" />
                    </button>
                  </div> :

              <label className="w-16 h-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:bg-muted">
                    {uploading === teamKey(i, 'detail_photo') ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : <Upload className="w-4 h-4 text-muted-foreground" />}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => {if (e.target.files?.[0]) uploadPhoto(teamKey(i, 'detail_photo'), e.target.files[0]);e.target.value = '';}} />
                  </label>
              }
              </div>
              <div className="flex-1 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <Input value={values[teamKey(i, 'prefix')] || ''} onChange={(e) => setValues((p) => ({ ...p, [teamKey(i, 'prefix')]: e.target.value }))} onBlur={() => save(teamKey(i, 'prefix'))} placeholder='Es: "Lui è" / "Lei è"' className="text-sm" />
                  <Input value={values[teamKey(i, 'name')] || ''} onChange={(e) => setValues((p) => ({ ...p, [teamKey(i, 'name')]: e.target.value }))} onBlur={() => save(teamKey(i, 'name'))} placeholder="Es: Simone Macaluso" className="text-sm" />
                </div>
                <p className="text-[10px] text-muted-foreground">Il primo campo resta nel colore normale del testo, il secondo prende il colore primario del sito (Admin → UX/Design).</p>
                <Input value={values[teamKey(i, 'caption')] || ''} onChange={(e) => setValues((p) => ({ ...p, [teamKey(i, 'caption')]: e.target.value }))} onBlur={() => save(teamKey(i, 'caption'))} placeholder="Es: di Nome Autore" className="text-sm" />
                <Textarea value={values[teamKey(i, 'bio')] || ''} onChange={(e) => setValues((p) => ({ ...p, [teamKey(i, 'bio')]: e.target.value }))} onBlur={() => save(teamKey(i, 'bio'))} rows={6} placeholder={'Testo della pagina dedicata. Usa righe vuote per separare i paragrafi.\nInizia una riga con "## " per un sottotitolo.\nInizia una riga con "> " per una citazione in evidenza.'} className="text-sm" />
                <p className="text-[10px] text-muted-foreground pt-1">Contatti social personali (mostrati in fondo alla pagina della persona)</p>
                <div className="grid grid-cols-2 gap-2">
                  <Input value={values[teamKey(i, 'instagram')] || ''} onChange={(e) => setValues((p) => ({ ...p, [teamKey(i, 'instagram')]: e.target.value }))} onBlur={() => save(teamKey(i, 'instagram'))} placeholder="Link Instagram" className="text-xs" />
                  <Input value={values[teamKey(i, 'facebook')] || ''} onChange={(e) => setValues((p) => ({ ...p, [teamKey(i, 'facebook')]: e.target.value }))} onBlur={() => save(teamKey(i, 'facebook'))} placeholder="Link Facebook" className="text-xs" />
                  <Input value={values[teamKey(i, 'twitter')] || ''} onChange={(e) => setValues((p) => ({ ...p, [teamKey(i, 'twitter')]: e.target.value }))} onBlur={() => save(teamKey(i, 'twitter'))} placeholder="Link X / Twitter" className="text-xs" />
                  <Input value={values[teamKey(i, 'linkedin')] || ''} onChange={(e) => setValues((p) => ({ ...p, [teamKey(i, 'linkedin')]: e.target.value }))} onBlur={() => save(teamKey(i, 'linkedin'))} placeholder="Link LinkedIn" className="text-xs" />
                  <Input value={values[teamKey(i, 'email')] || ''} onChange={(e) => setValues((p) => ({ ...p, [teamKey(i, 'email')]: e.target.value }))} onBlur={() => save(teamKey(i, 'email'))} placeholder="Email" className="text-xs col-span-2" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
