// Le foto caricate pesano anche 10 MB: nelle liste si chiede una versione
// ridimensionata (WebP leggero). Se il servizio non risponde, si ricade
// automaticamente sull'originale.
export const sized = (url, w = 640) => {
  if (!url || !/^https?:\/\//i.test(url) || /\.(svg|gif)(\?|$)/i.test(url)) return url;
  return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=${w}&output=webp&q=76&we`;
};
export const fallbackTo = (url) => (e) => {
  const el = e.currentTarget;
  if (el.dataset.fb) return;
  el.dataset.fb = '1';
  el.src = url;
};
