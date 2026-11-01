/**
 * Detects whether the current device is a touchscreen device (Mobile phone, Tablet)
 * or a Desktop computer with a physical keyboard & mouse.
 */
export const isTouchscreenDevice = (): boolean => {
  if (typeof window === 'undefined') return false;

  // 1. If screen width is desktop-class (> 1024px) and primary pointer is a fine mouse, it's a computer
  const hasFinePointer = window.matchMedia('(pointer: fine)').matches;
  const hasHover = window.matchMedia('(hover: hover)').matches;
  const isLargeScreen = window.innerWidth >= 1024;

  if (hasFinePointer && hasHover && isLargeScreen) {
    return false; // Definitely a Desktop / Laptop Computer
  }

  // 2. Touch screen detection
  const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const hasTouchPoints = typeof navigator !== 'undefined' && (navigator.maxTouchPoints || 0) > 0;
  const isTouchWindow = 'ontouchstart' in window;

  return hasCoarsePointer || hasTouchPoints || isTouchWindow;
};
