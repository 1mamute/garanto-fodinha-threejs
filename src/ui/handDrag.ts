/**
 * Dragging cards in the on-screen hand: drag up to play a card, sideways onto another card to
 * reorder. A click right after a drag is ignored so it does not also select the card.
 */
const DRAG_THRESHOLD_PX = 8;
const PLAY_DISTANCE_PX = 90;
const CLICK_SUPPRESS_MS = 400;

interface ActiveDrag {
  pointerId: number;
  cardId: string;
  startX: number;
  startY: number;
  element: HTMLElement;
  moved: boolean;
}

export interface HandDragHandlers {
  canDrag(): boolean;
  onPlay(cardId: string): void;
  onReorder(cardId: string, index: number): void;
  /** Called after a real drag ends, so the hand can be re-rendered. */
  onDragEnd(): void;
}

export class HandDrag {
  private drag: ActiveDrag | null = null;
  private suppressClickUntil = 0;

  constructor(
    root: HTMLElement,
    private readonly handlers: HandDragHandlers,
  ) {
    root.addEventListener('pointerdown', event => {
      this.start(event);
    });
    root.addEventListener('pointermove', event => {
      this.move(event);
    });
    root.addEventListener('pointerup', event => {
      this.release(event);
    });
    root.addEventListener('pointercancel', event => {
      this.release(event);
    });
  }

  /** Re-rendering mid-drag would snap the card back, so renders wait until the drop. */
  get isDragging(): boolean {
    return this.drag?.moved === true;
  }

  get clickSuppressed(): boolean {
    return performance.now() < this.suppressClickUntil;
  }

  private start(event: PointerEvent): void {
    const element = (event.target as Element | null)?.closest<HTMLButtonElement>('.hand-card');
    const cardId = element?.dataset.card;
    if (!element || element.disabled || !cardId || !this.handlers.canDrag()) return;
    element.setPointerCapture(event.pointerId);
    this.drag = {
      pointerId: event.pointerId,
      cardId,
      startX: event.clientX,
      startY: event.clientY,
      element,
      moved: false,
    };
  }

  private move(event: PointerEvent): void {
    const drag = this.drag;
    if (drag?.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) drag.moved = true;
    if (!drag.moved) return;
    drag.element.style.transform = `translate(${dx}px, ${dy}px) rotate(${dx * 0.03}deg)`;
    drag.element.style.zIndex = '100';
  }

  private release(event: PointerEvent): void {
    const drag = this.drag;
    if (drag?.pointerId !== event.pointerId) return;
    this.drag = null;
    drag.element.style.transform = '';
    drag.element.style.zIndex = '';
    if (!drag.moved || event.type === 'pointercancel') return;
    this.suppressClickUntil = performance.now() + CLICK_SUPPRESS_MS;
    if (drag.startY - event.clientY > PLAY_DISTANCE_PX) this.handlers.onPlay(drag.cardId);
    else this.dropOnCard(drag, event);
    this.handlers.onDragEnd();
  }

  private dropOnCard(drag: ActiveDrag, event: PointerEvent): void {
    // Hide the dragged card from hit-testing to find the card underneath it.
    drag.element.style.pointerEvents = 'none';
    const target = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>('.hand-card');
    drag.element.style.pointerEvents = '';
    if (target?.dataset.index) this.handlers.onReorder(drag.cardId, Number(target.dataset.index));
  }
}
