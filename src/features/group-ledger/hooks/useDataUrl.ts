import { useEffect, useState } from 'react';

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
  }, [key]);

  return made !== null && made.key === key ? made.url : null;
}
