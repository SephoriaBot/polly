// Remembers which page and tab you were on, so returning to Polly from
// another app puts you back where you were, whether the phone reloaded
// the whole app or just rebuilt the page.
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
  return s.page;
}

export function savePage(page: string) {
  const s = read();
  write({ page, tabs: s ? s.tabs : {}, ts: Date.now() });
}

// Called when the user deliberately navigates to a page, so that page
// starts on its first tab (or the tab a shortcut asked for).
export function clearTabs() {
  const s = read();
  if (s) write({ ...s, tabs: {} });
}

export function touchNav() {
  const s = read();
  if (s) write(s);
}

// A tab bar is identified by its list of tab keys, so each page's
// tabs are remembered separately without touching the pages.
export function loadSavedTab(tabKeys: string[]): string | null {
  const s = read();
  const saved = s?.tabs[tabKeys.join('|')];
  return saved && tabKeys.includes(saved) ? saved : null;
}

export function saveTab(tabKeys: string[], active: string) {
  const s = read();
  if (!s) return;
  write({ ...s, tabs: { ...s.tabs, [tabKeys.join('|')]: active } });
}
