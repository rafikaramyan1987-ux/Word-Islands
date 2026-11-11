/** Inline SVG icons (drawn for this game). All use currentColor. */
const svg = (body: string, vb = '0 0 24 24') => `<svg viewBox="${vb}" aria-hidden="true" focusable="false">${body}</svg>`;

export const ICONS = {
  pause: svg('<rect x="6" y="5" width="4.2" height="14" rx="1.6" fill="currentColor"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.6" fill="currentColor"/>'),
  play: svg('<path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" fill="currentColor"/>'),
  gear: svg('<path fill="currentColor" d="M19.4 13a7.5 7.5 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-1.7-1L15 3.5h-4l-.4 2.5a7.6 7.6 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7.5 7.5 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7.6 7.6 0 0 0 1.7-1l2.4 1 2-3.4zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z" transform="translate(-1 0)"/>'),
  shuffle: svg('<path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="M4 7h3.5c4 0 5 10 9 10H20M4 17h3.5c1.6 0 2.7-1.6 3.6-3.4M13 10.4C13.9 8.6 15 7 16.5 7H20M17.5 4.5 20 7l-2.5 2.5M17.5 14.5 20 17l-2.5 2.5"/>'),
  bulb: svg('<path fill="currentColor" d="M12 2.5a7 7 0 0 0-4.2 12.6c.7.5 1.2 1.3 1.2 2.2v.7h6v-.7c0-.9.5-1.7 1.2-2.2A7 7 0 0 0 12 2.5z"/><rect x="9" y="19" width="6" height="2.6" rx="1.2" fill="currentColor"/><path d="M10.5 8.5a2.5 2.5 0 0 1 2-1.5" stroke="#fff" stroke-width="1.6" stroke-linecap="round" fill="none" opacity=".8"/>'),
  reveal: svg('<path fill="currentColor" d="M12 5C6.5 5 2.7 9.4 1.6 11.4a1.3 1.3 0 0 0 0 1.2C2.7 14.6 6.5 19 12 19s9.3-4.4 10.4-6.4a1.3 1.3 0 0 0 0-1.2C21.3 9.4 17.5 5 12 5zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8z"/><circle cx="12" cy="12" r="2" fill="currentColor"/>'),
  jar: svg('<path fill="currentColor" d="M8 3h8v2.4h-.9V7c2.6.8 4.4 3.2 4.4 6v5.5A2.5 2.5 0 0 1 17 21H7a2.5 2.5 0 0 1-2.5-2.5V13c0-2.8 1.8-5.2 4.4-6V5.4H8z"/><path d="M8 13.5h8" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>'),
  coin: svg('<circle cx="12" cy="12" r="10" fill="#f6b11a"/><circle cx="12" cy="12" r="7.6" fill="#ffd24a"/><path d="M12 7.4l1.4 2.9 3.2.4-2.3 2.2.6 3.2L12 14.6l-2.9 1.5.6-3.2-2.3-2.2 3.2-.4z" fill="#f6b11a"/><ellipse cx="9" cy="8" rx="2.4" ry="1.2" fill="#fff" opacity=".55" transform="rotate(-35 9 8)"/>'),
  tv: svg('<rect x="2.5" y="5.5" width="19" height="13" rx="3" fill="currentColor"/><path d="M8 2.5l4 3 4-3" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M10 9.2v5.6l4.8-2.8z" fill="#fff"/>'),
  music: svg('<path fill="currentColor" d="M19 3.5v11.6a3.2 3.2 0 1 1-2-3V7.4l-7 1.6v8.1a3.2 3.2 0 1 1-2-3V5.6z"/>'),
  sound: svg('<path fill="currentColor" d="M4 9h3.5L12 5v14l-4.5-4H4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>'),
  globe: svg('<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z" fill="none" stroke="currentColor" stroke-width="1.8"/>'),
  home: svg('<path fill="currentColor" d="M12 3.2 2.8 11a1 1 0 0 0 .7 1.8H5V20a1 1 0 0 0 1 1h4v-5h4v5h4a1 1 0 0 0 1-1v-7.2h1.5a1 1 0 0 0 .7-1.8z"/>'),
  back: svg('<path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'),
  close: svg('<path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>'),
  map: svg('<path fill="currentColor" d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6zm0 2.2 6 2v11.6l-6-2z"/>'),
  lock: svg('<rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="currentColor"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke="currentColor" stroke-width="2.4" fill="none"/>'),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'),
  sail: svg('<path d="M12 2.5v15" stroke="currentColor" stroke-width="1.8"/><path d="M12.8 3.5c3.5 3 5.6 7.4 5.7 12H12.8z" fill="currentColor"/><path d="M11.2 6.5c-2.4 2.4-4 5.6-4.2 9h4.2z" fill="currentColor" opacity=".75"/><path d="M3.5 18h17l-2.2 3.2H5.7z" fill="currentColor"/>'),
  trophy: svg('<path fill="currentColor" d="M7 3h10v2h3.5v2.5A4.5 4.5 0 0 1 16.6 12 5.5 5.5 0 0 1 13 14.8V17h3v3H8v-3h3v-2.2A5.5 5.5 0 0 1 7.4 12 4.5 4.5 0 0 1 3.5 7.5V5H7zm0 4H5.5v.5A2.5 2.5 0 0 0 7.2 9.9 7 7 0 0 1 7 8.5zm10 0v1.5a7 7 0 0 1-.2 1.4 2.5 2.5 0 0 0 1.7-2.4V7z"/>'),
  calendar: svg('<rect x="3" y="5" width="18" height="16" rx="3" fill="currentColor"/><rect x="5.5" y="10" width="13" height="8.5" rx="1.5" fill="#fff" opacity=".9"/><path d="M8 3v4M16 3v4" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="14.2" r="2" fill="currentColor"/>'),
  hand: svg('<path d="M9.2 3.6c-.9 0-1.6.7-1.6 1.6v8.6l-1.5-1.6c-.7-.7-1.8-.8-2.5-.1-.6.6-.6 1.5-.1 2.2l3.6 5c1.3 1.8 3.3 2.9 5.5 2.9h1.6c3.2 0 5.8-2.6 5.8-5.8v-4.6c0-.9-.7-1.6-1.6-1.6s-1.6.7-1.6 1.6v-.9c0-.9-.7-1.6-1.6-1.6s-1.6.7-1.6 1.6v-.6c0-.9-.7-1.6-1.6-1.6s-1.6.7-1.6 1.6V5.2c0-.9-.7-1.6-1.6-1.6z" fill="#fff" stroke="#1d3557" stroke-width="1.4" stroke-linejoin="round"/>'),
};
