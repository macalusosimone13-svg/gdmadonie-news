import { useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';

const THRESHOLD = 60;
const MAX_PULL = 100;

export default function PullToRefresh({ onRefresh, children }) {
  const [pulling, setPulling] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pullDist = useRef(0);
  const active = useRef(false);

  const onTouchStart = (e) => {
    if (refreshing || window.scrollY > 0) return;
    startY.current = e.touches[0].clientY;
    active.current = true;
  };

  const onTouchMove = (e) => {
    if (!active.current || refreshing) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta > 0 && window.scrollY <= 0) {
      pullDist.current = Math.min(delta, MAX_PULL);
      setPulling(pullDist.current);
    } else if (window.scrollY > 0) {
      active.current = false;
      pullDist.current = 0;
      setPulling(0);
    }
  };

  const onTouchEnd = async () => {
    if (!active.current) return;
    active.current = false;
    const dist = pullDist.current;
    if (dist > THRESHOLD) {
      setRefreshing(true);
      pullDist.current = 0;
      setPulling(0);
      try {
        await onRefresh?.();
      } finally {
        setRefreshing(false);
      }
    } else {
      pullDist.current = 0;
      setPulling(0);
    }
  };

  const height = refreshing ? 44 : pulling * 0.5;

  return (
    <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <div className="flex items-center justify-center overflow-hidden transition-all duration-200" style={{ height }}>
        <RefreshCw className={`w-5 h-5 text-primary ${refreshing ? 'animate-spin' : ''}`} />
      </div>
      {children}
    </div>
  );
}
