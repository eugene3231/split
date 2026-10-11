import { useEffect, useId, useRef } from 'react';
import { create } from 'zustand';
import type { MouseEvent, PointerEvent } from 'react';

const PRESS_MS = 450;
const LABEL_LINGER_MS = 2000;

interface ActiveLabelState {
  activeId: string | null;
}

const useActiveLabelStore = create<ActiveLabelState>(() => ({ activeId: null }));

function hideLabel(id: string) {
  if (useActiveLabelStore.getState().activeId === id) {
    useActiveLabelStore.setState({ activeId: null });
  }
}

/**
 * Shows a label while a touch is held down, and swallows the click that ends a long press.
 * Only one label is visible, for at most two seconds after an interaction.
 */
export function useLongPress() {
  const id = useId();
  const pressed = useActiveLabelStore((state) => state.activeId === id);
  const pressTimer = useRef<number | undefined>(undefined);
  const hideTimer = useRef<number | undefined>(undefined);
  const longPressed = useRef(false);

  useEffect(
    () => () => {
      window.clearTimeout(pressTimer.current);
      window.clearTimeout(hideTimer.current);
      hideLabel(id);
    },
    [id],
  );

  const show = () => {
    window.clearTimeout(hideTimer.current);
    useActiveLabelStore.setState({ activeId: id });
    hideTimer.current = window.setTimeout(() => hideLabel(id), LABEL_LINGER_MS);
  };

  const hide = () => {
    window.clearTimeout(hideTimer.current);
    hideLabel(id);
  };

  const release = () => {
    window.clearTimeout(pressTimer.current);
    if (longPressed.current && useActiveLabelStore.getState().activeId === id) show();
  };

  /** Toggles the label on a tap, for something that does nothing else when tapped. */
  const toggle = () => (pressed ? hide() : show());

  return {
    pressed,
    toggle,
    handlers: {
      onPointerEnter: (event: PointerEvent) => {
        if (event.pointerType === 'mouse') show();
      },
      onPointerDown: (event: PointerEvent) => {
        longPressed.current = false;
        if (event.pointerType !== 'touch') return;
        window.clearTimeout(pressTimer.current);
        pressTimer.current = window.setTimeout(() => {
          longPressed.current = true;
          show();
        }, PRESS_MS);
      },
      onPointerUp: release,
      onPointerLeave: (event: PointerEvent) => {
        if (event.pointerType === 'mouse') hide();
        else release();
      },
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
