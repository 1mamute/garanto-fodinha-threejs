/**
 * Auto-escaping HTML templates.
 *
 * Everything interpolated into `html\`...\`` is escaped unless it is itself a `SafeHtml`
 * (another template or a trusted constant). Player names, chat text and any field that
 * came from another browser can therefore never inject markup.
 */
export class SafeHtml {
  constructor(readonly markup: string) {}

  toString(): string {
    return this.markup;
  }
}

/** Accepted interpolations. `false`, `null` and `undefined` render nothing, for `condition && html\`…\``. */
export type HtmlValue = SafeHtml | string | number | boolean | null | undefined | readonly HtmlValue[];

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, character => ESCAPES[character] ?? character);
}

function renderValue(value: HtmlValue): string {
  if (value instanceof SafeHtml) return value.markup;
  if (Array.isArray(value)) return value.map(renderValue).join('');
  if (value === null || value === undefined || typeof value === 'boolean') return '';
  return escapeHtml(String(value));
}

export function html(strings: TemplateStringsArray, ...values: HtmlValue[]): SafeHtml {
  let markup = strings[0] ?? '';
  values.forEach((value, index) => {
    markup += renderValue(value) + (strings[index + 1] ?? '');
  });
  return new SafeHtml(markup);
}

/** Marks a constant as trusted markup. Never pass data that came from a player. */
export function trustedHtml(markup: string): SafeHtml {
  return new SafeHtml(markup);
}
