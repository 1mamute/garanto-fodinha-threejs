import { trustedHtml, type SafeHtml } from './html';

const ICON_PATHS = {
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  users:
    '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 5"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  refresh: '<path d="M20 7v5h-5M4 17v-5h5M5 8a8 8 0 0 1 13-3l2 2M4 17l2 2a8 8 0 0 0 13-3"/>',
  chat: '<path d="M21 14a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  volume: '<path d="M3 9h4l5-4v14l-5-4H3Z"/><path d="M16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  cards:
    '<rect x="8" y="3" width="12" height="17" rx="2"/><path d="m8 7-5 1a2 2 0 0 0-2 3l3 10a2 2 0 0 0 3 1l5-2"/>',
  robot:
    '<rect x="4" y="7" width="16" height="13" rx="5"/><path d="M12 7V3m-8 9H2m18 0h2m-13 4h6"/><circle cx="8" cy="12" r="1"/><circle cx="16" cy="12" r="1"/>',
  trophy: '<path d="M8 3h8v6a4 4 0 0 1-8 0ZM8 5H4v3a4 4 0 0 0 5 4m7-7h4v3a4 4 0 0 1-5 4m-3 1v7m-4 0h8"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
} as const;

export type IconName = keyof typeof ICON_PATHS;

export function icon(name: IconName, size = 20): SafeHtml {
  return trustedHtml(
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name]}</svg>`,
  );
}
