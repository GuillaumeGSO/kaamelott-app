import { useEffect, useRef, useState } from 'react';
import type { CharacterCount } from '../api/client';
import type { ThemePreference } from '../theme';
import { CharacterBadge } from './CharacterBadge';
import { MoonIcon, PhoneIcon, SearchIcon, SunIcon } from './Icons';

interface PreferencesProps {
  open: boolean;
  onClose: () => void;
  characters: CharacterCount[];
  character: string;
  onCharacterChange: (character: string) => void;
  alias: string;
  onAliasChange: (alias: string) => void;
  favoritesOnly: boolean;
  onFavoritesOnlyChange: (favoritesOnly: boolean) => void;
  theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
  onReset: () => void;
}

// Matches the API limit on aliases (MAX_ALIAS_LENGTH in kaamelott-lambda).
const MAX_ALIAS_LENGTH = 20;

const THEMES = [
  { value: 'auto', label: 'Auto', Icon: PhoneIcon },
  { value: 'light', label: 'Jour', Icon: SunIcon },
  { value: 'dark', label: 'Nuit', Icon: MoonIcon },
] as const;

// "leo" finds "Léodagan".
function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

// Bottom sheet holding the filters, the pseudo and the day/night choice. Changes apply as
// they are made; closing the sheet (button, Escape or a tap outside) hands back to the app.
export function Preferences({
  open,
  onClose,
  characters,
  character,
  onCharacterChange,
  alias,
  onAliasChange,
  favoritesOnly,
  onFavoritesOnlyChange,
  theme,
  onThemeChange,
  onReset,
}: PreferencesProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) {
      setSearch('');
      element.showModal();
    } else if (!open && element.open) {
      element.close();
    }
  }, [open]);

  const close = () => dialog.current?.close();

  // Most quoted first: the usual picks are on top, the search finds the others.
  const query = normalize(search.trim());
  const shown = characters
    .filter(c => !query || normalize(c.character).includes(query))
    .sort((a, b) => b.numberOfQuotes - a.numberOfQuotes || a.character.localeCompare(b.character, 'fr'));

  return (
    <dialog
      ref={dialog}
      className="preferences"
      aria-labelledby="preferences-title"
      onClose={onClose}
      // The dialog box itself is only reachable through its backdrop: the body fills it.
      onClick={event => event.target === event.currentTarget && close()}
    >
      <div className="preferences-body">
        <div className="sheet-handle" aria-hidden="true" />

        <div className="preferences-header">
          <h2 id="preferences-title">Préférences</h2>
          <button className="text-button" onClick={onReset}>
            Réinitialiser
          </button>
        </div>

        <fieldset className="field">
          <legend className="label">Personnage</legend>
          <label className="search">
            <SearchIcon />
            <span className="sr-only">Chercher un personnage</span>
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={`Chercher parmi ${characters.length} personnages`}
            />
          </label>
          <div className="character-list">
            {!query && (
              <label className="character-option">
                <input
                  type="radio"
                  name="character"
                  checked={character === ''}
                  onChange={() => onCharacterChange('')}
                />
                <span className="character-name">Tous les personnages</span>
              </label>
            )}
            {shown.map(c => (
              <label key={c.character} className="character-option">
                <input
                  type="radio"
                  name="character"
                  checked={character === c.character}
                  onChange={() => onCharacterChange(c.character)}
                  aria-label={`${c.character}, ${c.numberOfQuotes} citations`}
                />
                <CharacterBadge name={c.character} small />
                <span className="character-name">{c.character}</span>
                <span className="character-count">{c.numberOfQuotes}</span>
              </label>
            ))}
            {query && shown.length === 0 && <p className="character-empty">Personne de ce nom.</p>}
          </div>
        </fieldset>

        <div className="field">
          <label className="label" htmlFor="alias">
            Pseudo
          </label>
          <input
            id="alias"
            className="text-input"
            type="text"
            value={alias}
            onChange={e => onAliasChange(e.target.value)}
            maxLength={MAX_ALIAS_LENGTH}
            autoComplete="nickname"
            aria-describedby="alias-hint"
          />
          <span id="alias-hint" className="hint">
            Sert à liker et à retrouver tes favoris.
          </span>
        </div>

        <label className="switch-row">
          {alias.trim() ? 'Seulement mes favoris' : 'Seulement les favoris de tout le monde'}
          <input
            className="switch"
            type="checkbox"
            role="switch"
            checked={favoritesOnly}
            onChange={e => onFavoritesOnlyChange(e.target.checked)}
          />
        </label>

        <fieldset className="field">
          <legend className="label">Apparence</legend>
          <div className="segmented">
            {THEMES.map(({ value, label, Icon }) => (
              <label key={value} className="segment">
                <input
                  type="radio"
                  name="theme"
                  value={value}
                  checked={theme === value}
                  onChange={() => onThemeChange(value)}
                />
                <Icon /> {label}
              </label>
            ))}
          </div>
        </fieldset>

        <button className="primary-button" onClick={close}>
          Voir les citations
        </button>
      </div>
    </dialog>
  );
}
