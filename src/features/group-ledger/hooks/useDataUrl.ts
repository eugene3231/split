import { useEffect, useEffectEvent, useState } from 'react';

export type DataUrl =
  { status: 'loading' } | { status: 'ready'; url: string } | { status: 'failed' };

/**
 * An image drawn off the render path, such as a QR code, from `key`: the data it shows. A new key
 * draws it again. An empty URL counts as a failure.
 */
export function useDataUrl(key: string, make: () => Promise<string>): DataUrl {
  const [made, setMade] = useState<{ key: string; result: DataUrl } | null>(null);
  const draw = useEffectEvent(make);

  useEffect(() => {
    let current = true;
    const settle = (result: DataUrl) => {
      if (current) setMade({ key, result });
    };
    draw().then(
      (url) => settle(url ? { status: 'ready', url } : { status: 'failed' }),
      () => settle({ status: 'failed' }),
    );
    return () => {
      current = false;
    };
  }, [key]);

  return made?.key === key ? made.result : { status: 'loading' };
}
