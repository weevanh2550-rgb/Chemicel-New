import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initSystemThemeSync } from './utils/theme';

// Synchronize theme dynamically with device preferences (Dark / Light Mode)
initSystemThemeSync();

// Prevent pinch-zoom, double-tap zoom, and gesture zoom across all pages and functions
if (typeof document !== 'undefined') {
  const preventGesture = (e: Event) => {
    e.preventDefault();
  };
  document.addEventListener('gesturestart', preventGesture, { passive: false });
  document.addEventListener('gesturechange', preventGesture, { passive: false });
  document.addEventListener('gestureend', preventGesture, { passive: false });

  document.addEventListener(
    'touchmove',
    (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    },
    { passive: false }
  );

  document.addEventListener(
    'wheel',
    (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
      }
    },
    { passive: false }
  );

  // Prevent browser contextmenu / iOS peek / link preview popups on long press, while preserving normal input interactions
  document.addEventListener(
    'contextmenu',
    (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
    },
    { capture: true }
  );
}

createRoot(document.getElementById('root')!).render(<App />);
