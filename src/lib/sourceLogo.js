// Restituisce l'URL del logo della testata per un post rassegna.
// Priorità: logo caricato dall'admin (post.source_logo) -> favicon automatica
// dal dominio della fonte originale (Google S2 favicon service).
export function sourceLogoUrl(post) {
  if (!post) return null;
  if (post.source_logo) return post.source_logo;
  const link = post.external_link;
  if (!link) return null;
  try {
    const host = new URL(link).hostname;
    if (!host) return null;
    return 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(host) + '&sz=128';
  } catch {
    return null;
  }
}
