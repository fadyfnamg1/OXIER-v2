import { useEffect, useRef } from 'react';
import { useStore } from './store';
import type { Screen, ActiveOverlay } from '../types';

// Maps the in-app screen/overlay to a real URL path, so the address bar
// reflects where the person actually is (e.g. /deposit, /transferring)
// instead of always showing the root — this is purely cosmetic/UX (no
// server routing changes), but it's what makes the app feel like a real
// multi-page platform instead of a single static HTML file.
function pathFor(screen: Screen, overlay: ActiveOverlay): string {
  if (screen === 'trading') {
    switch (overlay) {
      case 'deposit':   return '/deposit';
      case 'transfers': return '/transferring';
      case 'history':   return '/history';
      case 'profile':   return '/profile';
      case 'signals':   return '/signals';
      case 'indicators':return '/indicators';
      case 'expiry':    return '/expiry';
      case 'events':    return '/events';
      case 'challenge': return '/challenge';
      default:          return '/trading';
    }
  }
  switch (screen) {
    case 'landing':      return '/';
    case 'splash':       return '/';
    case 'login':        return '/login';
    case 'login-verify': return '/login/verify';
    case 'register':     return '/register';
    case 'verify':       return '/register/verify';
    case 'pin':          return '/pin';
    default:             return '/';
  }
}

// Fixes the bug where pressing the device's own hardware/gesture Back
// button exits the platform entirely (to the mobile OS or the previous
// browser page) instead of navigating one step back inside the app.
//
// How it works: every time the visible screen or overlay changes, we push
// a new entry onto the browser's own history stack. That means the native
// Back button always has one of our own entries to pop first. We listen
// for that pop (popstate) and translate it into an in-app navigation
// step — closing an open overlay first, then stepping back to the
// previous screen — instead of letting the browser/webview leave the app.
export function useBackNavigation() {
  const screen = useStore(s => s.screen);
  const overlay = useStore(s => s.overlay);
  const setScreen = useStore(s => s.setScreen);
  const setOverlay = useStore(s => s.setOverlay);

  // Prevents the "screen/overlay changed" effect below from pushing a
  // brand-new history entry for a change that itself came from the user
  // pressing Back (which already popped an entry) — otherwise Back would
  // effectively do nothing.
  const fromPopState = useRef(false);

  useEffect(() => {
    window.history.replaceState({ screen, overlay }, '', pathFor(screen, overlay));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (fromPopState.current) { fromPopState.current = false; return; }
    window.history.pushState({ screen, overlay }, '', pathFor(screen, overlay));
  }, [screen, overlay]);

  useEffect(() => {
    function onPopState(e: PopStateEvent) {
      fromPopState.current = true;
      const state = e.state as { screen?: Screen; overlay?: ActiveOverlay } | null;

      // An overlay/sheet is open — Back closes it first, one step at a time,
      // the same way tapping its own close button would.
      if (useStore.getState().overlay !== 'none') {
        setOverlay('none');
        return;
      }

      // No overlay open — Back steps to whichever screen the popped
      // history entry says came before this one.
      if (state?.screen) {
        setScreen(state.screen);
      }
    }

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [setOverlay, setScreen]);
}
