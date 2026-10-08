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

export type SoundKind = 'play' | 'win';

let audio: AudioContext | null = null;

/** A tiny synthesized blip: falling pitch for a played card, rising for a won trick. */
export function playSound(kind: SoundKind): void {
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') void audio.resume();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.connect(gain);
    gain.connect(audio.destination);
    const start = audio.currentTime;
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(kind === 'play' ? 460 : 660, start);
    oscillator.frequency.exponentialRampToValueAtTime(kind === 'play' ? 180 : 880, start + 0.13);
    gain.gain.setValueAtTime(0.035, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);
    oscillator.start();
    oscillator.stop(start + 0.19);
  } catch {
    // Audio is optional (blocked autoplay, missing API).
  }
}
