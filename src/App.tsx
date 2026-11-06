import { useCallback, useEffect, useRef, useState } from 'react';
import { getAllQuotes, getFavorites, getLikes, postFavorite, type Quote } from './api/client';
import { QuoteDeck, type CharacterCount } from './quoteDeck';
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

// The quotes a pseudo has liked, with the pseudo they belong to.
interface Favorites {
  alias: string;
  ids: Set<string>;
}

export default function App() {
  const deck = useRef<QuoteDeck | null>(null);
  // Mirrors the favorites state for the loaders, which must not change on every like.
  const favoritesRef = useRef<Favorites | null>(null);
  const requestId = useRef(0);

  const [characters, setCharacters] = useState<CharacterCount[]>([]);
  const [likes, setLikes] = useState<Record<string, number>>({});
  const [favorites, setFavorites] = useState<Favorites | null>(null);
  const [character, setCharacter] = useState('');
  const [alias, setAlias] = useState(loadAlias);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [notice, setNotice] = useState<string | null>(null);
  const [theme, setTheme] = useState(loadTheme);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  // What the quote depends on when the sheet opens: a new quote is fetched on close if it changed.
  const filtersWhenOpened = useRef('');

  // Every quote and like count, fetched once: picks and filters then happen in the browser.
  // A failure leaves the deck empty, so the next tap retries.
  const loadDeck = useCallback(async (): Promise<QuoteDeck> => {
    if (deck.current) return deck.current;
    // Like counts are only decoration: quotes still show (with 0) if they can't be loaded.
    const [quotes, counts] = await Promise.all([getAllQuotes(), getLikes().catch(() => ({}))]);
    deck.current ??= new QuoteDeck(quotes);
    setLikes(counts);
    setCharacters(deck.current.characters());
    return deck.current;
  }, []);

  // A pseudo's liked quotes, fetched once per pseudo.
  const loadFavorites = useCallback(async (pseudo: string): Promise<Set<string>> => {
    if (favoritesRef.current?.alias === pseudo) return favoritesRef.current.ids;
    const ids = new Set(await getFavorites(pseudo));
    favoritesRef.current = { alias: pseudo, ids };
    setFavorites(favoritesRef.current);
    return ids;
  }, []);

  const nextQuote = useCallback(async () => {
    // Ignore results from earlier taps if the user taps again before they arrive.
    const id = ++requestId.current;
    const pseudo = alias.trim();
    setStatus('loading');
    setNotice(null);
    try {
      const quotes = await loadDeck();
      let liked: Set<string> | null = null;
      if (pseudo) {
        try {
          liked = await loadFavorites(pseudo);
        } catch (error) {
          // Only the favorites filter needs them; otherwise the heart just shows as not liked.
          if (favoritesOnly) throw error;
        }
      }
      if (id !== requestId.current) return;

      // Without a pseudo, the favorites are those of everyone: quotes liked at least once.
      const next = quotes.next(
        q =>
          (!character || q.character === character) &&
          (!favoritesOnly || (liked ? liked.has(q.quoteId) : (likes[q.quoteId] ?? 0) > 0)),
      );
      if (!next) {
        setStatus('empty');
        return;
      }
      setQuote(next);
      setStatus('ready');
    } catch {
      if (id === requestId.current) setStatus('error');
    }
  }, [alias, character, favoritesOnly, likes, loadDeck, loadFavorites]);

  // First load only: afterwards the button drives every quote, as in the original app.
  const firstLoad = useRef(nextQuote);
  useEffect(() => {
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
    const pseudo = alias.trim();
    if (filtersKey !== filtersWhenOpened.current) nextQuote();
    // A new pseudo: show whether the current quote is among its likes.
    else if (pseudo) loadFavorites(pseudo).catch(() => {});
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
      const ids = await loadFavorites(pseudo);
      const like = !ids.has(quote.quoteId);
      const count = await postFavorite(quote.quoteId, pseudo, like);
      const updated = new Set(ids);
      if (like) updated.add(quote.quoteId);
      else updated.delete(quote.quoteId);
      favoritesRef.current = { alias: pseudo, ids: updated };
      setFavorites(favoritesRef.current);
      setLikes(current => ({ ...current, [quote.quoteId]: count }));
    } catch {
      setNotice("Le like n'est pas passé, réessaie.");
    }
  };

  const liked = !!quote && favorites?.alias === alias.trim() && favorites.ids.has(quote.quoteId);

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
          <QuoteCard
            quote={quote}
            likes={likes[quote.quoteId] ?? 0}
            liked={liked}
            onToggleLike={toggleLike}
            loading={status === 'loading'}
          />
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
