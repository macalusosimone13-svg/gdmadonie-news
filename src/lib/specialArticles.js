// Notizie "speciali": hanno una pagina con grafica tutta loro (font, colori,
// copertina), mentre il resto del sito resta identico. Si collegano qui per
// indirizzo (slug): una riga per notizia speciale. Per toglierle la grafica
// speciale basta cancellare la riga.
export const SPECIAL_ARTICLES = {
  'kimi-antonelli-campione-del-mondo': 'campione-f1-2026',
};

export const specialThemeFor = (post) => (post?.slug ? SPECIAL_ARTICLES[post.slug] || null : null);
