import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Instagram, Facebook, Twitter, Linkedin, Mail } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { sb44 } from '@/api/supabaseEntities';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { CATEGORIES, getCategoryLabel } from '@/lib/categories';
import { useSiteContent } from '@/lib/useSiteContent';
import { getContent } from '@/lib/siteContent';
import { useSEO } from '@/lib/useSEO';
import { useUxConfig } from '@/lib/UxConfigContext';
import { Image } from '@/components/ui/image';

function BioBlock({ bio }) {
  if (!bio) return null;
  const blocks = bio.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className="space-y-5">
      {blocks.map((block, i) => {
        if (block.startsWith('## ')) {
          return <h2 key={i} className="font-serif font-normal text-foreground pt-2 text-2xl capitalize">{block.slice(3)}</h2>;
        }
        if (block.startsWith('> ')) {
          return (
            <blockquote key={i} className="border-l-4 border-primary pl-4 py-1 text-xl font-serif italic text-foreground leading-snug bg-[hsl(var(--popover))]">
              {block.slice(2)}
            </blockquote>);

        }
        return <p key={i} className="text-[15px] text-foreground leading-relaxed whitespace-pre-line">{block}</p>;
      })}
    </div>);

}

export default function TeamMemberDetail() {
  const { slot } = useParams();
  const navigate = useNavigate();
  const { data: content } = useSiteContent();
  const { config: ux } = useUxConfig();
  const cardStyle = ux.team_cards_bg_color ? { backgroundColor: ux.team_cards_bg_color } : undefined;

  const photo = content?.[`team_${slot}_photo`];
  const detailPhoto = content?.[`team_${slot}_detail_photo`] || photo;
  const prefix = content?.[`team_${slot}_prefix`];
  const name = content?.[`team_${slot}_name`];
  const caption = content?.[`team_${slot}_caption`];
  const bio = content?.[`team_${slot}_bio`];

  const socials = [
  { key: 'instagram', icon: Instagram, url: content?.[`team_${slot}_instagram`] },
  { key: 'facebook', icon: Facebook, url: content?.[`team_${slot}_facebook`] },
  { key: 'twitter', icon: Twitter, url: content?.[`team_${slot}_twitter`] },
  { key: 'linkedin', icon: Linkedin, url: content?.[`team_${slot}_linkedin`] },
  {
    key: 'email', icon: Mail,
    url: content?.[`team_${slot}_email`] ?
    content[`team_${slot}_email`].startsWith('mailto:') ? content[`team_${slot}_email`] : `mailto:${content[`team_${slot}_email`]}` :
    null
  }].
  filter((s) => s.url);

  useSEO({
    title: name ? `${name} — GD Madonie News` : 'GD Madonie News',
    description: caption || 'Giovani Democratici Madonie',
    image: detailPhoto,
    type: 'profile'
  });

  const otherProfiles = [1, 2, 3, 4].
  filter((i) => String(i) !== String(slot)).
  map((i) => ({
    slot: i,
    photo: content?.[`team_${i}_photo`],
    name: content?.[`team_${i}_name`]
  })).
  filter((t) => t.photo);

  const { data: ownPosts } = useQuery({
    queryKey: ['profile-own-posts', name],
    queryFn: () => name ? sb44.entities.Post.filter({ status: 'published', author: name }, '-published_date', 5) : Promise.resolve([]),
    enabled: !!name,
    staleTime: 5 * 60 * 1000
  });

  const { data: relatedNews } = useQuery({
    queryKey: ['profile-related-news', slot],
    queryFn: () => base44.entities.Post.filter({ status: 'published' }, '-published_date', 3),
    staleTime: 5 * 60 * 1000
  });

  const goBack = () => {
    if (window.history.state && window.history.state.idx > 0) navigate(-1);else
    navigate('/');
  };

  if (!detailPhoto && !name) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        Pagina non trovata. <Link to="/" className="text-primary underline">Torna alla home</Link>
      </div>);

  }

  return (
    <div className="space-y-6 max-w-2xl lg:max-w-5xl mx-auto">
      {detailPhoto ?
      <div className="-mt-5 -mx-4 lg:mt-0 lg:mx-0 lg:rounded-2xl overflow-hidden relative">
          <div className="relative aspect-[4/5] lg:aspect-[16/9] w-full bg-muted">
            <Image src={detailPhoto} fittingType="fill" focalPointY={0.2} alt={name || ''} className="w-full h-full" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-5 lg:p-8">
              {(prefix || name) &&
            <h1 className="font-serif font-normal text-2xl lg:text-4xl leading-tight">
                  {prefix && <span className="text-white">{prefix} </span>}
                  {name && <span className="text-[#ff7024]">{name}</span>}
                </h1>
            }
              {caption && <p className="text-white/80 text-sm mt-1">{caption}</p>}
            </div>
          </div>
          <button onClick={goBack} aria-label="Indietro" className="absolute top-3 left-3 z-10 w-10 h-10 min-w-[44px] min-h-[44px] rounded-full bg-white/90 backdrop-blur-sm text-foreground shadow-md flex items-center justify-center hover:bg-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
        </div> :

      <div>
          <button onClick={goBack} aria-label="Indietro" className="inline-flex items-center justify-center w-10 h-10 min-w-[44px] min-h-[44px] rounded-full bg-card border border-border shadow-sm text-foreground hover:bg-muted mb-3">
            <ArrowLeft className="w-5 h-5" />
          </button>
          {name && <h1 className="text-2xl font-bold text-foreground leading-tight">{prefix ? `${prefix} ${name}` : name}</h1>}
          {caption && <p className="text-sm text-muted-foreground mt-1">{caption}</p>}
        </div>
      }

      <div className="lg:grid lg:grid-cols-3 lg:gap-10 lg:items-start">
        <div className="lg:col-span-2">
          <BioBlock bio={bio} />
        </div>
        <aside className="space-y-6 mt-6 lg:mt-0">
          {socials.length > 0 &&
          <div style={cardStyle} className={`relative overflow-hidden border-t border-border pt-6 lg:border-t-0 lg:pt-0 lg:border lg:border-border lg:rounded-2xl lg:p-5 ${cardStyle ? '' : ''}`}>
              <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/10 to-transparent hidden lg:block" />
              <h3 className="relative text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Contatti</h3>
              <div className="relative flex items-center gap-3">
                {socials.map((s) => {
                const Icon = s.icon;
                return (
                  <a key={s.key} href={s.url} target="_blank" rel="noopener noreferrer" aria-label={s.key} className="w-10 h-10 rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground flex items-center justify-center transition-colors">
                      <Icon className="w-4 h-4" />
                    </a>);

              })}
              </div>
            </div>
          }

          {ownPosts && ownPosts.length > 0 &&
          <div style={cardStyle} className="relative overflow-hidden border-t border-border pt-6 lg:border-t-0 lg:pt-0 lg:border lg:border-border lg:rounded-2xl lg:p-5 space-y-3">
              <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/10 to-transparent hidden lg:block" />
              <h3 className="relative text-sm font-semibold text-muted-foreground uppercase tracking-wide">Le sue notizie</h3>
              <div className="relative space-y-3">
                {ownPosts.map((p) =>
              <Link key={p.id} to={`/articolo/${p.id}`} className="block group">
                    <h4 className="text-sm font-semibold leading-snug text-foreground group-hover:text-primary line-clamp-2">{p.title}</h4>
                    {p.published_date && <p className="text-[11px] text-muted-foreground mt-0.5">{format(new Date(p.published_date), 'd MMMM yyyy', { locale: it })}</p>}
                  </Link>
              )}
              </div>
            </div>
          }

          {otherProfiles.length > 0 &&
          <div style={cardStyle} className="relative overflow-hidden border-t border-border pt-6 lg:border-t-0 lg:pt-0 lg:border lg:border-border lg:rounded-2xl lg:p-5 space-y-3">
              <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/10 to-transparent hidden lg:block" />
              <h3 className="relative text-sm font-semibold text-muted-foreground uppercase tracking-wide">{getContent(content, 'team_related_label')}</h3>
              <div className="relative flex gap-3 overflow-x-auto scrollbar-hide lg:flex-col lg:overflow-visible">
                {otherProfiles.map((p) =>
              <Link key={p.slot} to={`/in-evidenza/${p.slot}`} className="shrink-0 w-24 lg:w-full text-center lg:text-left lg:flex lg:items-center lg:gap-3 group">
                    <div className="w-24 h-24 lg:w-12 lg:h-12 rounded-xl overflow-hidden bg-muted mb-1.5 lg:mb-0">
                      <Image src={p.photo} fittingType="fill" alt={p.name || ''} className="w-full h-full transition-transform duration-300 group-hover:scale-105" />
                    </div>
                    {p.name && <p className="text-xs text-foreground line-clamp-2 group-hover:text-primary transition-colors">{p.name}</p>}
                  </Link>
              )}
              </div>
            </div>
          }
        </aside>
      </div>

      {relatedNews && relatedNews.length > 0 &&
      <div className="pt-6 border-t border-border space-y-5">
          <h3 className="text-xl font-serif font-bold text-foreground border-b-2 border-primary pb-2 inline-block">Potrebbero interessarti</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {relatedNews.map((p) => {
            const date = p.published_date ? format(new Date(p.published_date), 'd MMMM yyyy', { locale: it }) : '';
            return (
              <Link key={p.id} to={`/articolo/${p.id}`} style={cardStyle} className={`relative overflow-hidden block group border border-border rounded-xl p-3 ${cardStyle ? '' : 'bg-card'}`}>
                  <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/10 to-transparent" />
                  {p.image_url &&
                <div className="aspect-video rounded-lg overflow-hidden bg-muted mb-2">
                      <Image src={p.image_url} fittingType="fill" alt={p.title} className="w-full h-full transition-transform duration-300 group-hover:scale-105" />
                    </div>
                }
                  <span className={`text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${CATEGORIES[p.category]?.badge || 'text-primary'}`}>
                    {getCategoryLabel(content, p.category)}
                  </span>
                  <h4 className="text-base font-serif font-bold leading-snug text-foreground group-hover:text-primary transition-colors mt-1.5 line-clamp-2">{p.title}</h4>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    {date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{date}</span>}
                    {p.author && <span>di <span className="font-semibold">{p.author.toUpperCase()}</span></span>}
                  </div>
                </Link>);

          })}
          </div>
        </div>
      }
    </div>);

}
