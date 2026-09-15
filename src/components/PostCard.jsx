import { Link } from 'react-router-dom';
import { Image } from '@/components/ui/image';
import { Calendar, Bookmark, BookmarkCheck, Play, Images } from 'lucide-react';
import { CATEGORIES, getCategoryLabel } from '@/lib/categories';
import { useSiteContent } from '@/lib/useSiteContent';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { isUnread } from '@/lib/readArticles';
import { cleanExcerpt } from '@/lib/cleanText';
import SourceBadge from '@/components/SourceBadge';
import LazyVideo from '@/components/LazyVideo';

export default function PostCard({ post, saved, onToggleSave }) {
  const cat = CATEGORIES[post.category] || CATEGORIES.rassegna_stampa;
  const { data: content } = useSiteContent();
  const label = getCategoryLabel(content, post.category);
  const isGD = post.source_type === 'gd_madonie';
  const date = post.published_date ? format(new Date(post.published_date), 'dd/MM/yyyy · HH:mm', { locale: it }) : '';
  const nuovo = isUnread(post.id);

  return (
    <article className={`bg-card rounded-2xl border border-border overflow-hidden shadow-sm ${isGD ? 'ring-1 ring-primary/30' : ''}`}>
      {post.image_url && (() => {
        const isVertical = post.media_orientation === 'vertical';
        const isVideo = post.media_type === 'video';
        return (
          <Link to={`/articolo/${post.id}`} className="relative block bg-muted group">
            <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 flex-wrap">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shadow-sm bg-[#005eff] ${cat.badge}`}>{label}</span>
              {nuovo && <span className="text-xs font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 shadow-sm">Nuovo</span>}
            </div>
            {isVertical ?
            <div className="aspect-[4/5] overflow-hidden">
                {isVideo ?
              <LazyVideo src={post.image_url} poster={post.poster_url} className="w-full h-full" videoClassName="w-full h-full object-cover" /> :

              <Image src={post.image_url} fittingType="fill" alt={post.title} className="w-full h-full" />
              }
              </div> :

            <div className="aspect-[16/9] overflow-hidden">
                {isVideo ?
              <LazyVideo src={post.image_url} poster={post.poster_url} className="w-full h-full" videoClassName="w-full h-full object-cover" /> :

              <Image src={post.image_url} fittingType="fill" alt={post.title} className="w-full h-full" />
              }
              </div>
            }
            {isVideo &&
            <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="flex items-center justify-center w-12 h-12 rounded-full bg-black/55 backdrop-blur-sm group-hover:bg-black/70 transition-colors">
                  <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                </span>
              </span>
            }
            {post.media && post.media.length > 1 &&
            <span className="absolute bottom-2 right-2 bg-black/65 text-white text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                <Images className="w-3 h-3" /> {post.media.length}
              </span>
            }
          </Link>);

      })()}
      <Link to={`/articolo/${post.id}`} className="block p-4 cursor-pointer rounded-[99px]">
        {post.image_url ?
        post.source_name ?
        <div className="flex items-center gap-2 mb-2 flex-wrap">
              {post.source_name && <SourceBadge post={post} />}
            </div> :
        null :

        <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border border-border bg-[#005eff] ${cat.badge}`}>{label}</span>
            {post.source_name && <span className="text-xs text-muted-foreground font-medium">{post.source_name}</span>}
            {nuovo && <span className="text-xs font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Nuovo</span>}
          </div>
        }
        <h2 className="text-lg font-semibold text-foreground leading-snug mb-1 hover:text-[#ff7024] transition-colors">{post.title}</h2>
        {post.excerpt && <p className="text-sm text-muted-foreground line-clamp-3 mb-3">{cleanExcerpt(post.excerpt)}</p>}
        <div className="flex items-center justify-between rounded-full">
          <div className="flex items-center gap-3 text-xs text-muted-foreground rounded-full">
            {date && <span className="flex items-center gap-1 border border-border rounded-full px-2 py-0.5 bg-gray-100"><Calendar className="w-3 h-3" />{date}</span>}
            {post.author && !post.source_name && <span className="text-[hsl(var(--primary))] capitalize">{post.author}</span>}
          </div>
          {onToggleSave &&
          <button onClick={(e) => {e.preventDefault();e.stopPropagation();onToggleSave(post);}} aria-label={saved ? 'Rimuovi dai salvati' : 'Salva articolo'} className="text-muted-foreground hover:text-primary transition-colors p-2 -m-2 min-w-[44px] min-h-[44px] flex items-center justify-center">
              {saved ? <BookmarkCheck className="w-4 h-4 text-primary" /> : <Bookmark className="w-4 h-4" />}
            </button>
          }
        </div>
      </Link>
    </article>);

}
