/** Shared by DOM overlays and player labels rendered inside the 3D scene. */
export function isUiHidden(): boolean {
  return import.meta.env.DEV && document.body.classList.contains('ui-hidden');
}

export function bindUiVisibilityShortcut(): void {
  window.addEventListener('keydown', event => {
    if (
      event.code !== 'KeyV' ||
      !event.shiftKey ||
      event.ctrlKey ||
      event.altKey ||
      event.metaKey ||
      event.repeat
    )
      return;
    if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable]'))
      return;
    event.preventDefault();
    const hidden = document.body.classList.toggle('ui-hidden');
    if (hidden && document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
}
