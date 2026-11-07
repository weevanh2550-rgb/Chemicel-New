/**
 * Automatic Device System Theme Synchronizer (Dark Mode / Light Mode)
 * Detects device/OS appearance (prefers-color-scheme: dark) and updates
 * the document element class ('dark') and color-scheme automatically in real time.
 */

export function initSystemThemeSync(): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {};
  }

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  const applyTheme = (isDark: boolean) => {
    const root = document.documentElement;
    const metaThemeColor = document.getElementById('theme-color-meta');

    if (isDark) {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
      if (metaThemeColor) {
        metaThemeColor.setAttribute('content', '#0b1120');
      }
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
      if (metaThemeColor) {
        metaThemeColor.setAttribute('content', '#024368');
      }
    }
  };

  // Immediate sync on load
  applyTheme(mediaQuery.matches);

  const handler = (e: MediaQueryListEvent) => {
    applyTheme(e.matches);
  };

  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', handler);
  } else if (typeof (mediaQuery as unknown as { addListener?: (h: (e: MediaQueryListEvent) => void) => void }).addListener === 'function') {
    (mediaQuery as unknown as { addListener: (h: (e: MediaQueryListEvent) => void) => void }).addListener(handler);
  }

  return () => {
    if (typeof mediaQuery.removeEventListener === 'function') {
      mediaQuery.removeEventListener('change', handler);
    } else if (typeof (mediaQuery as unknown as { removeListener?: (h: (e: MediaQueryListEvent) => void) => void }).removeListener === 'function') {
      (mediaQuery as unknown as { removeListener: (h: (e: MediaQueryListEvent) => void) => void }).removeListener(handler);
    }
  };
}
