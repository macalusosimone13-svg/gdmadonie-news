import { useEffect, useState } from 'react';
import { sb44 } from '@/api/supabaseEntities';
import { Plus, Trash2, Loader2, GripVertical } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';

const PLATFORMS = [
  { value: 'instagram', label: 'Instagram', icon: 'Instagram' },
  { value: 'facebook', label: 'Facebook', icon: 'Facebook' },
  { value: 'telegram', label: 'Telegram', icon: 'Send' },
  { value: 'twitter', label: 'Twitter / X', icon: 'Twitter' },
  { value: 'youtube', label: 'YouTube', icon: 'Youtube' },
  { value: 'website', label: 'Sito web', icon: 'Globe' },
  { value: 'email', label: 'Email', icon: 'Mail' },
  { value: 'custom', label: 'Link personalizzato', icon: 'Link' },
];

const EMPTY = { platform: 'instagram', label: '', url: '', icon: '', sort_order: 0, is_active: true };

export default function SocialLinksManager() {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);

  const load = () => {
    setLoading(true);
    sb44.entities.SocialLink.list('sort_order', 50).then((data) => {
      setLinks(data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const addLink = async () => {
    if (!draft.url) return;
    setSaving(true);
    try {
      await sb44.entities.SocialLink.create({
        platform: draft.platform,
        label: draft.label || PLATFORMS.find((p) => p.value === draft.platform)?.label || 'Link',
        url: draft.url,
        icon: draft.icon || PLATFORMS.find((p) => p.value === draft.platform)?.icon || 'Link',
        sort_order: Number(draft.sort_order) || links.length,
        is_active: draft.is_active,
      });
      setDraft(EMPTY);
      load();
    } catch (e) {
      alert('Errore: ' + (e.response?.data?.error || e.message));
    }
    setSaving(false);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await sb44.entities.SocialLink.delete(pendingDelete);
      setLinks((prev) => prev.filter((l) => l.id !== pendingDelete));
    } catch (e) {}
    setPendingDelete(null);
  };

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-2xl p-5">
        <h3 className="font-semibold text-foreground mb-1">Aggiungi contatto / link</h3>
        <p className="text-sm text-muted-foreground mb-4">Instagram, Facebook, Telegram, sito, modulo o link personalizzato.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select value={draft.platform} onValueChange={(v) => setDraft({ ...draft, platform: v })}>
            <SelectTrigger className="w-full min-h-[44px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PLATFORMS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <input
            value={draft.label}
            onChange={(e) => setDraft({ ...draft, label: e.target.value })}
            placeholder="Etichetta (es. Instagram @gdmadonie)"
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm" />
          <input
            value={draft.url}
            onChange={(e) => setDraft({ ...draft, url: e.target.value })}
            placeholder="https://... o mailto:..."
            className="w-full sm:col-span-2 px-3 py-2.5 rounded-xl border border-border bg-card text-sm" />
          <input
            type="number"
            value={draft.sort_order}
            onChange={(e) => setDraft({ ...draft, sort_order: e.target.value })}
            placeholder="Ordine"
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm" />
          <label className="flex items-center gap-2 text-sm text-muted-foreground px-1">
            <input
              type="checkbox"
              checked={draft.is_active}
              onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
              className="w-4 h-4" />
            Attivo (visibile)
          </label>
        </div>
        <button
          onClick={addLink}
          disabled={saving || !draft.url}
          className="mt-4 flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 min-h-[44px] rounded-xl text-sm font-medium disabled:opacity-60">
          <Plus className="w-4 h-4" /> Aggiungi
        </button>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5">
        <h3 className="font-semibold text-foreground mb-3">Contatti configurati ({links.length})</h3>
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : links.length === 0 ?
          <p className="text-sm text-muted-foreground">Nessun contatto. Aggiungine uno sopra.</p> :
          <div className="space-y-2">
            {links.map((l) => (
              <div key={l.id} className="flex items-center gap-3 bg-muted border border-border rounded-xl p-3">
                <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{l.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{l.url}</p>
                </div>
                {!l.is_active && <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Disattivo</span>}
                <button onClick={() => setPendingDelete(l.id)} aria-label="Rimuovi contatto" className="text-red-500 hover:text-red-700 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        }
      </div>

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => { if (!open) setPendingDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rimuovere questo contatto?</AlertDialogTitle>
            <AlertDialogDescription>Il link verrà rimosso dalla sezione contatti.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Rimuovi</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
