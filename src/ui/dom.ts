/**
 * Minimal DOM morphing: updates `target` to match new markup while keeping the existing nodes.
 *
 * Replacing `innerHTML` on every game update destroyed the focused input, open dropdowns and
 * running CSS transitions. Morphing only touches what changed, so those survive re-renders.
 * Children are matched by position; `data-key` (or `id`) forces a replacement when the identity
 * of the element at a position changes.
 */
import type { SafeHtml } from './html';

export function morph(target: Element, markup: SafeHtml): void {
  const template = document.createElement('template');
  template.innerHTML = markup.markup;
  removeIndentation(template.content);
  morphChildren(target, template.content);
}

/**
 * Templates are indented for readability. Whitespace-only text between tags is dropped so that
 * indentation never adds gaps between inline elements; spaces next to real text are kept.
 */
function removeIndentation(root: DocumentFragment): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const blanks: Node[] = [];
  while (walker.nextNode()) {
    if (!walker.currentNode.nodeValue?.trim()) blanks.push(walker.currentNode);
  }
  for (const blank of blanks) blank.parentNode?.removeChild(blank);
}

function identity(element: Element): string {
  return `${element.tagName}#${element.id}#${element.getAttribute('data-key') ?? ''}`;
}

function isSameKind(current: Node, next: Node): boolean {
  if (current.nodeType !== next.nodeType) return false;
  if (!(current instanceof Element) || !(next instanceof Element)) return true;
  return identity(current) === identity(next);
}

function morphChildren(current: ParentNode & Node, next: ParentNode & Node): void {
  const currentNodes = [...current.childNodes];
  const nextNodes = [...next.childNodes];
  nextNodes.forEach((nextNode, index) => {
    const node = currentNodes[index];
    if (!node) current.appendChild(nextNode);
    else if (isSameKind(node, nextNode)) morphNode(node, nextNode);
    else current.replaceChild(nextNode, node);
  });
  for (const extra of currentNodes.slice(nextNodes.length)) extra.remove();
}

function morphNode(current: Node, next: Node): void {
  if (!(current instanceof Element) || !(next instanceof Element)) {
    if (current.nodeValue !== next.nodeValue) current.nodeValue = next.nodeValue;
    return;
  }
  const previousSelection = current instanceof HTMLSelectElement ? selectedAttribute(current) : null;
  syncAttributes(current, next);
  morphChildren(current, next);
  if (current instanceof HTMLSelectElement) syncSelect(current, previousSelection);
}

/**
 * Attributes are copied as-is. Form values are properties, so they only follow the markup when
 * the `value` attribute itself changed; otherwise whatever the player typed stays in place.
 */
function syncAttributes(current: Element, next: Element): void {
  for (const { name } of [...current.attributes]) {
    // Inline styles absent from the markup were set by scripts (drag, joystick knob): keep them.
    // Native disclosures also own their open state across game updates.
    if (!next.hasAttribute(name) && !preservesAttribute(current, name)) current.removeAttribute(name);
  }
  for (const { name, value } of [...next.attributes]) {
    if (current.getAttribute(name) === value) continue;
    current.setAttribute(name, value);
    if (name === 'value' && current instanceof HTMLInputElement) current.value = value;
  }
}

function preservesAttribute(element: Element, name: string): boolean {
  return name === 'style' || (name === 'open' && element instanceof HTMLDetailsElement);
}

function selectedAttribute(select: HTMLSelectElement): string | null {
  const option = [...select.options].find(candidate => candidate.hasAttribute('selected'));
  return option?.value ?? null;
}

/** A `<select>` follows the markup only when its `selected` option changed, and never while open. */
function syncSelect(select: HTMLSelectElement, previousSelection: string | null): void {
  const selection = selectedAttribute(select);
  if (selection !== null && selection !== previousSelection && document.activeElement !== select) {
    select.value = selection;
  }
}
