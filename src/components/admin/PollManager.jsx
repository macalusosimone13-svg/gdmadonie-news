import { useState, useEffect } from 'react';
import { uploadFile } from '@/lib/uploadFile';
import { sb44 } from '@/api/supabaseEntities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Trash2, X, Pencil, Copy } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { compressImage } from '@/lib/imageCompress';
import { buildPollChartBlob } from '@/lib/storyImage';

const DEFAULT_ROW = () => ({ id: null, party: '', subtitle: '', percentage: '', party_color: '#0F1B3A', logo_url: '' });

export default function PollManager() {
  const [scope, setScope] = useState('nazionale');
  const [institute, setInstitute] = useState('');
  const [surveyDate, setSurveyDate] = useState(new Date().toISOString().slice(0, 10));
  const [turnout, setTurnout] = useState('');
  const [undecided, setUndecided] = useState('');
  const [rows, setRows] = useState([DEFAULT_ROW(), DEFAULT_ROW()]);
  const [saving, setSaving] = useState(false);
  const [uploadingIdx, setUploadingIdx] = useState(null);
  const [done, setDone] = useState(false);
  const [surveys, setSurveys] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [editingKey, setEditingKey] = useState(null);
  const [removedIds, setRemovedIds] = useState([]);

  const loadSurveys = async () => {
    setLoadingList(true);
    try {
      const entries = await sb44.entities.PollEntry.list('-survey_date', 500);
      const grouped = {};
      for (const e of entries) {
        const key = `${e.scope}|${e.survey_date}|${e.institute || ''}`;
        if (!grouped[key]) grouped[key] = { key, scope: e.scope, survey_date: e.survey_date, institute: e.institute, entries: [] };
        grouped[key].entries.push(e);
      }
      setSurveys(Object.values(grouped).sort((a, b) => b.survey_date.localeCompare(a.survey_date)));
    } catch {}
    setLoadingList(false);
  };

  useEffect(() => {loadSurveys();}, []);

  const addRow = () => setRows((r) => [...r, DEFAULT_ROW()]);
  const removeRow = (idx) => setRows((r) => {
    const row = r[idx];
    if (row.id) setRemovedIds((ids) => [...ids, row.id]);
    return r.filter((_, i) => i !== idx);
  });
  const updateRow = (idx, field, value) => setRows((r) => r.map((row, i) => i === idx ? { ...row, [field]: value } : row));

  const uploadLogo = async (idx, file) => {
    setUploadingIdx(idx);
    try {
      const compressed = await compressImage(file, { maxDim: 300, quality: 0.85 });
      const res = await uploadFile(compressed);
      updateRow(idx, 'logo_url', res.file_url);
    } catch {
      alert('Caricamento fallito');
    }
    setUploadingIdx(null);
  };

  const resetForm = () => {
    setEditingKey(null);
    setRemovedIds([]);
    setScope('nazionale');
    setInstitute('');
    setSurveyDate(new Date().toISOString().slice(0, 10));
    setTurnout('');
    setUndecided('');
    setRows([DEFAULT_ROW(), DEFAULT_ROW()]);
  };

  const startEdit = (survey) => {
    setEditingKey(survey.key);
    setRemovedIds([]);
    setScope(survey.scope);
    setInstitute(survey.institute || '');
    setSurveyDate(survey.survey_date);
    setTurnout(survey.entries[0]?.turnout || '');
    setUndecided(survey.entries[0]?.undecided || '');
    setRows(survey.entries.map((e) => {
      const [party, subtitle = ''] = (e.party || '').split('\n');
      return { id: e.id, party, subtitle, percentage: String(e.percentage), party_color: e.party_color || '#0F1B3A', logo_url: e.logo_url || '' };
    }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const duplicateAsUpdate = (survey) => {
    setEditingKey(null);
    setRemovedIds([]);
    setScope(survey.scope);
    setInstitute(survey.institute || '');
    setSurveyDate(new Date().toISOString().slice(0, 10));
    setTurnout('');
    setUndecided('');
    setRows(survey.entries.map((e) => {
      const [party, subtitle = ''] = (e.party || '').split('\n');
      return { id: null, party, subtitle, percentage: String(e.percentage), party_color: e.party_color || '#0F1B3A', logo_url: e.logo_url || '' };
    }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const SCOPE_TITLES = { nazionale: 'Sondaggi Nazionali', regionale: 'Sondaggi Regionali (liste)', candidati_sicilia: 'Intenzioni di voto regionali siciliane - candidati' };
  const updateSondaggiPreview = async (currentScope, items, dateStr, instituteStr, turnoutStr, undecidedStr) => {
    if (!items.length) return;
    try {
      const pollCfg = { brand_title: 'Madonie News', brand_subtitle: 'Giovani Democratici Madonie', logo_url: '', logo_size: 140, background_color: '#f5f5f5', title_color: '', category_bg_color: '#ffffff', category_text_color: '#0F1B3A', domain_text: 'gdmadonie-news.com', show_category: true, show_domain: true, top_band_enabled: false, top_band_color: '#000000', top_band_opacity: 0.35, category_gap: 28 };
      try {
        const cfgs = await sb44.entities.StoryShareConfig.filter({ key: 'poll_share' }, '-updated_date', 1);
        if (cfgs?.[0]) Object.assign(pollCfg, cfgs[0]);
      } catch {}
      let siteLogo = '';
      try {
        const logos = await sb44.entities.SiteContent.filter({ key: 'site_logo_url' }, '-updated_date', 1);
        siteLogo = logos?.[0]?.value || '';
      } catch {}
      const subtitle = [
      format(new Date(dateStr), 'd MMMM yyyy', { locale: it }),
      instituteStr.trim(),
      turnoutStr.trim() ? `affluenza ${turnoutStr.trim()}` : null,
      undecidedStr.trim() ? `non si esprime ${undecidedStr.trim()}` : null].
      filter(Boolean).join(' · ');
      const blob = await buildPollChartBlob({
        format: 'post',
        category: SCOPE_TITLES[currentScope] || 'Sondaggi',
        subtitle,
        items,
        domain: pollCfg.domain_text || 'gdmadonie-news.com',
        primaryColor: pollCfg.background_color || '#f5f5f5',
        logoUrl: pollCfg.logo_url || siteLogo,
        brandTitle: pollCfg.brand_title,
        brandSubtitle: pollCfg.brand_subtitle,
        bgGradientStart: pollCfg.background_color || '#f5f5f5',
        bgGradientEnd: pollCfg.background_color || '#f5f5f5',
        categoryBg: pollCfg.category_bg_color,
        categoryText: pollCfg.category_text_color,
        titleColor: pollCfg.title_color || undefined,
        logoSize: pollCfg.logo_size,
        showCategory: pollCfg.show_category,
        showDomain: pollCfg.show_domain,
        topBandEnabled: pollCfg.top_band_enabled,
        topBandColor: pollCfg.top_band_color,
        topBandOpacity: pollCfg.top_band_opacity,
        categoryGap: pollCfg.category_gap
      });
      const file = new File([blob], 'sondaggi-preview.png', { type: 'image/png' });
      const { file_url } = await uploadFile(file);
      const contentKey = `sondaggi_preview_image_url_${currentScope}`;
      const existing = await sb44.entities.SiteContent.filter({ key: contentKey }, '-updated_date', 1);
      if (existing?.[0]) await sb44.entities.SiteContent.update(existing[0].id, { value: file_url });
      else await sb44.entities.SiteContent.create({ key: contentKey, value: file_url });
    } catch {
      // Se la generazione dell'anteprima fallisce, il sondaggio e' comunque
      // salvato correttamente: non blocchiamo l'utente per questo.
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    const validRows = rows.filter((r) => r.party.trim() && r.percentage !== '');
    if (!validRows.length || !surveyDate) return;

    const sum = validRows.reduce((tot, r) => tot + (Number(r.percentage) || 0), 0);
    if (sum > 100.5) {
      if (!confirm(`Attenzione: le percentuali sommate fanno ${sum.toFixed(1)}%, pi\xF9 di 100. Controlla i numeri prima di continuare.\n\nSalvare comunque?`)) return;
    }
    if (!editingKey) {
      const dupe = surveys.find((s) => s.scope === scope && s.survey_date === surveyDate && (s.institute || '') === institute.trim());
      if (dupe) {
        if (!confirm(`Esiste gi\xE0 un sondaggio ${scopeLabel(scope)} del ${format(new Date(surveyDate), 'd MMMM yyyy', { locale: it })}${institute.trim() ? ' (' + institute.trim() + ')' : ''}. Salvando, si aggiungeranno altre righe a quello stesso sondaggio invece di crearne uno nuovo.\n\nContinuare?`)) return;
      }
    }

    setSaving(true);
    try {
      for (const row of validRows) {
        const payload = {
          scope,
          institute: institute.trim() || undefined,
          survey_date: surveyDate,
          party: row.subtitle.trim() ? `${row.party.trim()}\n${row.subtitle.trim()}` : row.party.trim(),
          percentage: Number(row.percentage),
          party_color: row.party_color || undefined,
          logo_url: row.logo_url || undefined,
          turnout: turnout.trim() || undefined,
          undecided: undecided.trim() || undefined
        };
        if (row.id) await sb44.entities.PollEntry.update(row.id, payload);
        else await sb44.entities.PollEntry.create(payload);
      }
      for (const id of removedIds) {
        try {await sb44.entities.PollEntry.delete(id);} catch {}
      }
      const previewItems = [...validRows].
      sort((a, b) => Number(b.percentage) - Number(a.percentage)).
      map((r) => ({
        party: r.subtitle.trim() ? `${r.party.trim()}\n${r.subtitle.trim()}` : r.party.trim(),
        percentage: Number(r.percentage),
        color: r.party_color,
        logo_url: r.logo_url
      }));
      updateSondaggiPreview(scope, previewItems, surveyDate, institute, turnout, undecided);
      resetForm();
      setDone(true);
      setTimeout(() => setDone(false), 2500);
      loadSurveys();
    } catch (err) {
      alert('Errore: ' + (err.response?.data?.message || err.message));
    }
    setSaving(false);
  };

  const deleteSurvey = async (survey) => {
    if (!confirm(`Eliminare il sondaggio del ${format(new Date(survey.survey_date), 'd MMMM yyyy', { locale: it })}${survey.institute ? ' (' + survey.institute + ')' : ''}?`)) return;
    try {
      await Promise.all(survey.entries.map((e) => sb44.entities.PollEntry.delete(e.id)));
      if (editingKey === survey.key) resetForm();
      loadSurveys();
    } catch {
      alert('Eliminazione non riuscita');
    }
  };

  const scopeLabel = (s) => s === 'nazionale' ? 'Nazionale' : s === 'regionale' ? 'Regionale (liste)' : 'Intenzioni di voto regionali siciliane - candidati';

  return (
    <div className="space-y-8">
      <form onSubmit={submit} className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold text-foreground text-sm">{editingKey ? 'Modifica sondaggio' : 'Aggiungi un sondaggio'}</h3>
          {editingKey && <button type="button" onClick={resetForm} className="text-xs font-medium text-muted-foreground hover:text-foreground">Annulla modifica</button>}
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Ambito</Label>
            <Select value={scope} onValueChange={setScope}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nazionale">Nazionale</SelectItem>
                <SelectItem value="regionale">Regionale (liste, Sicilia)</SelectItem>
                <SelectItem value="candidati_sicilia">Intenzioni di voto regionali siciliane - candidati</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Data sondaggio</Label>
            <Input type="date" value={surveyDate} onChange={(e) => setSurveyDate(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Istituto (opzionale)</Label>
            <Input value={institute} onChange={(e) => setInstitute(e.target.value)} placeholder="es. SWG, Ipsos, Tecnè" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Affluenza stimata (opzionale)</Label>
            <Input value={turnout} onChange={(e) => setTurnout(e.target.value)} placeholder="es. 44-48%" />
            <p className="text-[11px] text-muted-foreground">Lascia vuoto se il sondaggio non la indica: non comparirà.</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Non si esprime (opzionale)</Label>
            <Input value={undecided} onChange={(e) => setUndecided(e.target.value)} placeholder="es. 27% (-3)" />
            <p className="text-[11px] text-muted-foreground">Lascia vuoto se non presente: non comparirà.</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Partiti e percentuali</Label>
          {rows.map((row, idx) =>
          <div key={idx} className="flex items-center gap-2">
              <label className="shrink-0 w-9 h-9 rounded-full bg-muted border border-border flex items-center justify-center overflow-hidden cursor-pointer" title="Carica logo/foto">
                {uploadingIdx === idx ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : row.logo_url ? <img src={row.logo_url} alt="" className="w-full h-full object-cover" /> : <Plus className="w-4 h-4 text-muted-foreground" />}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => {if (e.target.files?.[0]) uploadLogo(idx, e.target.files[0]);e.target.value = '';}} />
              </label>
              <div className="flex-1 flex items-center gap-1.5">
                <Input value={row.party} onChange={(e) => updateRow(idx, 'party', e.target.value)} placeholder="Nome partito/lista/candidato" className="flex-1" />
                <Input value={row.subtitle} onChange={(e) => updateRow(idx, 'subtitle', e.target.value)} placeholder="Sottotitolo (es. leader, opzionale)" className="flex-1" />
              </div>
              <Input type="number" step="0.1" min="0" max="100" value={row.percentage} onChange={(e) => updateRow(idx, 'percentage', e.target.value)} placeholder="%" className="w-24" />
              <input type="color" value={row.party_color} onChange={(e) => updateRow(idx, 'party_color', e.target.value)} className="w-9 h-9 rounded-full border border-border bg-transparent cursor-pointer p-0 shrink-0" />
              <button type="button" onClick={() => removeRow(idx)} className="text-muted-foreground hover:text-red-600 p-2 shrink-0" aria-label="Rimuovi riga"><X className="w-4 h-4" /></button>
            </div>
          )}
          <button type="button" onClick={addRow} className="text-xs font-medium text-primary hover:underline flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Aggiungi partito</button>
        </div>

        <Button type="submit" disabled={saving} className="w-full">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          {done ? 'Salvato!' : editingKey ? 'Salva modifiche' : 'Salva sondaggio'}
        </Button>
      </form>

      <div className="space-y-3 pt-6 border-t border-border">
        <h3 className="font-semibold text-foreground text-sm">Sondaggi inseriti</h3>
        {loadingList ?
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /> :
        surveys.length === 0 ?
        <p className="text-sm text-muted-foreground">Nessun sondaggio ancora inserito.</p> :

        <div className="space-y-2">
            {surveys.map((s) =>
          <div key={s.key} className={`flex items-center justify-between gap-3 rounded-xl p-3 ${editingKey === s.key ? 'bg-primary/10 border border-primary/30' : 'bg-muted/50'}`}>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {scopeLabel(s.scope)} · {format(new Date(s.survey_date), 'd MMMM yyyy', { locale: it })}
                    {s.institute && <span className="text-muted-foreground"> · {s.institute}</span>}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{s.entries.map((e) => `${e.party} ${e.percentage}%`).join(' · ')}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => duplicateAsUpdate(s)} className="text-muted-foreground hover:text-primary p-2 min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Duplica per aggiornare" title="Duplica per un nuovo aggiornamento (stessi partiti/loghi, data di oggi)"><Copy className="w-4 h-4" /></button>
                  <button onClick={() => startEdit(s)} className="text-muted-foreground hover:text-primary p-2 min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Modifica sondaggio" title="Modifica"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => deleteSurvey(s)} className="text-red-500 hover:text-red-700 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Elimina sondaggio"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
          )}
          </div>
        }
      </div>
    </div>);

}
