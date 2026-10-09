import { useRef, useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Heading2, Bold, List, Table, Quote, Link2, Eye, PenLine } from 'lucide-react';
import ArticleBody from '@/components/ArticleBody';
import { hasStructure, htmlToMarkdown } from '@/lib/htmlToMarkdown';
import TableGrid, { tableAt } from '@/components/admin/TableGrid';

// Campo "Testo" degli articoli GD. È un normale campo di testo con in più:
//  - una barra di pulsanti che inserisce titoletti, grassetti, elenchi e
//    riquadri in evidenza senza dover ricordare i simboli;
//  - "Tabella": una griglia da riempire come un foglio di calcolo (se il
//    cursore è già dentro una tabella, la riapre per correggerla);
//  - l'incolla "intelligente": un articolo copiato da un documento (Claude,
//    Word, Google Docs) mantiene tabelle, titoletti e grassetti;
//  - l'anteprima, per vedere il testo come apparirà sul sito.
const BTN = 'inline-flex items-center gap-1.5 h-8 px-2.5 rounded-full border border-border bg-card text-xs font-semibold text-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-40';

export default function ArticleEditor({ value, onChange, rows = 10, placeholder = 'Testo...', preview = true }) {
  const ref = useRef(null);
  const [showPreview, setShowPreview] = useState(false);
  // griglia della tabella aperta: { da, a } è il tratto di testo da sostituire, celle la tabella da correggere (se c'è)
  const [griglia, setGriglia] = useState(null);

  // sostituisce il tratto [da, a) con `testo` e rimette il cursore / la selezione
  const sostituisci = (da, a, testo, selDa, selA) => {
    onChange(value.slice(0, da) + testo + value.slice(a));
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(da + (selDa ?? testo.length), da + (selA ?? selDa ?? testo.length));
    });
  };
  const selezione = () => {
    const el = ref.current;
    return el ? [el.selectionStart, el.selectionEnd] : [value.length, value.length];
  };
  // inserisce un blocco a sé, lasciando una riga vuota prima e dopo
  const blocco = (testo, selDa, selA, tratto) => {
    const [da, a] = tratto || selezione();
    const prima = value.slice(0, da);
    const dopo = value.slice(a);
    const pre = !prima || prima.endsWith('\n\n') ? '' : prima.endsWith('\n') ? '\n' : '\n\n';
    const post = !dopo || dopo.startsWith('\n\n') ? '' : dopo.startsWith('\n') ? '\n' : '\n\n';
    sostituisci(da, a, pre + testo + post, selDa == null ? undefined : pre.length + selDa, selA == null ? undefined : pre.length + selA);
  };
  // mette `segno` all'inizio di ogni riga selezionata (o della riga del cursore)
  const prefisso = (segno, esempio) => {
    const [da, a] = selezione();
    if (da === a && (da === 0 || value[da - 1] === '\n') && (da === value.length || value[da] === '\n')) {
      blocco(segno + esempio, segno.length, segno.length + esempio.length);
      return;
    }
    const inizio = value.lastIndexOf('\n', da - 1) + 1;
    let fine = value.indexOf('\n', a);
    if (fine === -1) fine = value.length;
    const righe = value.slice(inizio, fine).split('\n').map((r) => r.trim() ? segno + r.replace(/^\s*(?:#{1,6}|>|[-*+])\s+/, '') : r).join('\n');
    sostituisci(inizio, fine, righe);
  };
  const avvolgi = (segno, esempio) => {
    const [da, a] = selezione();
    const scelto = value.slice(da, a) || esempio;
    sostituisci(da, a, segno + scelto + segno, segno.length, segno.length + scelto.length);
  };
  const link = () => {
    const [da, a] = selezione();
    const scelto = value.slice(da, a) || 'testo del link';
    const testo = `[${scelto}](https://)`;
    sostituisci(da, a, testo, testo.length - 1);
  };

  const apriGriglia = () => {
    const [da, a] = selezione();
    const esistente = da === a ? tableAt(value, da) : null;
    setGriglia(esistente || { da, a, celle: null });
  };
  const chiudiGriglia = (testo) => {
    const g = griglia;
    setGriglia(null);
    if (testo) blocco(testo, undefined, undefined, [g.da, g.a]);
    else requestAnimationFrame(() => ref.current?.focus());
  };

  const onPaste = (e) => {
    const html = e.clipboardData?.getData('text/html');
    if (!hasStructure(html)) return; // testo semplice: incolla normale
    let md = '';
    try { md = htmlToMarkdown(html); } catch { return; }
    if (!md) return;
    e.preventDefault();
    blocco(md);
  };

  const fermo = showPreview || !!griglia;
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" className={BTN} disabled={fermo} onClick={() => prefisso('## ', 'Titoletto')} title="Titoletto di una sezione"><Heading2 className="w-3.5 h-3.5" /> Titoletto</button>
        <button type="button" className={BTN} disabled={fermo} onClick={() => avvolgi('**', 'testo in grassetto')} title="Grassetto"><Bold className="w-3.5 h-3.5" /> Grassetto</button>
        <button type="button" className={BTN} disabled={fermo} onClick={() => prefisso('- ', 'Primo punto')} title="Elenco puntato"><List className="w-3.5 h-3.5" /> Elenco</button>
        <button type="button" className={BTN} disabled={fermo} onClick={apriGriglia} title="Apre una griglia da riempire. Con il cursore dentro una tabella già scritta, la riapre per correggerla"><Table className="w-3.5 h-3.5" /> Tabella</button>
        <button type="button" className={BTN} disabled={fermo} onClick={() => prefisso('> ', 'Frase o dato da mettere in evidenza')} title="Riquadro colorato per una frase o un dato importante"><Quote className="w-3.5 h-3.5" /> In evidenza</button>
        <button type="button" className={BTN} disabled={fermo} onClick={link} title="Link"><Link2 className="w-3.5 h-3.5" /> Link</button>
        {preview &&
        <button type="button" className={`${BTN} ml-auto`} disabled={!!griglia || (!showPreview && !value.trim())} onClick={() => setShowPreview((v) => !v)}>
            {showPreview ? <><PenLine className="w-3.5 h-3.5" /> Modifica</> : <><Eye className="w-3.5 h-3.5" /> Anteprima</>}
          </button>
        }
      </div>
      {griglia ?
      <TableGrid initial={griglia.celle} onConfirm={chiudiGriglia} onCancel={() => chiudiGriglia('')} /> :
      showPreview ?
      <div className="rd rounded-md border border-input bg-card px-4 py-4"><ArticleBody text={value} /></div> :
      <Textarea ref={ref} value={value} onChange={(e) => onChange(e.target.value)} onPaste={onPaste} rows={rows} placeholder={placeholder} />
      }
      <p className="text-[11px] text-muted-foreground">Puoi incollare un articolo già impaginato (da Claude, Word o Google Docs): tabelle, titoletti e grassetti restano.</p>
    </div>);
}
