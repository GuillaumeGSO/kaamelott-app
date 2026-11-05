// Initials on a colored disc. Stands in for character photos, which are not ours to reuse.
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(word => word.length > 2 || /^[A-ZÀ-Ý]/.test(word))
    .slice(0, 2)
    .map(word => word[0].toUpperCase())
    .join('');
}

function hue(name: string): number {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return hash;
}

export function CharacterBadge({ name }: { name: string }) {
  return (
    <span className="character-badge" style={{ backgroundColor: `hsl(${hue(name)} 45% 35%)` }} aria-hidden="true">
      {initials(name)}
    </span>
  );
}
