import { useEffect, useState } from 'react';

/**
 * Subscribe to a CSS media query.
 *
 * Used to keep exactly one instance of the mode switcher in the DOM: the
 * header carries it on wide screens, the navigation panel carries it on
 * narrow ones. Rendering both would leave a duplicate control in the
 * accessibility tree.
 */
export default function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    try {
      return window.matchMedia(query).matches;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    let media;
    try {
      media = window.matchMedia(query);
    } catch {
      return undefined;
    }

    const onChange = (event) => setMatches(event.matches);
    setMatches(media.matches);

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    }
    media.addListener?.(onChange);
    return () => media.removeListener?.(onChange);
  }, [query]);

  return matches;
}
