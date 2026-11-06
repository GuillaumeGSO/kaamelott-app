import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getCharacters,
  getFavoriteStatus,
  getQuoteByCharacter,
  getQuoteByFavorites,
  getRandomQuotes,
  postFavorite,
  type CharacterCount,
  type Quote,
} from './api/client';
import { QuoteQueue } from './quoteQueue';
import { applyTheme, loadTheme, saveTheme, type ThemePreference } from './theme';
import { SlidersIcon } from './components/Icons';
import { Preferences } from './components/Preferences';
import { QuoteCard } from './components/QuoteCard';

const ALIAS_STORAGE_KEY = 'kaamelott.alias';

function loadAlias(): string {
  try {
    return localStorage.getItem(ALIAS_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function saveAlias(alias: string) {
  try {
    localStorage.setItem(ALIAS_STORAGE_KEY, alias);
  } catch {
    // storage unavailable (private mode): the alias just isn't remembered
  }
}

type Status = 'loading' | 'ready' | 'empty' | 'error';

export default function App() {
  const queue = useRef(new QuoteQueue(getRandomQuotes));
  const requestId = useRef(0);

  const [characters, setCharacters] = useState<CharacterCount[]>([]);
  const [character, setCharacter] = useState('');
  const [alias, setAlias] = useState(loadAlias);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [liked, setLiked] = useState(false);
  const [status, setStatus] = useState<Status>('loading');
  const [notice, setNotice] = useState<string | null>(null);
  const [theme, setTheme] = useState(loadTheme);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  // What the quote depends on when the sheet opens: a new quote is fetched on close if it changed.
  const filtersWhenOpened = useRef('');

  const nextQuote = useCallback(async () => {
    // Ignore responses from earlier taps if the user taps again before they arrive.
    const id = ++requestId.current;
    const pseudo = alias.trim();
    setStatus('loading');
    setNotice(null);
    try {
      let next: Quote | null;
      if (favoritesOnly) next = await getQuoteByFavorites(pseudo || undefined, character || undefined);
      else if (character) next = await getQuoteByCharacter(character);
      else next = await queue.current.next();
      if (id !== requestId.current) return;

      if (!next) {
        setStatus('empty');
        return;
      }
      setQuote(next);
      setLiked(false);
      setStatus('ready');

      if (pseudo) {
        const isLiked = await getFavoriteStatus(next.quoteId, pseudo);
        if (id === requestId.current) setLiked(isLiked);
      }
    } catch {
      if (id === requestId.current) setStatus('error');
    }
  }, [alias, character, favoritesOnly]);

  // First load only: afterwards the button drives every fetch, as in the original app.
  const firstLoad = useRef(nextQuote);
  useEffect(() => {
    getCharacters().then(setCharacters).catch(() => {});
    firstLoad.current();
  }, []);

  useEffect(() => applyTheme(theme), [theme]);

  const changeAlias = (value: string) => {
    setAlias(value);
    saveAlias(value);
  };

  const changeTheme = (value: ThemePreference) => {
    setTheme(value);
    saveTheme(value);
  };

  const filtersKey = [character, favoritesOnly, favoritesOnly ? alias.trim() : ''].join('|');

  const openPreferences = () => {
    filtersWhenOpened.current = filtersKey;
    setPreferencesOpen(true);
  };

  const closePreferences = () => {
    setPreferencesOpen(false);
    if (filtersKey !== filtersWhenOpened.current) nextQuote();
  };

  const resetFilters = () => {
    setCharacter('');
    setFavoritesOnly(false);
  };

  const toggleLike = async () => {
    const pseudo = alias.trim();
    if (!quote) return;
    if (!pseudo) {
      setNotice('Entre un pseudo pour liker.');
      return;
    }
    setNotice(null);
    try {
      const likes = await postFavorite(quote.quoteId, pseudo, !liked);
      setLiked(!liked);
      setQuote({ ...quote, likes });
    } catch {
      setNotice("Le like n'est pas passé, réessaie.");
    }
  };

  const subtitle = [character || 'Tous les personnages', favoritesOnly && 'favoris'].filter(Boolean).join(' · ');

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-title">
          <h1>Citations Kaamelott</h1>
          <span className="app-subtitle">{subtitle}</span>
        </div>
        <button
          className="icon-button"
          onClick={openPreferences}
          aria-label="Préférences"
          aria-haspopup="dialog"
        >
          <SlidersIcon />
        </button>
      </header>

      <main className="app-main">
        {status === 'empty' && <p className="status">Rien trouvé, désolé.</p>}
        {status === 'error' && <p className="status">Impossible de joindre le serveur. Réessaie.</p>}
        {notice && (
          <p className="notice" role="alert">
            {notice}
          </p>
        )}

        {quote && status !== 'empty' && status !== 'error' && (
          <QuoteCard quote={quote} liked={liked} onToggleLike={toggleLike} loading={status === 'loading'} />
        )}
      </main>

      <button className="primary-button next-button" onClick={nextQuote} disabled={status === 'loading'}>
        Encore une !
      </button>

      {/* Required by the quotes' license (CC BY-SA 4.0): source, link and license. */}
      <footer className="credits">
        Citations issues de <a href="https://fr.wikiquote.org/wiki/Kaamelott">Wikiquote</a>, sous licence{' '}
        <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.fr">CC BY-SA 4.0</a>
      </footer>

      <Preferences
        open={preferencesOpen}
        onClose={closePreferences}
        characters={characters}
        character={character}
        onCharacterChange={setCharacter}
        alias={alias}
        onAliasChange={changeAlias}
        favoritesOnly={favoritesOnly}
        onFavoritesOnlyChange={setFavoritesOnly}
        theme={theme}
        onThemeChange={changeTheme}
        onReset={resetFilters}
      />
    </div>
  );
}
