// Blocca il gesto di "swipe back" laterale di Safari iOS (navigazione cronologia).
// L'unico modo per tornare indietro resta tramite i pulsanti/link nell'interfaccia.
export function setupEdgeSwipeGuard() {
  const EDGE = 40;
  const MOVE_THRESHOLD = 8;

  let startX = 0;
  let startY = 0;
  let nearEdge = false;
  let startTarget = null;

  const isAllowed = (el) => {
    if (!el || !el.closest) return false;
    return !!el.closest('[data-allow-edge-swipe]');
  };

  const onTouchStart = (e) => {
    const t = e.touches[0];
    if (!t) {
      nearEdge = false;
      return;
    }
    startX = t.clientX;
    startY = t.clientY;
    const w = window.innerWidth;
    nearEdge = startX <= EDGE || startX >= w - EDGE;
    startTarget = e.target;
  };

  const onTouchMove = (e) => {
    if (!nearEdge) return;
    if (isAllowed(startTarget)) return;
    const t = e.touches[0];
    if (!t) return;
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > MOVE_THRESHOLD) {
      e.preventDefault();
    }
  };

  document.addEventListener('touchstart', onTouchStart, { passive: false });
  document.addEventListener('touchmove', onTouchMove, { passive: false });
}
