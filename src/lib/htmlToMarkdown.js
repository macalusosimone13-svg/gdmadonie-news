// Quando si incolla nel campo "Testo" un articolo copiato da un documento
// (Claude, Word, Google Docs, una pagina web) il browser porta con sé anche la
// versione HTML: da lì si ricostruiscono titoletti, grassetti, elenchi,
// tabelle e riquadri, così non si perde l'impaginazione e non serve scrivere
// i simboli a mano.

const STRUTTURA = /<(table|h[1-6]|ul|ol|blockquote|strong|b|a)[\s>]/i;

// true se nell'HTML incollato c'è qualcosa che vale la pena conservare
export function hasStructure(html) {
  return !!html && STRUTTURA.test(html);
}

const pulisci = (s) => s.replace(/ /g, ' ').replace(/[ \t\r\n]+/g, ' ');
const peso = (el) => {
  const w = (el.getAttribute('style') || '').match(/font-weight\s*:\s*([a-z0-9]+)/i);
  if (!w) return null;
  return w[1] === 'bold' || w[1] === 'bolder' || parseInt(w[1], 10) >= 600;
};
const corsivo = (el) => /font-style\s*:\s*italic/i.test(el.getAttribute('style') || '');
// avvolge il testo nei simboli tenendo fuori gli spazi ai bordi ("** testo**" non verrebbe letto come grassetto)
const avvolgi = (t, segno) => {
  const m = t.match(/^(\s*)([\s\S]*?)(\s*)$/);
  return m[2] ? `${m[1]}${segno}${m[2]}${segno}${m[3]}` : t;
};

function inline(node) {
  let out = '';
  node.childNodes.forEach((n) => {
    if (n.nodeType === 3) { out += pulisci(n.nodeValue); return; }
    if (n.nodeType !== 1) return;
    const tag = n.tagName.toLowerCase();
    if (tag === 'br') { out += '\n'; return; }
    if (['script', 'style', 'meta', 'head', 'title', 'button', 'svg'].includes(tag)) return;
    const dentro = inline(n);
    if (tag === 'a') {
      const href = n.getAttribute('href') || '';
      out += /^https?:\/\//i.test(href) && dentro.trim() ? `[${dentro.trim()}](${href})` : dentro;
      return;
    }
    const p = peso(n);
    const forte = (tag === 'strong' || tag === 'b') ? p !== false : p === true;
    const obliquo = tag === 'em' || tag === 'i' || corsivo(n);
    let t = dentro;
    if (obliquo) t = avvolgi(t, '*');
    if (forte) t = avvolgi(t, '**');
    out += t;
  });
  return out;
}

const cella = (el) => inline(el).replace(/\n+/g, ' ').replace(/\|/g, '/').trim();

function tabella(el) {
  const righe = [...el.querySelectorAll('tr')].map((tr) => [...tr.children].filter((c) => /^(td|th)$/i.test(c.tagName)).map(cella));
  const piene = righe.filter((r) => r.some(Boolean));
  if (!piene.length) return '';
  const colonne = Math.max(...piene.map((r) => r.length));
  const riga = (r) => `| ${Array.from({ length: colonne }, (_, i) => r[i] || ' ').join(' | ')} |`;
  // senza grassetto nell'intestazione: lo stile lo dà già la tabella
  const testa = piene[0].map((c) => c.replace(/^\*\*(.*)\*\*$/, '$1'));
  return [riga(testa), `| ${Array.from({ length: colonne }, () => '---').join(' | ')} |`, ...piene.slice(1).map(riga)].join('\n');
}

function elenco(el, ordinato) {
  let n = 0;
  return [...el.children].filter((c) => c.tagName.toLowerCase() === 'li').map((li) => {
    n += 1;
    const testo = blocchi(li).join('\n').replace(/\n+/g, ' ').trim();
    return testo ? `${ordinato ? `${n}.` : '-'} ${testo}` : '';
  }).filter(Boolean).join('\n');
}

const BLOCCO = /^(p|div|section|article|main|header|footer|h[1-6]|ul|ol|li|table|blockquote|hr|pre|figure)$/;

function blocchi(node) {
  const out = [];
  let riga = '';
  const chiudi = () => { const t = riga.replace(/[ \t]+\n/g, '\n').trim(); if (t) out.push(t); riga = ''; };
  node.childNodes.forEach((n) => {
    if (n.nodeType === 3) { riga += pulisci(n.nodeValue); return; }
    if (n.nodeType !== 1) return;
    const tag = n.tagName.toLowerCase();
    if (!BLOCCO.test(tag)) {
      // i contenitori "in linea" che racchiudono blocchi (Google Docs avvolge tutto in un <b>) si attraversano
      if (n.querySelector('p,div,table,ul,ol,h1,h2,h3,h4,h5,h6,blockquote')) { chiudi(); out.push(...blocchi(n)); } else {
        const tmp = n.ownerDocument.createElement('span');
        tmp.appendChild(n.cloneNode(true));
        riga += inline(tmp);
      }
      return;
    }
    chiudi();
    if (/^h[1-6]$/.test(tag)) {
      const t = inline(n).replace(/\*\*/g, '').replace(/\n+/g, ' ').trim();
      // il titolo più grande è già il titolo dell'articolo: nel testo si parte dal titoletto
      if (t) out.push(`${tag === 'h1' || tag === 'h2' ? '##' : '###'} ${t}`);
    } else if (tag === 'table') { const t = tabella(n); if (t) out.push(t); }
    else if (tag === 'ul' || tag === 'ol') { const t = elenco(n, tag === 'ol'); if (t) out.push(t); }
    else if (tag === 'blockquote') { const t = blocchi(n).join('\n\n'); if (t) out.push(t.split('\n').map((r) => `> ${r}`.trimEnd()).join('\n')); }
    else if (tag === 'hr') out.push('---');
    else if (tag === 'p' || tag === 'pre') { const t = inline(n).trim(); if (t) out.push(t); }
    else out.push(...blocchi(n));
  });
  chiudi();
  return out;
}

export function htmlToMarkdown(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return blocchi(doc.body).join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
}
