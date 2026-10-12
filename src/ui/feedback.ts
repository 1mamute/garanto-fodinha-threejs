import { SOUND_SETTINGS } from './soundSettings';

const TOAST_MS = 4_500;
let toastTimer: ReturnType<typeof setTimeout> | undefined;

/** Short message at the bottom of the screen. Uses `textContent`, so any text is safe. */
export function toast(message: string): void {
  const element = document.querySelector('#toast');
  if (!element) return;
  element.textContent = message;
  element.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    element.classList.remove('visible');
  }, TOAST_MS);
}

export type SoundKind = keyof typeof SOUND_SETTINGS;

let audio: AudioContext | null = null;

/** Short synthesized cues with independent, tunable profiles. */
export function playSound(kind: SoundKind): void {
  const settings = SOUND_SETTINGS[kind];
  if (settings.gain === 0) return;
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') void audio.resume();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.connect(gain);
    gain.connect(audio.destination);
    const start = audio.currentTime;
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(settings.startHz, start);
    oscillator.frequency.exponentialRampToValueAtTime(settings.endHz, start + settings.durationSeconds * 0.7);
    gain.gain.setValueAtTime(settings.gain, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + settings.durationSeconds * 0.95);
    oscillator.start();
    oscillator.stop(start + settings.durationSeconds);
  } catch {
    // Audio is optional (blocked autoplay, missing API).
  }
}
