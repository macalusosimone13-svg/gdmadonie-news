import { Skeleton } from '@/components/ui/skeleton';

export default function RassegnaCardSkeleton() {
  return (
    <article className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
      <Skeleton className="aspect-[16/9] w-full rounded-none" />
      <div className="p-4 space-y-3">
        <Skeleton className="h-3 w-28 rounded-full" />
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </article>
  );
}
