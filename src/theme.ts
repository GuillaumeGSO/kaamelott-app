// Day/night preference. "auto" follows the phone; "light" and "dark" force a theme through
// the data-theme attribute on <html>, which index.css reads. index.html applies the stored
// choice before the first paint, so a forced theme never flashes the other one.

export type ThemePreference = 'auto' | 'light' | 'dark';

const STORAGE_KEY = 'kaamelott.theme';

// Same values as --bg in index.css: colors the browser bar on phones.
const THEME_COLORS = { light: '#f4ecdc', dark: '#1c1712' };

export function loadTheme(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'auto';
  } catch {
    return 'auto';
  }
}

export function saveTheme(theme: ThemePreference) {
  try {
    if (theme === 'auto') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // storage unavailable (private mode): the choice lasts until the page is closed
  }
}

export function applyTheme(theme: ThemePreference) {
  const root = document.documentElement;
  if (theme === 'auto') delete root.dataset.theme;
  else root.dataset.theme = theme;

  // index.html has one theme-color per color scheme; a forced theme overrides both.
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach(meta => {
    const scheme = meta.media.includes('dark') ? 'dark' : 'light';
    meta.content = THEME_COLORS[theme === 'auto' ? scheme : theme];
  });
}
