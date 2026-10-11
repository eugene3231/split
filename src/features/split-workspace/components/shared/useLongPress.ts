import { useEffect, useRef, useState } from 'react';
import type { MouseEvent, PointerEvent } from 'react';

const PRESS_MS = 450;
const LONG_PRESS_LINGER_MS = 1500;
const TAP_LINGER_MS = 3000;

/**
 * Shows a label while a touch is held down, and swallows the click that ends a long press.
 * Mouse hover is left to CSS.
 */
export function useLongPress() {
  const [pressed, setPressed] = useState(false);
  const pressTimer = useRef<number | undefined>(undefined);
  const hideTimer = useRef<number | undefined>(undefined);
  const longPressed = useRef(false);

  useEffect(
    () => () => {
      window.clearTimeout(pressTimer.current);
      window.clearTimeout(hideTimer.current);
    },
    [],
  );

  const show = (lingerMs: number) => {
    window.clearTimeout(hideTimer.current);
    setPressed(true);
    hideTimer.current = window.setTimeout(() => setPressed(false), lingerMs);
  };

  const hide = () => {
    window.clearTimeout(hideTimer.current);
    setPressed(false);
  };

  const release = () => {
    window.clearTimeout(pressTimer.current);
    if (longPressed.current) show(LONG_PRESS_LINGER_MS);
  };

  /** Toggles the label on a tap, for something that does nothing else when tapped. */
  const toggle = () => (pressed ? hide() : show(TAP_LINGER_MS));

  return {
    pressed,
    toggle,
    handlers: {
      onPointerDown: (event: PointerEvent) => {
        longPressed.current = false;
        if (event.pointerType !== 'touch') return;
        window.clearTimeout(pressTimer.current);
        pressTimer.current = window.setTimeout(() => {
          longPressed.current = true;
          show(LONG_PRESS_LINGER_MS);
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
