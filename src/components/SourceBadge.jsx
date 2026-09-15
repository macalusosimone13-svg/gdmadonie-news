import { sourceLogoUrl } from '@/lib/sourceLogo';

// Mostra il logo + il nome della testata di un post rassegna.
// variant="overlay" -> pill scura per immagini; "default" -> testo muted per header/liste.
export default function SourceBadge({ post, variant = 'default', className = '' }) {
  const name = post?.source_name;
  if (!name) return null;
  const logo = sourceLogoUrl(post);

  if (variant === 'overlay') {
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-700/85 text-white backdrop-blur-sm ${className}`}>
        {logo &&
        <img src={logo} alt="" className="w-5 h-5 rounded-full object-contain bg-white/90 p-0.5 shrink-0" loading="lazy" decoding="async" />
        }
        <span className="truncate max-w-[140px] font-serif font-normal">{name}</span>
      </span>);

  }

  return (
    <span className={`inline-flex items-center gap-1.5 min-w-0 ${className}`}>
      {logo &&
      <img src={logo} alt="" className="w-5 h-5 rounded-full object-contain bg-white p-0.5 ring-1 ring-border shrink-0" loading="lazy" decoding="async" />
      }
      <span className="text-xs text-muted-foreground truncate font-serif font-normal">{name}</span>
    </span>);

}
