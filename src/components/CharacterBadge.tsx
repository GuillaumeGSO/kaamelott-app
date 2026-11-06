// Initials on a colored disc. Stands in for character photos, which are not ours to reuse.
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(word => word.length > 2 || /^[A-ZÀ-Ý]/.test(word))
    .slice(0, 2)
    .map(word => word[0].toUpperCase())
    .join('');
}

// Number of --badge-N colors in index.css: a small palette matched to the theme, so a
// character always gets the same color and no color clashes with the parchment.
const PALETTE_SIZE = 6;

function badgeIndex(name: string): number {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) % 9973;
  return hash % PALETTE_SIZE;
}

export function CharacterBadge({ name, small = false }: { name: string; small?: boolean }) {
  return (
    <span className={`character-badge badge-${badgeIndex(name)}${small ? ' small' : ''}`} aria-hidden="true">
      {initials(name)}
    </span>
  );
}
