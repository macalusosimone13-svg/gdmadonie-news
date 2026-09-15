import { useState, useEffect } from 'react';
import { sb44 } from '@/api/supabaseEntities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, Trash2, X } from 'lucide-react';

export default function CoalitionGroupManager() {
  const [groups, setGroups] = useState([]);
  const [availableParties, setAvailableParties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [groupData, pollData] = await Promise.all([
      sb44.entities.CoalitionGroup.list('sort_order', 50),
      sb44.entities.PollEntry.filter({ scope: 'nazionale' }, '-survey_date', 500)]
      );
      setGroups(groupData || []);
      const names = new Set();
      (pollData || []).forEach((p) => {if (p.party) names.add(p.party.split('\n')[0].trim());});
      setAvailableParties(Array.from(names).sort((a, b) => a.localeCompare(b)));
    } catch {}
    setLoading(false);
  };

  useEffect(() => {load();}, []);

  const updateGroup = (idx, changes) => {
    setGroups((prev) => prev.map((g, i) => i === idx ? { ...g, ...changes } : g));
  };

  const toggleParty = (idx, party) => {
    setGroups((prev) => prev.map((g, i) => {
      if (i !== idx) return g;
      const has = (g.party_names || []).includes(party);
      return { ...g, party_names: has ? g.party_names.filter((p) => p !== party) : [...(g.party_names || []), party] };
    }));
  };

  const addGroup = () => {
    setGroups((prev) => [...prev, { id: null, label: '', color: '#0F1B3A', party_names: [], sort_order: prev.length + 1, isNew: true }]);
  };

  const removeGroup = async (idx) => {
    const g = groups[idx];
    if (!confirm(`Eliminare il gruppo "${g.label || '(senza nome)'}"?`)) return;
    if (g.id) {
      try {await sb44.entities.CoalitionGroup.delete(g.id);} catch {}
    }
    setGroups((prev) => prev.filter((_, i) => i !== idx));
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      for (const [idx, g] of groups.entries()) {
        const payload = { label: g.label.trim(), color: g.color, party_names: g.party_names || [], sort_order: idx + 1 };
        if (g.id) await sb44.entities.CoalitionGroup.update(g.id, payload);
        else {
          const created = await sb44.entities.CoalitionGroup.create(payload);
          updateGroup(idx, { id: created.id, isNew: false });
        }
      }
      await load();
    } catch {
      alert('Salvataggio non riuscito, riprova.');
    }
    setSaving(false);
  };

  if (loading) return <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-foreground text-sm">Coalizioni (Sondaggi Nazionali)</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Il riquadro "Coalizioni" nella pagina pubblica somma i partiti di ogni gruppo qui sotto. Aggiungi, togli o sposta un partito quando cambiano gli equilibri politici — nessuna modifica al codice necessaria.</p>
      </div>

      {availableParties.length === 0 &&
      <p className="text-sm text-muted-foreground">Inserisci prima almeno un sondaggio Nazionale in "Sondaggi", poi torna qui per assegnare i partiti ai gruppi.</p>
      }

      <div className="space-y-4">
        {groups.map((g, idx) =>
        <div key={g.id || `new-${idx}`} className="border border-border rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <input type="color" value={g.color || '#0F1B3A'} onChange={(e) => updateGroup(idx, { color: e.target.value })} className="w-9 h-9 rounded-full border border-border bg-transparent cursor-pointer p-0 shrink-0" />
              <Input value={g.label} onChange={(e) => updateGroup(idx, { label: e.target.value })} placeholder="Nome del gruppo (es. Campo Largo)" className="flex-1" />
              <button type="button" onClick={() => removeGroup(idx)} className="text-muted-foreground hover:text-red-600 p-2 shrink-0" aria-label="Elimina gruppo"><Trash2 className="w-4 h-4" /></button>
            </div>
            <div>
              <Label className="text-xs">Partiti in questo gruppo</Label>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {availableParties.map((party) => {
                const active = (g.party_names || []).includes(party);
                return (
                  <button
                    key={party}
                    type="button"
                    onClick={() => toggleParty(idx, party)}
                    className={`text-xs font-medium px-3 py-2 min-h-[38px] rounded-full border transition-colors ${active ? 'bg-primary text-primary-foreground border-transparent' : 'bg-muted text-muted-foreground border-border/50 hover:bg-muted/70'}`}>

                      {party}
                    </button>);

              })}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button type="button" onClick={addGroup} className="text-sm font-medium text-primary hover:underline flex items-center gap-1.5"><Plus className="w-4 h-4" /> Aggiungi gruppo</button>
      </div>

      <Button onClick={saveAll} disabled={saving} className="w-full">
        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
        Salva coalizioni
      </Button>
    </div>);

}
