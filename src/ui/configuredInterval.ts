import { UI_TIMING } from '../config/uiSettings';
import { updateCountdowns } from './countdowns';
import type { UiState } from './state';
import { onSettingsChange } from '../config/hotSettings';

/** Reschedule existing timers on configuration edits without duplicating their tasks. */
export function configuredInterval(callback: () => void, delay: () => number): void {
  let timer = setInterval(callback, delay());
  const unsubscribe = onSettingsChange(category => {
    if (category !== 'uiSettings') return;
    clearInterval(timer);
    timer = setInterval(callback, delay());
  });
  window.addEventListener('pagehide', event => {
    if (event.persisted) return;
    clearInterval(timer);
    unsubscribe();
  });
}

export function startUiTimers(root: HTMLElement, ui: UiState, refreshRooms: () => void): void {
  configuredInterval(
    () => {
      updateCountdowns(root, ui.game);
    },
    () => UI_TIMING.countdownMs,
  );
  configuredInterval(
    () => {
      if (!ui.game && ui.screen === 'rooms' && !ui.modal) refreshRooms();
    },
    () => UI_TIMING.roomPollMs,
  );
}
