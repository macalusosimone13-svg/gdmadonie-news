import { useState, useEffect, useCallback } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { Image } from '@/components/ui/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import VideoPlayer from '@/components/VideoPlayer';

// Carosello responsivo per gallerie di foto/video.
// - Contenitore 16/9: le immagini orizzontali usano object-cover (riempono senza deformare),
//   le verticali usano object-contain (centrate, mai stretchate).
// - Testo/descrizione va sotto il carosello (gestito dal consumer).
export default function MediaCarousel({ items = [], alt = 'Media', fit = false, badge = null }) {
  const single = items.length === 1;
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false, align: 'center', watchDrag: false });
  const [selected, setSelected] = useState(0);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelected(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('select', onSelect);
    return () => emblaApi.off('select', onSelect);
  }, [emblaApi, onSelect]);

  if (!items.length) return null;

  if (single) {
    const m = items[0];
    return (
      <div className="w-full">
        <div className="relative">
          {m.type === 'video' ?
          <div className={`w-full overflow-hidden bg-black ${fit ? 'aspect-[16/9]' : ''}`}>
              <VideoPlayer src={m.url} poster={m.poster_url} fit={fit} natural={!fit} badge={badge} />
            </div> :
          fit ?
          <div className="w-full overflow-hidden bg-muted aspect-[16/9]">
              <Image src={m.url} fittingType="fit" alt={alt} className="w-full h-full" />
            </div> :

          <img src={m.url} alt={alt} draggable={false} style={{ WebkitUserDrag: 'none', WebkitTouchCallout: 'none' }} className="w-full h-auto block bg-muted mx-auto lg:w-auto lg:max-h-[80vh] lg:max-w-full" loading="lazy" />
          }
          {badge && m.type !== 'video' &&
          <span className={`absolute left-3 bottom-3 z-20 text-xs font-semibold px-2.5 py-1 rounded-full bg-[#0f1b3a] ${badge.className} shadow-sm`}>{badge.label}</span>
          }
        </div>
      </div>);

  }

  return (
    <div className="w-full">
      <div className="relative">
        <div ref={emblaRef} className="overflow-hidden" data-allow-edge-swipe>
          <div className="flex">
            {items.map((m, idx) =>
            <div key={idx} className="flex-[0_0_100%] min-w-0">
                {m.type === 'video' ?
              <div className={`w-full overflow-hidden bg-black ${fit ? 'aspect-[16/9]' : ''}`}>
                    <VideoPlayer src={m.url} poster={m.poster_url} fit={fit} natural={!fit} badge={badge} />
                  </div> :
              fit ?
              <div className="w-full overflow-hidden bg-muted aspect-[16/9]">
                    <Image src={m.url} fittingType="fit" alt={items.length > 1 ? `${alt} ${idx + 1}` : alt} className="w-full h-full" />
                  </div> :

              <img src={m.url} alt={items.length > 1 ? `${alt} ${idx + 1}` : alt} draggable={false} style={{ WebkitUserDrag: 'none', WebkitTouchCallout: 'none' }} className="w-full h-auto block bg-muted mx-auto lg:w-auto lg:max-h-[80vh] lg:max-w-full" loading="lazy" />
              }
              </div>
            )}
          </div>
        </div>

        {!single &&
        <>
            <button
            type="button"
            onClick={() => emblaApi?.scrollPrev()}
            disabled={selected === 0}
            aria-label="Precedente"
            className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 min-w-[44px] min-h-[44px] rounded-full bg-black/55 text-white flex items-center justify-center backdrop-blur-sm hover:bg-black/75 transition-colors disabled:opacity-30">
            
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
            type="button"
            onClick={() => emblaApi?.scrollNext()}
            disabled={selected === items.length - 1}
            aria-label="Successivo"
            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 min-w-[44px] min-h-[44px] rounded-full bg-black/55 text-white flex items-center justify-center backdrop-blur-sm hover:bg-black/75 transition-colors disabled:opacity-30">
            
              <ChevronRight className="w-5 h-5" />
            </button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
              {items.map((_, idx) =>
            <button
              key={idx}
              type="button"
              onClick={() => emblaApi?.scrollTo(idx)}
              aria-label={`Vai al media ${idx + 1}`}
              className={`h-1.5 rounded-full transition-all ${idx === selected ? 'w-5 bg-white' : 'w-1.5 bg-white/50'}`} />

            )}
            </div>
          </>
        }
        {badge && items[selected]?.type !== 'video' &&
        <span className={`absolute left-3 bottom-3 z-20 text-xs font-semibold px-2.5 py-1 rounded-full bg-[#0f1b3a] ${badge.className} shadow-sm`}>{badge.label}</span>
        }
      </div>
      {!single &&
      <p className="text-center text-xs text-muted-foreground mt-2">
          {selected + 1} di {items.length}
        </p>
      }
    </div>);

}
