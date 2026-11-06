// Stroke icons, drawn in currentColor. Always decorative: the button carries the label.
import type { ReactNode } from 'react';

function Icon({ size = 20, children, fill = 'none' }: { size?: number; children: ReactNode; fill?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const SlidersIcon = () => (
  <Icon>
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="10" cy="17" r="2" />
  </Icon>
);

export const HeartIcon = ({ filled }: { filled: boolean }) => (
  <Icon fill={filled ? 'currentColor' : 'none'}>
    <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
  </Icon>
);

export const PlayIcon = () => (
  <Icon size={16}>
    <path d="M7 5l12 7-12 7z" />
  </Icon>
);

export const SearchIcon = () => (
  <Icon size={18}>
    <circle cx="11" cy="11" r="6" />
    <path d="M20 20l-4.5-4.5" />
  </Icon>
);

export const DiamondIcon = () => (
  <Icon size={14}>
    <path d="M12 3l3 9-3 9-3-9z" />
  </Icon>
);

export const PhoneIcon = () => (
  <Icon size={16}>
    <rect x="7" y="3" width="10" height="18" rx="2" />
    <path d="M11 18h2" />
  </Icon>
);

export const SunIcon = () => (
  <Icon size={16}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
  </Icon>
);

export const MoonIcon = () => (
  <Icon size={16}>
    <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
  </Icon>
);
