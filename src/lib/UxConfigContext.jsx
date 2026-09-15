import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { sb44 } from '@/api/supabaseEntities';
import { DEFAULT_UX_CONFIG, applyConfigToDom } from '@/lib/uxConfig';

const Ctx = createContext(null);

export function UxConfigProvider({ children }) {
  const [config, setConfig] = useState(DEFAULT_UX_CONFIG);
  const [loading, setLoading] = useState(true);
  const configRef = useRef(config);
  configRef.current = config;

  const load = useCallback(async () => {
    try {
      const list = await sb44.entities.UxConfig.filter({ key: 'main' }, '-updated_date', 1);
      if (list && list[0]) setConfig({ ...DEFAULT_UX_CONFIG, ...list[0] });
    } catch {
      // keep defaults
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { applyConfigToDom(config); }, [config]);

  const persist = useCallback(async (cfg) => {
    const { id, created_date, updated_date, created_by_id, ...payload } = cfg;
    if (id) {
      await sb44.entities.UxConfig.update(id, payload);
    } else {
      const created = await sb44.entities.UxConfig.create({ ...payload, key: 'main' });
      if (created && created.id) setConfig((c) => ({ ...c, id: created.id }));
    }
  }, []);

  // Ogni modifica dal pannello admin si applica subito all'interfaccia E si
  // salva da sola sul server — non serve più ricordarsi di premere "Salva
  // Configurazione" perché una modifica resti effettiva dopo un ricarico.
  const saveTimer = useRef(null);
  const update = useCallback((partial) => {
    setConfig((c) => {
      const next = { ...c, ...partial };
      configRef.current = next;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => { persist(configRef.current).catch(() => {}); }, 400);
      return next;
    });
  }, [persist]);

  const save = useCallback(async () => { await persist(configRef.current); }, [persist]);

  const reset = useCallback(async () => {
    const defs = { ...DEFAULT_UX_CONFIG, id: configRef.current.id };
    setConfig(defs);
    configRef.current = defs;
    await persist(defs);
  }, [persist]);

  return (
    <Ctx.Provider value={{ config, update, save, reset, loading }}>
      {children}
    </Ctx.Provider>
  );
}

export function useUxConfig() {
  const ctx = useContext(Ctx);
  if (!ctx) return { config: DEFAULT_UX_CONFIG, update: () => {}, save: async () => {}, reset: async () => {}, loading: false };
  return ctx;
}
