// Il testo degli articoli GD è scritto in Markdown "leggero": titoletti (##),
// **grassetto**, elenchi, tabelle e riquadri in evidenza (>). Qui stanno le
// due funzioni che servono attorno a quel testo.

// Prepara il testo prima di impaginarlo. I post scritti prima dell'arrivo
// della formattazione erano testo semplice: senza questi ritocchi le righe
// rientrate con tab o spazi diventerebbero "blocchi di codice" e i pallini
// "•" incollati da altri programmi non verrebbero visti come elenco.
export function normalizeArticle(text) {
  if (!text) return '';
  return String(text)
    .replace(/\r/g, '')
    .split('\n')
    .map((riga) => riga
      .replace(/^(?:\t+| {4,})/, '')
      .replace(/^\s*[•·▪◦]\s*/, '- '))
    .join('\n');
}

// Toglie la formattazione e restituisce testo semplice: serve per estratti,
// anteprime, locandine e descrizioni, dove asterischi e barre non devono
// comparire.
export function plainArticle(text) {
  if (!text) return '';
  return normalizeArticle(text)
    .split('\n')
    // le righe di separazione (| --- | --- | delle tabelle, --- tra i paragrafi) non sono testo
    .filter((riga) => !/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(riga))
    .map((riga) => {
      let r = riga;
      if (/^\s*\|.*\|\s*$/.test(r)) r = r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()).filter(Boolean).join(' · ');
      return r
        .replace(/^\s{0,3}#{1,6}\s+/, '')
        .replace(/^\s{0,3}>\s?/, '')
        .replace(/^\s{0,3}(?:[-*+]|\d+[.)])\s+/, '')
        .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/(\*\*|__)(.+?)\1/g, '$2')
        .replace(/(^|[\s(])[*_]([^*_\n]+)[*_](?=[\s).,;:!?]|$)/g, '$1$2')
        .replace(/`([^`]+)`/g, '$1');
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
