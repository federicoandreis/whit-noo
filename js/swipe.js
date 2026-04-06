/**
 * swipe.js — touch and mouse swipe gesture handler
 *
 * Attaches drag listeners to a card element. During drag:
 * - Applies translateX + slight rotation transform
 * - Fires onDragUpdate(deltaX) for the card to update choice label visibility
 * - Commits on threshold (30% of card width) or velocity flick (> 500 px/s)
 * - Snaps back on cancel/release below threshold
 */

const COMMIT_THRESHOLD_RATIO = 0.30; // fraction of card width
const FLICK_VELOCITY_PX_S    = 500;  // px/s for flick commit
const ROTATION_FACTOR        = 0.10; // degrees per px of drag
const MAX_ROTATION_DEG       = 15;   // cap so extreme drags don't over-rotate

/**
 * @typedef {Object} SwipeCallbacks
 * @property {(card: Object) => void} onCommitLeft
 * @property {(card: Object) => void} onCommitRight
 * @property {() => void} onCancel
 * @property {(deltaX: number) => void} onDragUpdate
 */

/**
 * Attaches swipe gesture handling to a DOM element.
 *
 * @param {HTMLElement} element — the card element to make swipeable
 * @param {SwipeCallbacks} callbacks
 * @returns {{ detach: () => void }} Handle to remove listeners
 */
export function attachSwipe(element, callbacks) {
  let startX      = 0;
  let startY      = 0;
  let currentX    = 0;
  let lastX       = 0;
  let lastTime    = 0;
  let velocity    = 0;
  let dragging    = false;
  let committed   = false;
  let isHorizontal = null; // null = undecided, true = horizontal, false = vertical

  function onStart(x, y) {
    startX      = x;
    startY      = y;
    currentX    = x;
    lastX       = x;
    lastTime    = performance.now();
    dragging    = true;
    committed   = false;
    isHorizontal = null;
    velocity    = 0;
    // Remove ALL animation/transition classes — including 'entering', whose
    // forwards fill-mode keeps a keyframe transform active that beats inline styles.
    element.classList.remove('entering', 'snapping-back', 'flying-left', 'flying-right');
    element.style.transform = '';
  }

  function onMove(x, y) {
    if (!dragging || committed) return;

    const deltaX = x - startX;
    const deltaY = y - startY;

    // Determine gesture direction on first significant move
    if (isHorizontal === null && (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5)) {
      isHorizontal = Math.abs(deltaX) > Math.abs(deltaY);
    }

    if (!isHorizontal) return; // vertical scroll — do nothing

    // Velocity calculation
    const now = performance.now();
    const dt = now - lastTime;
    if (dt > 0) velocity = (x - lastX) / (dt / 1000);
    lastX    = x;
    lastTime = now;
    currentX = x;

    // Apply transform — rotate clamped so extreme drags don't look broken
    const deg = Math.max(-MAX_ROTATION_DEG, Math.min(MAX_ROTATION_DEG, deltaX * ROTATION_FACTOR));
    element.style.transform = `translateX(${deltaX}px) rotate(${deg}deg)`;

    // Update drag direction classes for choice label visibility
    element.classList.toggle('dragging-left',  deltaX < -10);
    element.classList.toggle('dragging-right', deltaX > 10);

    callbacks.onDragUpdate && callbacks.onDragUpdate(deltaX);
  }

  function onEnd() {
    if (!dragging || committed || !isHorizontal) {
      dragging = false;
      return;
    }
    dragging = false;

    const deltaX    = currentX - startX;
    const cardWidth = element.offsetWidth;
    const threshold = cardWidth * COMMIT_THRESHOLD_RATIO;
    const absDeltaX = Math.abs(deltaX);
    const absVel    = Math.abs(velocity);

    if (absDeltaX > threshold || absVel > FLICK_VELOCITY_PX_S) {
      commit(deltaX > 0 ? 'right' : 'left');
    } else {
      snapBack();
    }
  }

  function commit(direction) {
    committed = true;
    element.classList.remove('dragging-left', 'dragging-right');
    element.classList.add(direction === 'left' ? 'flying-left' : 'flying-right');

    // Wait for fly-off animation, then fire callback
    element.addEventListener('transitionend', function onEnd() {
      element.removeEventListener('transitionend', onEnd);
      if (direction === 'left') {
        callbacks.onCommitLeft && callbacks.onCommitLeft();
      } else {
        callbacks.onCommitRight && callbacks.onCommitRight();
      }
    }, { once: true });
  }

  function snapBack() {
    element.classList.remove('dragging-left', 'dragging-right');
    element.classList.add('snapping-back');
    element.style.transform = '';
    callbacks.onCancel && callbacks.onCancel();
  }

  // ─── Touch handlers ────────────────────────────────────────────────────────

  function onTouchStart(e) {
    if (e.touches.length !== 1) return;
    onStart(e.touches[0].clientX, e.touches[0].clientY);
  }

  function onTouchMove(e) {
    if (e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;

    // Only prevent default scroll once we know this is a horizontal gesture
    if (isHorizontal === true || (isHorizontal === null && Math.abs(dx) > Math.abs(dy) + 5)) {
      e.preventDefault();
    }

    onMove(e.touches[0].clientX, e.touches[0].clientY);
  }

  function onTouchEnd(e) {
    if (e.changedTouches.length > 0) {
      currentX = e.changedTouches[0].clientX;
    }
    onEnd();
  }

  // ─── Mouse handlers ────────────────────────────────────────────────────────

  function onMouseDown(e) {
    if (e.button !== 0) return; // left button only
    e.preventDefault();
    onStart(e.clientX, e.clientY);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup',   onMouseUp);
  }

  function onMouseMove(e) {
    onMove(e.clientX, e.clientY);
  }

  function onMouseUp(e) {
    currentX = e.clientX;
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup',   onMouseUp);
    onEnd();
  }

  // ─── Attach listeners ─────────────────────────────────────────────────────

  element.addEventListener('touchstart', onTouchStart, { passive: true });
  element.addEventListener('touchmove',  onTouchMove,  { passive: false });
  element.addEventListener('touchend',   onTouchEnd,   { passive: true });
  element.addEventListener('mousedown',  onMouseDown);

  return {
    detach() {
      element.removeEventListener('touchstart', onTouchStart);
      element.removeEventListener('touchmove',  onTouchMove);
      element.removeEventListener('touchend',   onTouchEnd);
      element.removeEventListener('mousedown',  onMouseDown);
      window.removeEventListener('mousemove',   onMouseMove);
      window.removeEventListener('mouseup',     onMouseUp);
    },
  };
}
