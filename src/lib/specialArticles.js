// Notizie "speciali": hanno una pagina con grafica tutta loro (font, colori,
// copertina), mentre il resto del sito resta identico. Si collegano qui per
// indirizzo (slug): una riga per notizia speciale. Per toglierle la grafica
// speciale basta cancellare la riga.
export const SPECIAL_ARTICLES = {
  'kimi-antonelli-campione-del-mondo': 'campione-f1-2026',
  'basta-bonus-impresa-giovani-sicilia': 'diritto-a-restare',
};

export const specialThemeFor = (post) => (post?.slug ? SPECIAL_ARTICLES[post.slug] || null : null);

// Immagini gia' pronte per il tasto "Storie e Post" delle notizie speciali:
// al posto dell'immagine generata in automatico si condividono queste.
export const SPECIAL_SHARE_IMAGES = {
  'kimi-antonelli-campione-del-mondo': {
    story: '/speciali/antonelli-storia.jpg',
    post: '/speciali/antonelli-ig-post-1.jpg',
    landscape: '/speciali/antonelli-campione-2026.jpg',
  },
  'basta-bonus-impresa-giovani-sicilia': {
    story: '/speciali/basta-bonus-storia.jpg',
    post: '/speciali/basta-bonus-copertina.jpg',
    landscape: '/speciali/basta-bonus-orizzontale.jpg',
  },
};

export const specialShareImage = (post, format) => (post?.slug ? SPECIAL_SHARE_IMAGES[post.slug]?.[format] || null : null);
