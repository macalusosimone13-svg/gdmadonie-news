// Pulisce un testo che può contenere tag HTML e/o entità HTML (anche tag escapati
// come &lt;p&gt;): decodifica prima le entità, poi rimuove i tag, infine normalizza gli spazi.
export function cleanExcerpt(s) {
  if (!s) return '';
  let t = String(s);
  t = t.replace(/&nbsp;/g, ' ');
  t = t.replace(/&#(\d+);/g, (_, d) => { try { return String.fromCodePoint(parseInt(d, 10)); } catch { return ''; } });
  t = t.replace(/&#x([0-9a-fA-F]+);/g, (_, h) => { try { return String.fromCodePoint(parseInt(h, 16)); } catch { return ''; } });
  t = t.replace(/&([a-zA-Z]+);/g, (m, n) => ({
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", hellip: '\u2026', mdash: '\u2014',
    ndash: '\u2013', lsquo: '\u2018', rsquo: '\u2019', ldquo: '\u201C', rdquo: '\u201D',
    laquo: '\u00AB', raquo: '\u00BB', euro: '\u20AC', bull: '\u2022', middot: '\u00B7',
    deg: '\u00B0', copy: '\u00A9', reg: '\u00AE', trade: '\u2122', para: '\u00B6', sect: '\u00A7',
  })[n] ?? m);
  t = t.replace(/<[^>]+>/g, ' ');
  t = t.replace(/\s+/g, ' ').trim();
  return t;
}
