import { useEffect, useState } from 'react';

/**
 * Three states, not two. "System" is the default and stays the default until
 * the reader explicitly overrides it, so the console matches the rest of
 * their machine unless they say otherwise.
 *
 * The choice is written to data-theme on <html>; styles.css defines the dark
 * tokens under both the media query and that attribute, which is what lets an
 * explicit choice win in either direction.
 */
const KEY = 'ingest-console-theme';

const OPTIONS = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'Match system' },
];

function readStored() {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    // Private windows and blocked site data throw on access rather than
    // returning null, so the read itself has to be guarded.
    return 'system';
  }
}

export default function ThemeSwitch() {
  const [theme, setTheme] = useState(readStored);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);

    try {
      if (theme === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, theme);
    } catch {
      // Not being able to remember the choice is not worth breaking over.
    }
  }, [theme]);

  return (
    <div className="themeswitch" role="group" aria-label="Colour theme">
      {OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          className="themeswitch__opt"
          aria-pressed={theme === option.id}
          title={option.label}
          onClick={() => setTheme(option.id)}
        >
          <Icon id={option.id} />
          <span className="sr-only">{option.label}</span>
        </button>
      ))}
    </div>
  );
}

function Icon({ id }) {
  const common = {
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.4,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  };

  if (id === 'light') {
    return (
      <svg {...common}>
        <circle cx="8" cy="8" r="3.1" />
        <path d="M8 1v1.6M8 13.4V15M15 8h-1.6M2.6 8H1M12.9 3.1l-1.1 1.1M4.2 11.8l-1.1 1.1M12.9 12.9l-1.1-1.1M4.2 4.2L3.1 3.1" />
      </svg>
    );
  }

  if (id === 'dark') {
    return (
      <svg {...common}>
        <path d="M13.5 9.4A5.8 5.8 0 016.6 2.5a5.8 5.8 0 106.9 6.9z" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <rect x="1.8" y="2.8" width="12.4" height="8.2" rx="1.2" />
      <path d="M5.6 13.6h4.8" />
    </svg>
  );
}
