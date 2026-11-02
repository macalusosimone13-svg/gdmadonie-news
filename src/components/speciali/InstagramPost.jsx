import { useEffect } from 'react';

// Post Instagram incorporato con il sistema ufficiale di Instagram (embed.js):
// l'immagine resta del profilo che l'ha pubblicata, con il suo nome e il link.
const IG_RE = /instagram\.com\/(?:[A-Za-z0-9_.]+\/)?(p|reel|tv)\/([A-Za-z0-9_-]+)/i;
const SCRIPT_SRC = 'https://www.instagram.com/embed.js';

export const instagramPermalink = (url) => {
  const m = (url || '').match(IG_RE);
  return m ? `https://www.instagram.com/${m[1].toLowerCase()}/${m[2]}/` : null;
};

export default function InstagramPost({ url, label }) {
  const permalink = instagramPermalink(url);
  useEffect(() => {
    if (!permalink) return;
    const run = () => { try { window.instgrm?.Embeds?.process(); } catch {} };
    if (window.instgrm) { run(); return; }
    let s = document.querySelector(`script[src="${SCRIPT_SRC}"]`);
    if (!s) {
      s = document.createElement('script');
      s.src = SCRIPT_SRC; s.async = true;
      document.body.appendChild(s);
    }
    s.addEventListener('load', run);
    return () => s.removeEventListener('load', run);
  }, [permalink]);

  if (!permalink) return null;
  return (
    <div className="sp-ig">
      {label && <p className="sp-ig-label">{label}</p>}
      {/* embed.js sostituisce il riquadro con il post: resta in un contenitore tutto suo */}
      <div key={permalink}>
        <blockquote className="instagram-media" data-instgrm-permalink={permalink} data-instgrm-version="14">
          <a href={permalink} target="_blank" rel="noopener noreferrer">Guarda il post su Instagram</a>
        </blockquote>
      </div>
    </div>);
}
