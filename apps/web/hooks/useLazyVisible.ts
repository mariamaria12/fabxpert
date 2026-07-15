import { useEffect, useRef, useState } from 'react';

/**
 * Becomes true once the returned ref element enters (or nears) the viewport.
 * Used to defer below-the-fold fetches until the user scrolls near them.
 */
export function useLazyVisible(options?: { rootMargin?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const rootMargin = options?.rootMargin ?? '300px';

  useEffect(() => {
    const element = ref.current;
    if (!element || visible) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [rootMargin, visible]);

  return { ref, visible };
}
