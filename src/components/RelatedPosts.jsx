import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Image } from '@/components/ui/image';
import { Skeleton } from '@/components/ui/skeleton';

function seededShuffle(list, seedStr) {
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) >>> 0;
    return seed / 4294967296;
  };
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default function RelatedPosts({ post }) {
  const { data, isLoading } = useQuery({
    queryKey: ['related-posts', post?.category, post?.id],
    queryFn: async () => {
      const same = await base44.entities.Post.filter(
        { status: 'published', category: post.category },
        '-published_date',
        20
      );
      const seen = new Set();
      const list = [];
      const push = (p) => {
        if (p.id !== post.id && !seen.has(p.id)) {
          seen.add(p.id);
          list.push(p);
        }
      };
      (same || []).forEach(push);
      if (list.length < 3) {
        const recent = await base44.entities.Post.filter(
          { status: 'published' },
          '-published_date',
          20
        );
        (recent || []).forEach(push);
      }
      return seededShuffle(list.slice(0, 8), post.id).slice(0, 4);
    },
    enabled: !!post,
    staleTime: 5 * 60 * 1000
  });

  const items = data || [];
  if (!isLoading && items.length === 0) return null;

  return (
    <section className="pt-2 border-t border-border">
      <h2 className="text-foreground mb-3 font-serif font-normal text-xl">
        Altre notizie che potrebbero interessarti
      </h2>
      {isLoading ?
      <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) =>
        <div key={i} className="flex gap-3 bg-card rounded-2xl border border-border p-3">
              <Skeleton className="w-20 h-20 shrink-0 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-20 rounded-full" />
              </div>
            </div>
        )}
        </div> :

      <div className="grid gap-3 sm:grid-cols-2">
          {items.map((p) =>
        <RelatedItem key={p.id} post={p} />
        )}
        </div>
      }
    </section>);

}

function RelatedItem({ post }) {
  const date = post.published_date ?
  format(new Date(post.published_date), 'dd/MM/yyyy', { locale: it }) :
  '';
  return (
    <Link
      to={`/articolo/${post.id}`}
      className="flex gap-3 bg-card rounded-2xl border border-border p-3 hover:shadow-sm transition-shadow">
      
      {post.image_url &&
      <div className="w-20 h-20 shrink-0 rounded-xl overflow-hidden bg-muted">
          {post.media_type === 'video' ?
        <video src={`${post.image_url}#t=0.1`} poster={post.poster_url} muted playsInline preload={post.poster_url ? 'none' : 'metadata'} className="w-full h-full object-cover" /> :

        <Image src={post.image_url} fittingType="fill" alt={post.title} className="w-full h-full" />
        }
        </div>
      }
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold text-foreground leading-snug line-clamp-2">
          {post.title}
        </h3>
        {date && <span className="block text-xs text-muted-foreground mt-1">{date}</span>}
      </div>
    </Link>);

}
