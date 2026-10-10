import { useEffect, useRef, useState } from 'react';
import type { MouseEvent, PointerEvent } from 'react';

const PRESS_MS = 450;
const LINGER_MS = 1200;

/**
 * Shows a label while a touch is held down, and swallows the click that ends a long press.
 * Mouse hover is left to CSS.
 */
export function useLongPress() {
  const [pressed, setPressed] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const longPressed = useRef(false);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const release = () => {
    window.clearTimeout(timer.current);
    if (longPressed.current) timer.current = window.setTimeout(() => setPressed(false), LINGER_MS);
  };

  return {
    pressed,
    handlers: {
      onPointerDown: (event: PointerEvent) => {
        longPressed.current = false;
        if (event.pointerType !== 'touch') return;
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => {
          longPressed.current = true;
          setPressed(true);
        }, PRESS_MS);
      },
      onPointerUp: release,
      onPointerLeave: release,
      onPointerCancel: release,
      onContextMenu: (event: MouseEvent) => event.preventDefault(),
      onClickCapture: (event: MouseEvent) => {
        if (!longPressed.current) return;
        longPressed.current = false;
        event.stopPropagation();
        event.preventDefault();
      },
    },
  };
}
