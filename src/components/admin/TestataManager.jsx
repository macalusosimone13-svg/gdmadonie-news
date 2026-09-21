import { useEffect, useState } from 'react';
import { uploadFile } from '@/lib/uploadFile';
import { sb44 } from '@/api/supabaseEntities';
import { Plus, Trash2, Loader2, Pencil, X, Check, Power, Upload, ExternalLink } from 'lucide-react';

const FREQ_OPTIONS = [
  { value: '30', label: '30 minuti' },
  { value: '60', label: '1 ora' },
  { value: '120', label: '2 ore' },
  { value: '360', label: '6 ore' },
  { value: '1440', label: 'Giornaliera' },
];
const SCOPE_OPTIONS = [
  { value: 'nazionale', label: 'Nazionale' },
  { value: 'sicilia', label: 'Sicilia' },
  { value: 'territorio', label: 'Territorio' },
];
const CAT_OPTIONS = [
  { value: 'politica_nazionale', label: 'Politica nazionale' },
  { value: 'politica_regionale', label: 'Politica regionale' },
];

const EMPTY = {
  name: '', logo_url: '', url_feed: '', web_url: '', fallback_feed: '', category: 'politica_nazionale', scope: 'nazionale',
  update_frequency: '30', filter: false, soft: false, is_active: true, sort_order: 0,
};

export default function TestataManager() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const onLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true); setError('');
    try {
      const { file_url } = await uploadFile(file);
      setForm((f) => ({ ...f, logo_url: file_url }));
    } catch (err) {
      setError('Upload logo non riuscito');
    }
    setUploadingLogo(false);
  };

  const load = () => {
    setLoading(true);
    sb44.entities.Testata.list('sort_order', 200)
      .then((d) => setItems((d || []).map((t) => ({ ...t, update_frequency: String(t.update_frequency_minutes || 30) }))))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const reset = () => { setForm(EMPTY); setEditingId(null); setError(''); };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.url_feed.trim()) { setError('Nome e URL feed sono obbligatori'); return; }
    setSaving(true); setError('');
    try {
      const { update_frequency, ...rest } = form;
      const payload = { ...rest, update_frequency_minutes: Number(update_frequency) || 30, sort_order: Number(form.sort_order) || 0 };
      if (editingId) {
        await sb44.entities.Testata.update(editingId, payload);
      } else {
        await sb44.entities.Testata.create(payload);
      }
      reset(); load();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
    setSaving(false);
  };

  const edit = (t) => {
    setEditingId(t.id);
    setForm({
      name: t.name || '', logo_url: t.logo_url || '', url_feed: t.url_feed || '', web_url: t.web_url || '', fallback_feed: t.fallback_feed || '', category: t.category || 'politica_nazionale',
      scope: t.scope || 'nazionale', update_frequency: String(t.update_frequency_minutes || 30),
      filter: !!t.filter, soft: !!t.soft, is_active: t.is_active !== false, sort_order: t.sort_order || 0,
    });
    setError('');
  };

  const remove = async (id) => {
    if (!window.confirm('Eliminare questa testata? Le notizie già importate resteranno pubblicate.')) return;
    await sb44.entities.Testata.delete(id);
    if (editingId === id) reset();
    load();
  };

  const toggleActive = async (t) => {
    await sb44.entities.Testata.update(t.id, { is_active: !t.is_active });
    load();
  };

  const field = 'w-full px-3 py-2.5 border border-border bg-card rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary';
  const labelCls = 'block text-xs font-medium text-muted-foreground mb-1';

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <div>
        <h3 className="font-semibold text-foreground">Testate RSS</h3>
        <p className="text-sm text-muted-foreground">Aggiungi e gestisci i feed sorgente della Rassegna Stampa. Ogni testata attiva viene aggregata automaticamente in base alla sua frequenza.</p>
      </div>

      <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-muted/50 border border-border rounded-xl p-4">
        <div className="sm:col-span-2 flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">{editingId ? 'Modifica testata' : 'Nuova testata'}</span>
          {editingId && <button type="button" onClick={reset} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><X className="w-3.5 h-3.5" /> Annulla modifica</button>}
        </div>
        <div>
          <label className={labelCls}>Titolo / Nome testata</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="es. ANSA Politica" className={field} />
        </div>
        <div>
          <label className={labelCls}>URL feed RSS (parsing)</label>
          <input value={form.url_feed} onChange={(e) => setForm({ ...form, url_feed: e.target.value })} placeholder="https://.../feed/" className={field} type="url" />
        </div>
        <div>
          <label className={labelCls}>Sito web (link visibile agli utenti)</label>
          <input value={form.web_url} onChange={(e) => setForm({ ...form, web_url: e.target.value })} placeholder="https://... (pagina HTML)" className={field} type="url" />
        </div>
        <div>
          <label className={labelCls}>Feed RSS di fallback (opzionale)</label>
          <input value={form.fallback_feed} onChange={(e) => setForm({ ...form, fallback_feed: e.target.value })} placeholder="https://.../feed/ (se il primario è bloccato)" className={field} type="url" />
        </div>
        <div>
          <label className={labelCls}>Categoria destinazione</label>
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={field}>
            {CAT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Ambito</label>
          <select value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} className={field}>
            {SCOPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Frequenza aggiornamento</label>
          <select value={form.update_frequency} onChange={(e) => setForm({ ...form, update_frequency: e.target.value })} className={field}>
            {FREQ_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Ordine</label>
          <input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} className={field} />
        </div>
        <div className="sm:col-span-2 flex flex-wrap items-center gap-4 pt-1">
          <label className="inline-flex items-center gap-2 text-sm text-foreground cursor-pointer">
            <input type="checkbox" checked={form.filter} onChange={(e) => setForm({ ...form, filter: e.target.checked })} className="w-4 h-4 accent-primary" />
            Filtro keyword politica
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-foreground cursor-pointer">
            <input type="checkbox" checked={form.soft} onChange={(e) => setForm({ ...form, soft: e.target.checked })} className="w-4 h-4 accent-primary" />
            Filtro soft
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-foreground cursor-pointer">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="w-4 h-4 accent-primary" />
            Attiva
          </label>
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Logo testata (opzionale)</label>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg border border-border bg-card flex items-center justify-center overflow-hidden shrink-0">
              {form.logo_url ? <img src={form.logo_url} alt="logo" className="w-full h-full object-contain" /> : <Upload className="w-4 h-4 text-muted-foreground" />}
            </div>
            <input value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} placeholder="URL logo (https://...)" className={`${field} min-w-0`} type="url" />
            <label className="inline-flex items-center gap-1.5 text-xs font-medium text-primary cursor-pointer whitespace-nowrap px-3 py-2.5 min-h-[44px] border border-border rounded-lg hover:bg-muted">
              {uploadingLogo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Carica
              <input type="file" accept="image/*" onChange={onLogoUpload} className="hidden" disabled={uploadingLogo} />
            </label>
            {form.logo_url && <button type="button" onClick={() => setForm({ ...form, logo_url: '' })} className="text-xs text-muted-foreground hover:text-red-600 px-2">Rimuovi</button>}
          </div>
        </div>
        {error && <p className="sm:col-span-2 text-xs text-red-600">{error}</p>}
        <div className="sm:col-span-2">
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 min-h-[44px] rounded-lg text-sm font-medium disabled:opacity-60">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />)}
            {editingId ? 'Salva modifiche' : 'Aggiungi testata'}
          </button>
        </div>
      </form>

      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">Nessuna testata configurata. Aggiungi il primo feed usando il form sopra.</p>
      ) : (
        <div className="space-y-2">
          {items.map((t) => (
            <div key={t.id} className="flex items-center gap-3 bg-muted border border-border rounded-xl p-3">
              <div className="w-10 h-10 rounded-lg border border-border bg-card flex items-center justify-center overflow-hidden shrink-0">
                {t.logo_url ? <img src={t.logo_url} alt="" className="w-full h-full object-contain" /> : <span className="text-sm font-bold text-muted-foreground">{(t.name || '?').charAt(0).toUpperCase()}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{t.name}</p>
                <p className="text-xs text-muted-foreground truncate">{t.url_feed}</p>
                {t.web_url && <a href={t.web_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline mt-0.5">Sito web <ExternalLink className="w-3 h-3" /></a>}
                <div className="flex items-center gap-2 mt-1 flex-wrap text-[11px] text-muted-foreground">
                  <span className="px-1.5 py-0.5 rounded bg-card border border-border">{CAT_OPTIONS.find((o) => o.value === t.category)?.label || t.category}</span>
                  <span className="px-1.5 py-0.5 rounded bg-card border border-border">{SCOPE_OPTIONS.find((o) => o.value === t.scope)?.label || t.scope}</span>
                  <span className="px-1.5 py-0.5 rounded bg-card border border-border">{FREQ_OPTIONS.find((o) => o.value === String(t.update_frequency_minutes || 30))?.label || '30 minuti'}</span>
                  {t.filter && <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">filtro</span>}
                  {!t.is_active && <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700">disattiva</span>}
                </div>
              </div>
              <button onClick={() => toggleActive(t)} aria-label={t.is_active ? 'Disattiva' : 'Attiva'} title={t.is_active ? 'Disattiva' : 'Attiva'} className="text-muted-foreground hover:text-primary p-2 min-w-[44px] min-h-[44px] flex items-center justify-center">
                <Power className={`w-4 h-4 ${t.is_active ? 'text-emerald-600' : 'text-muted-foreground'}`} />
              </button>
              <button onClick={() => edit(t)} aria-label="Modifica" className="text-muted-foreground hover:text-primary p-2 min-w-[44px] min-h-[44px] flex items-center justify-center">
                <Pencil className="w-4 h-4" />
              </button>
              <button onClick={() => remove(t.id)} aria-label="Elimina" className="text-red-500 hover:text-red-700 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
