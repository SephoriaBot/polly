// Remembers which page and tab you were on, so returning to Polly from
// another app (when the phone reloads it) puts you back where you were.
// Uses localStorage because iOS can clear sessionStorage when it
// reloads a home-screen app. Memory expires after 30 minutes away,
// so a fresh open later still starts on the dashboard.

const KEY = 'polly-nav';
const MAX_AGE_MS = 30 * 60 * 1000;

interface NavState {
  page: string;
  tabs: Record<string, string>;
  ts: number;
}

// True only while the app is restoring a remembered spot on load.
// Ends as soon as the user taps a nav link, so deep links like
// "dashboard -> Money Calendar" are never overridden.
let restoring = false;

function read(): NavState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as NavState;
    if (!s || typeof s.page !== 'string') return null;
    if (Date.now() - s.ts > MAX_AGE_MS) return null;
    return { page: s.page, tabs: s.tabs ?? {}, ts: s.ts };
  } catch {
    return null;
  }
}

function write(s: NavState) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...s, ts: Date.now() }));
  } catch {
    /* storage unavailable: skip silently */
  }
}

export function loadSavedPage(validPages: string[]): string | null {
  const s = read();
  if (!s || !validPages.includes(s.page)) return null;
  restoring = true;
  return s.page;
}

export function savePage(page: string, keepTabs: boolean) {
  const s = read();
  write({ page, tabs: keepTabs && s ? s.tabs : {}, ts: Date.now() });
}

export function touchNav() {
  const s = read();
  if (s) write(s);
}

export function endRestore() {
  restoring = false;
}

export function isRestoring() {
  return restoring;
}

// A tab bar is identified by its list of tab keys, so each page's
// tabs are remembered separately without touching the pages.
export function loadSavedTab(tabKeys: string[]): string | null {
  if (!restoring) return null;
  const s = read();
  const saved = s?.tabs[tabKeys.join('|')];
  return saved && tabKeys.includes(saved) ? saved : null;
}

export function saveTab(tabKeys: string[], active: string) {
  const s = read();
  if (!s) return;
  write({ ...s, tabs: { ...s.tabs, [tabKeys.join('|')]: active } });
}
