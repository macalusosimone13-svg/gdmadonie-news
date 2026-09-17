import { useEffect, useState } from 'react';
import { uploadFile } from '@/lib/uploadFile';
import { sb44 } from '@/api/supabaseEntities';
import { getCurrentUser } from '@/lib/supabaseAuth';
import { Save, Loader2, User, Upload, X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

// Versione ristretta di ContentTextManager: un editor può scrivere SOLO sui
// campi della propria scheda "Chi siamo" (team_<suo_slot>_*), non sul resto
// del sito. Il permesso è comunque applicato anche lato database (RLS), qui
// serve solo a mostrargli l'interfaccia giusta.
export default function MyTeamPageManager() {
  const { toast } = useToast();
  const [teamSlot, setTeamSlot] = useState(null);
  const [records, setRecords] = useState({});
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [uploading, setUploading] = useState(null);

  const key = (field) => `team_${teamSlot}_${field}`;

  const load = async () => {
    setLoading(true);
    try {
      const user = await getCurrentUser();
      const slot = user?.team_slot;
      setTeamSlot(slot);
      if (!slot) { setLoading(false); return; }
      const data = await sb44.entities.SiteContent.list();
      const recMap = {};
      const valMap = {};
      const fields = ['photo', 'detail_photo', 'prefix', 'name', 'caption', 'bio', 'instagram', 'facebook', 'twitter', 'linkedin', 'email'];
      fields.forEach((f) => { valMap[`team_${slot}_${f}`] = ''; });
      (data || []).forEach((r) => { if (r.key.startsWith(`team_${slot}_`)) { recMap[r.key] = r; valMap[r.key] = r.value ?? ''; } });
      setRecords(recMap);
      setValues(valMap);
    } catch {
      toast({ title: 'Errore caricamento pagina', variant: 'destructive' });
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async (k) => {
    setSaving(k);
    try {
      const existing = records[k];
      if (existing) {
        await sb44.entities.SiteContent.update(existing.id, { value: values[k] });
      } else {
        const created = await sb44.entities.SiteContent.create({ key: k, value: values[k] });
        setRecords((p) => ({ ...p, [k]: created }));
      }
      toast({ title: 'Salvato' });
    } catch (e) {
      toast({ title: 'Errore salvataggio', description: e.message, variant: 'destructive' });
    }
    setSaving(null);
  };

  const uploadPhoto = async (k, file) => {
    if (!file) return;
    setUploading(k);
    try {
      const { file_url } = await uploadFile(file);
      setValues((p) => ({ ...p, [k]: file_url }));
      const existing = records[k];
      if (existing) {
        await sb44.entities.SiteContent.update(existing.id, { value: file_url });
      } else {
        const created = await sb44.entities.SiteContent.create({ key: k, value: file_url });
        setRecords((p) => ({ ...p, [k]: created }));
      }
      toast({ title: 'Foto caricata' });
    } catch (e) {
      toast({ title: 'Errore upload', description: e.message, variant: 'destructive' });
    }
    setUploading(null);
  };

  if (loading) {
    return <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  if (!teamSlot) {
    return (
      <div className="bg-card border border-border rounded-2xl p-5">
        <p className="text-sm text-muted-foreground">Il tuo account non è ancora collegato a una scheda "Chi siamo". Chiedi a un amministratore di collegartela.</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <User className="w-5 h-5 text-primary" />
        <div>
          <h3 className="font-semibold text-foreground">La mia pagina</h3>
          <p className="text-sm text-muted-foreground">Modifica la tua scheda personale, mostrata in "Chi siamo".</p>
        </div>
      </div>

      <div className="flex gap-3 items-start bg-muted/40 rounded-xl p-3">
        <div className="flex-shrink-0 space-y-2">
          <p className="text-[10px] text-muted-foreground text-center">Home</p>
          {values[key('photo')] ?
          <div className="relative w-16 h-16">
              <img src={values[key('photo')]} alt="" className="w-16 h-16 rounded-lg object-cover" />
              <button type="button" onClick={() => { setValues((p) => ({ ...p, [key('photo')]: '' })); save(key('photo')); }} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white shadow flex items-center justify-center text-muted-foreground hover:text-red-600">
                <X className="w-3 h-3" />
              </button>
            </div> :
          <label className="w-16 h-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:bg-muted">
              {uploading === key('photo') ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : <Upload className="w-4 h-4 text-muted-foreground" />}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) uploadPhoto(key('photo'), e.target.files[0]); e.target.value = ''; }} />
            </label>
          }
        </div>
        <div className="flex-shrink-0 space-y-2">
          <p className="text-[10px] text-muted-foreground text-center">Pagina persona</p>
          {values[key('detail_photo')] ?
          <div className="relative w-16 h-16">
              <img src={values[key('detail_photo')]} alt="" className="w-16 h-16 rounded-lg object-cover" />
              <button type="button" onClick={() => { setValues((p) => ({ ...p, [key('detail_photo')]: '' })); save(key('detail_photo')); }} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white shadow flex items-center justify-center text-muted-foreground hover:text-red-600">
                <X className="w-3 h-3" />
              </button>
            </div> :
          <label className="w-16 h-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:bg-muted">
              {uploading === key('detail_photo') ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : <Upload className="w-4 h-4 text-muted-foreground" />}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) uploadPhoto(key('detail_photo'), e.target.files[0]); e.target.value = ''; }} />
            </label>
          }
        </div>
        <div className="flex-1 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Input value={values[key('prefix')] || ''} onChange={(e) => setValues((p) => ({ ...p, [key('prefix')]: e.target.value }))} onBlur={() => save(key('prefix'))} placeholder='Es: "Lui è" / "Lei è"' className="text-sm" />
            <Input value={values[key('name')] || ''} onChange={(e) => setValues((p) => ({ ...p, [key('name')]: e.target.value }))} onBlur={() => save(key('name'))} placeholder="Il tuo nome" className="text-sm" />
          </div>
          <Input value={values[key('caption')] || ''} onChange={(e) => setValues((p) => ({ ...p, [key('caption')]: e.target.value }))} onBlur={() => save(key('caption'))} placeholder="Il tuo ruolo nel circolo" className="text-sm" />
          <Textarea value={values[key('bio')] || ''} onChange={(e) => setValues((p) => ({ ...p, [key('bio')]: e.target.value }))} onBlur={() => save(key('bio'))} rows={6} placeholder={'Testo della tua pagina dedicata. Usa righe vuote per separare i paragrafi.\nInizia una riga con "## " per un sottotitolo.\nInizia una riga con "> " per una citazione in evidenza.'} className="text-sm" />
          <p className="text-[10px] text-muted-foreground pt-1">I tuoi contatti social (mostrati in fondo alla pagina)</p>
          <div className="grid grid-cols-2 gap-2">
            <Input value={values[key('instagram')] || ''} onChange={(e) => setValues((p) => ({ ...p, [key('instagram')]: e.target.value }))} onBlur={() => save(key('instagram'))} placeholder="Link Instagram" className="text-xs" />
            <Input value={values[key('facebook')] || ''} onChange={(e) => setValues((p) => ({ ...p, [key('facebook')]: e.target.value }))} onBlur={() => save(key('facebook'))} placeholder="Link Facebook" className="text-xs" />
            <Input value={values[key('twitter')] || ''} onChange={(e) => setValues((p) => ({ ...p, [key('twitter')]: e.target.value }))} onBlur={() => save(key('twitter'))} placeholder="Link X / Twitter" className="text-xs" />
            <Input value={values[key('linkedin')] || ''} onChange={(e) => setValues((p) => ({ ...p, [key('linkedin')]: e.target.value }))} onBlur={() => save(key('linkedin'))} placeholder="Link LinkedIn" className="text-xs" />
            <Input value={values[key('email')] || ''} onChange={(e) => setValues((p) => ({ ...p, [key('email')]: e.target.value }))} onBlur={() => save(key('email'))} placeholder="Email" className="text-xs col-span-2" />
          </div>
        </div>
      </div>
    </div>
  );
}
