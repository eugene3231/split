import { useEffect, useState } from 'react';

/**
 * An image made off the main path, such as a QR code, for as long as `key` stays the same. Null
 * while it is being made, or when making it failed.
 */
export function useDataUrl(key: string | null, make: () => Promise<string>): string | null {
  const [made, setMade] = useState<{ key: string; url: string } | null>(null);

  useEffect(() => {
    if (key === null) return;
    let current = true;
    make().then(
      (url) => {
        if (current) setMade({ key, url });
      },
      () => {},
    );
    return () => {
      current = false;
    };
    // `make` is rebuilt every render; `key` names what it makes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return made !== null && made.key === key ? made.url : null;
}
