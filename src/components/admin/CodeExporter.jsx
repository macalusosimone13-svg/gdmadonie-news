import { useMemo, useState } from 'react';
import { Download, Copy, Code2, Check, FileCode, Loader2 } from 'lucide-react';

const srcFiles = import.meta.glob('/src/**/*.{js,jsx,ts,tsx,css}', { query: '?raw', import: 'default' });
const base44Files = import.meta.glob('/base44/**/*.{ts,jsonc}', { query: '?raw', import: 'default' });
const rootFiles = import.meta.glob('/{vite,tailwind,postcss,eslint}.config.{js,ts,cjs}', { query: '?raw', import: 'default' });

const LANG_MAP = {
  js: 'javascript', jsx: 'jsx', ts: 'typescript', tsx: 'tsx',
  css: 'css', json: 'json', jsonc: 'jsonc', html: 'html', cjs: 'javascript'
};

export default function CodeExporter() {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const allPaths = useMemo(() => {
    const combined = { ...rootFiles, ...srcFiles, ...base44Files };
    return Object.keys(combined).sort((a, b) => a.localeCompare(b));
  }, []);

  const grouped = useMemo(() => {
    const g = { root: [], src: [], base44: [] };
    for (const p of allPaths) {
      if (p.startsWith('/src/')) g.src.push(p);
      else if (p.startsWith('/base44/')) g.base44.push(p);
      else g.root.push(p);
    }
    return g;
  }, [allPaths]);

  const loadAll = async () => {
    const combined = { ...rootFiles, ...srcFiles, ...base44Files };
    const entries = Object.entries(combined);
    const results = await Promise.all(
      entries.map(async ([path, loader]) => {
        try {
          const content = await loader();
          return [path, typeof content === 'string' ? content : String(content ?? '')];
        } catch {
          return [path, ''];
        }
      })
    );
    return results.filter(([, c]) => typeof c === 'string');
  };

  const buildMarkdown = async () => {
    const allFiles = await loadAll();
    const now = new Date().toLocaleString('it-IT');
    const index = allFiles.map(([p]) => `- \`${p}\``).join('\n');
    const body = allFiles.map(([p, content]) => {
      const ext = p.split('.').pop();
      const lang = LANG_MAP[ext] || '';
      return `## ${p}\n\n\`\`\`${lang}\n${content}\n\`\`\``;
    }).join('\n\n---\n\n');
    const totalSize = allFiles.reduce((s, [, c]) => s + c.length, 0);
    return `# Codice sorgente — GD Madonie News\n\nEsportato il ${now} · ${allFiles.length} file · ${(totalSize / 1024).toFixed(1)} KB\n\n## Indice\n\n${index}\n\n---\n\n${body}\n`;
  };

  const handleDownload = async () => {
    setLoading(true);
    try {
      const md = await buildMarkdown();
      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gd-madonie-codice-${new Date().toISOString().slice(0, 10)}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    setLoading(true);
    try {
      const md = await buildMarkdown();
      await navigator.clipboard.writeText(md);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <div>
        <h3 className="font-semibold text-foreground flex items-center gap-2"><Code2 className="w-5 h-5 text-primary" /> Esporta codice sorgente</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Scarica tutto il codice dell'app in un unico file Markdown, pronto da condividere con Claude AI o altri assistenti per lavorarci.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button onClick={handleDownload} disabled={loading} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 min-h-[44px] rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Scarica Markdown
        </button>
        <button onClick={handleCopy} disabled={loading} className="flex items-center gap-2 border border-border px-4 py-2.5 min-h-[44px] rounded-xl text-sm font-medium hover:bg-muted disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />} {copied ? 'Copiato!' : 'Copia negli appunti'}
        </button>
      </div>
      <div className="text-xs text-muted-foreground">{allPaths.length} file pronti per l'esportazione</div>
      <div className="space-y-3 max-h-80 overflow-y-auto border-t border-border pt-3">
        {Object.entries(grouped).map(([dir, files]) => files.length > 0 && (
          <div key={dir}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{dir === 'root' ? 'root' : dir + '/'}</p>
            <div className="space-y-0.5 pl-2">
              {files.map((p) => (
                <p key={p} className="text-xs text-foreground font-mono flex items-center gap-1.5"><FileCode className="w-3 h-3 text-muted-foreground" />{p}</p>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
