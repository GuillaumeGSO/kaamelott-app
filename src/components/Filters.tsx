import type { CharacterCount } from '../api/client';

interface FiltersProps {
  characters: CharacterCount[];
  character: string;
  onCharacterChange: (character: string) => void;
  alias: string;
  onAliasChange: (alias: string) => void;
  favoritesOnly: boolean;
  onFavoritesOnlyChange: (favoritesOnly: boolean) => void;
}

// Matches the API limit on aliases (MAX_ALIAS_LENGTH in kamelott-lambda).
const MAX_ALIAS_LENGTH = 20;

export function Filters({
  characters,
  character,
  onCharacterChange,
  alias,
  onAliasChange,
  favoritesOnly,
  onFavoritesOnlyChange,
}: FiltersProps) {
  const active = [character, favoritesOnly && 'favoris'].filter(Boolean).join(' · ');

  return (
    <details className="filters">
      <summary>
        Filtres{active && <span className="filters-active"> · {active}</span>}
      </summary>
      <div className="filters-body">
        <label>
          Personnage
          <select value={character} onChange={e => onCharacterChange(e.target.value)}>
            <option value="">Tous les personnages</option>
            {characters.map(c => (
              <option key={c.character} value={c.character}>
                {c.character} ({c.numberOfQuotes})
              </option>
            ))}
          </select>
        </label>

        <label>
          Pseudo
          <input
            type="text"
            value={alias}
            onChange={e => onAliasChange(e.target.value)}
            placeholder="pour liker tes citations"
            maxLength={MAX_ALIAS_LENGTH}
            autoComplete="nickname"
          />
        </label>

        <label className="checkbox">
          <input type="checkbox" checked={favoritesOnly} onChange={e => onFavoritesOnlyChange(e.target.checked)} />
          Seulement les favoris
        </label>
      </div>
    </details>
  );
}
