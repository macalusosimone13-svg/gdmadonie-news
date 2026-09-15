import { Skeleton } from '@/components/ui/skeleton';

// Placeholder della forma di PostCard: immagine 16:9, badge, titolo, estratto, footer.
export default function PostCardSkeleton() {
  return (
    <article className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
      <Skeleton className="aspect-[16/9] w-full rounded-none" />
      <div className="p-4 space-y-3">
        <Skeleton className="h-3 w-20 rounded-full" />
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <div className="flex items-center justify-between pt-1">
          <Skeleton className="h-3 w-24 rounded-full" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </div>
    </article>
  );
}
