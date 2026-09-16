import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { sb44 } from '@/api/supabaseEntities';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Upload, Loader2, Check, X } from 'lucide-react';
import { compressImage } from '@/lib/imageCompress';

export default function EventForm({ onCreated, editEvent, onSaved }) {
  const isEdit = !!editEvent;
  const [form, setForm] = useState(() => editEvent ? {
    title: editEvent.title || '',
    date: editEvent.date ? new Date(editEvent.date).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
    location: editEvent.location || '',
    description: editEvent.description || ''
  } : { title: '', date: new Date().toISOString().slice(0, 16), location: '', description: '' });
  const [imageUrl, setImageUrl] = useState(editEvent?.image_url || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);

  const upload = async (file) => {
    setUploading(true);
    try { const compressed = await compressImage(file); const res = await base44.integrations.Core.UploadFile({ file: compressed }); setImageUrl(res.file_url); }
    catch { alert('Upload fallito'); }
    setUploading(false);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title) return;
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        date: new Date(form.date).toISOString(),
        location: form.location || undefined,
        description: form.description || undefined,
        image_url: imageUrl || undefined
      };
      if (isEdit) {
        await sb44.entities.Event.update(editEvent.id, payload);
        setDone(true);
        setTimeout(() => setDone(false), 2000);
        onSaved?.();
        setSaving(false);
        return;
      }
      const created = await sb44.entities.Event.create(payload);
      if (created?.id) {
        try {await supabase.functions.invoke('notify-new-event', { body: { event_id: created.id, app_url: window.location.origin } });} catch (e) {}
      }
      setForm({ title: '', date: new Date().toISOString().slice(0, 16), location: '', description: '' });
      setImageUrl('');
      setDone(true);
      setTimeout(() => setDone(false), 3000);
      onCreated?.();
    } catch (e) { alert('Errore: ' + (e.response?.data?.message || e.message)); }
    setSaving(false);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Titolo evento *</Label>
        <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required placeholder="Titolo..." />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Data e ora *</Label>
          <Input type="datetime-local" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required />
        </div>
        <div className="space-y-1.5">
          <Label>Luogo</Label>
          <Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="Luogo..." />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Descrizione</Label>
        <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={4} />
      </div>
      <div className="space-y-1.5">
        <Label>Immagine (opzionale)</Label>
        {imageUrl ? (
          <div className="flex items-center gap-2 text-sm text-emerald-600">
            <Check className="w-4 h-4" /> Caricata
            <button type="button" aria-label="Rimuovi immagine" onClick={() => setImageUrl('')} className="text-red-500 ml-auto p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"><X className="w-4 h-4" /></button>
          </div>
        ) : (
          <label className="flex items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl py-6 cursor-pointer hover:border-primary text-sm text-muted-foreground">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Carica immagine
            <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files[0] && upload(e.target.files[0])} />
          </label>
        )}
      </div>
      <Button type="submit" disabled={saving} className="w-full">
        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
        {done ? isEdit ? 'Modifiche salvate!' : 'Pubblicato!' : isEdit ? 'Salva modifiche' : 'Pubblica evento'}
      </Button>
    </form>
  );
}
