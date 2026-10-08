/** Radius, in pixels, of the joystick's travel. */
const JOYSTICK_RANGE = 35;
const KNOB_TRAVEL = 30;
const bound = new WeakSet<HTMLElement>();

/**
 * On-screen joystick for spectators on touch screens. Reports a direction with length ≤ 1.
 * Safe to call after every render: an element is only wired once.
 */
export function bindJoystick(element: HTMLElement | null, onMove: (x: number, y: number) => void): void {
  if (!element || bound.has(element)) return;
  bound.add(element);
  const knob = element.firstElementChild as HTMLElement | null;
  const move = (event: PointerEvent): void => {
    const rect = element.getBoundingClientRect();
    const x = (event.clientX - rect.left - rect.width / 2) / JOYSTICK_RANGE;
    const y = (event.clientY - rect.top - rect.height / 2) / JOYSTICK_RANGE;
    const length = Math.max(1, Math.hypot(x, y));
    onMove(x / length, y / length);
    if (knob)
      knob.style.transform = `translate(${(x / length) * KNOB_TRAVEL}px, ${(y / length) * KNOB_TRAVEL}px)`;
  };
  const release = (): void => {
    delete element.dataset.active;
    onMove(0, 0);
    if (knob) knob.style.transform = '';
  };
  element.addEventListener('pointerdown', event => {
    element.setPointerCapture(event.pointerId);
    element.dataset.active = 'true';
    move(event);
  });
  element.addEventListener('pointermove', event => {
    if (element.dataset.active) move(event);
  });
  element.addEventListener('pointerup', release);
  element.addEventListener('pointercancel', release);
}
