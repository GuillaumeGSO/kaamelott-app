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
import { Filters } from './components/Filters';
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

  const changeAlias = (value: string) => {
    setAlias(value);
    saveAlias(value);
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

  return (
    <div className="app">
      <header className="app-header">
        <h1>Citations Kaamelott</h1>
      </header>

      <Filters
        characters={characters}
        character={character}
        onCharacterChange={setCharacter}
        alias={alias}
        onAliasChange={changeAlias}
        favoritesOnly={favoritesOnly}
        onFavoritesOnlyChange={setFavoritesOnly}
      />

      <main className="app-main">
        <button className="next-button" onClick={nextQuote} disabled={status === 'loading'}>
          Encore une !
        </button>

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
    </div>
  );
}
