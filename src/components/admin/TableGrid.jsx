import { useState } from 'react';
import { Plus, Minus, Check, X } from 'lucide-react';

// Griglia per comporre una tabella come in un foglio di calcolo: si riempiono
// le caselle e il testo con le barre "|" lo scrive il sito. La prima riga è
// l'intestazione (quella blu). Si può anche incollare un blocco di celle
// copiato da Excel o Fogli Google: si distribuisce da solo nelle caselle.

const SEPARATORE = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;
const RIGA_TABELLA = /^\s*\|.*\|\s*$/;

// Se il cursore è dentro una tabella già scritta, la restituisce come griglia
// insieme al tratto di testo che occupa, così la si può correggere.
export function tableAt(text, pos) {
  const righe = text.split('\n');
  let inizio = 0;
  let i = 0;
  for (; i < righe.length; i++) {
    if (pos <= inizio + righe[i].length) break;
    inizio += righe[i].length + 1;
  }
  if (i >= righe.length || !RIGA_TABELLA.test(righe[i])) return null;
  let primo = i;
  let ultimo = i;
  while (primo > 0 && RIGA_TABELLA.test(righe[primo - 1])) primo -= 1;
  while (ultimo < righe.length - 1 && RIGA_TABELLA.test(righe[ultimo + 1])) ultimo += 1;
  const da = righe.slice(0, primo).reduce((n, r) => n + r.length + 1, 0);
  const a = da + righe.slice(primo, ultimo + 1).join('\n').length;
  const celle = righe.slice(primo, ultimo + 1)
    .filter((r) => !SEPARATORE.test(r))
    .map((r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()));
  if (!celle.length) return null;
  return { da, a, celle: quadra(celle) };
}

// tutte le righe con lo stesso numero di colonne, almeno 2 colonne e 2 righe
function quadra(celle) {
  const colonne = Math.max(2, ...celle.map((r) => r.length));
  const out = celle.map((r) => Array.from({ length: colonne }, (_, i) => r[i] ?? ''));
  while (out.length < 2) out.push(Array(colonne).fill(''));
  return out;
}

export function tableToText(celle) {
  const pulita = (c) => String(c ?? '').replace(/\s*\n\s*/g, ' ').replace(/\|/g, '/').trim() || ' ';
  const riga = (r) => `| ${r.map(pulita).join(' | ')} |`;
  return [riga(celle[0]), `| ${celle[0].map(() => '---').join(' | ')} |`, ...celle.slice(1).map(riga)].join('\n');
}

const NUOVA = [['', ''], ['', ''], ['', '']];
const PICCOLO = 'inline-flex items-center gap-1 h-8 px-2.5 rounded-full border border-border bg-card text-xs font-semibold text-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-40';

export default function TableGrid({ initial, onConfirm, onCancel }) {
  const [celle, setCelle] = useState(() => quadra(initial?.length ? initial : NUOVA));
  const colonne = celle[0].length;
  const vuota = celle.every((r) => r.every((c) => !c.trim()));

  const scrivi = (r, c, v) => setCelle((g) => g.map((riga, i) => i === r ? riga.map((x, j) => j === c ? v : x) : riga));
  const piuRiga = () => setCelle((g) => [...g, Array(g[0].length).fill('')]);
  const menoRiga = () => setCelle((g) => g.length > 2 ? g.slice(0, -1) : g);
  const piuColonna = () => setCelle((g) => g.map((r) => [...r, '']));
  const menoColonna = () => setCelle((g) => g[0].length > 2 ? g.map((r) => r.slice(0, -1)) : g);

  // celle copiate da un foglio di calcolo: righe separate da "a capo", colonne da tabulazione
  const incolla = (e, r, c) => {
    const testo = e.clipboardData?.getData('text/plain') || '';
    if (!/[\t\n]/.test(testo.trim())) return;
    e.preventDefault();
    const blocco = testo.replace(/\r/g, '').replace(/\n+$/, '').split('\n').map((x) => x.split('\t'));
    setCelle((g) => {
      const righe = Math.max(g.length, r + blocco.length);
      const col = Math.max(g[0].length, c + Math.max(...blocco.map((x) => x.length)));
      const out = Array.from({ length: righe }, (_, i) => Array.from({ length: col }, (_, j) => g[i]?.[j] ?? ''));
      blocco.forEach((x, i) => x.forEach((v, j) => { out[r + i][c + j] = v.trim(); }));
      return out;
    });
  };

  return (
    <div className="rounded-md border border-input bg-card p-3 space-y-3">
      <p className="text-xs text-muted-foreground">Riempi le caselle. La prima riga è l'intestazione della tabella. Puoi incollare celle copiate da Excel.</p>
      <div className="overflow-x-auto">
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${colonne}, minmax(120px, 1fr))` }}>
          {celle.map((riga, r) => riga.map((v, c) =>
          <input
            key={`${r}-${c}`}
            value={v}
            onChange={(e) => scrivi(r, c, e.target.value)}
            onPaste={(e) => incolla(e, r, c)}
            aria-label={r === 0 ? `Intestazione colonna ${c + 1}` : `Riga ${r}, colonna ${c + 1}`}
            placeholder={r === 0 ? `Colonna ${c + 1}` : ''}
            className={`h-9 min-w-0 rounded-md border px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 ${r === 0 ? 'bg-[#0F1B3A] text-white placeholder:text-white/50 border-[#0F1B3A] font-semibold' : 'bg-background text-foreground border-input'}`} />
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" className={PICCOLO} onClick={piuRiga}><Plus className="w-3.5 h-3.5" /> Riga</button>
        <button type="button" className={PICCOLO} onClick={menoRiga} disabled={celle.length <= 2}><Minus className="w-3.5 h-3.5" /> Riga</button>
        <button type="button" className={PICCOLO} onClick={piuColonna}><Plus className="w-3.5 h-3.5" /> Colonna</button>
        <button type="button" className={PICCOLO} onClick={menoColonna} disabled={colonne <= 2}><Minus className="w-3.5 h-3.5" /> Colonna</button>
        <span className="ml-auto flex gap-1.5">
          <button type="button" className={PICCOLO} onClick={onCancel}><X className="w-3.5 h-3.5" /> Annulla</button>
          <button type="button" disabled={vuota} onClick={() => onConfirm(tableToText(celle))} className="inline-flex items-center gap-1 h-8 px-3 rounded-full bg-[#2F5BD8] text-white text-xs font-bold disabled:opacity-40 hover:bg-[#2A4FC0] transition-colors"><Check className="w-3.5 h-3.5" /> {initial ? 'Aggiorna tabella' : 'Inserisci tabella'}</button>
        </span>
      </div>
    </div>);
}
