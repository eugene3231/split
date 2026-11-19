import type { ReactNode } from 'react';
import { Dialog } from 'radix-ui';
import { IconButton } from './IconButton';

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
}

export function Sheet({ open, onOpenChange, title, description, children }: SheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-on-surface/40 backdrop-blur-sm motion-safe:animate-fade-in" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] overflow-y-auto rounded-t-card border border-surface-container-highest bg-surface-container-lowest pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-12px_40px_-12px_rgba(23,28,39,0.25)] motion-safe:animate-rise-in sm:inset-x-auto sm:top-1/2 sm:left-1/2 sm:w-[calc(100%-2rem)] sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-card sm:pb-6">
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-surface-container-highest sm:hidden" />
          <div className="flex items-start justify-between gap-4 px-5 pt-3 sm:px-6 sm:pt-5">
            <div className="min-w-0 pt-1.5">
              <Dialog.Title className="font-headline text-xl font-bold text-on-surface">
                {title}
              </Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-sm text-on-surface-variant">
                  {description}
                </Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              <IconButton label="Close" icon="close" className="-mr-2" />
            </Dialog.Close>
          </div>
          <div className="px-5 pt-4 sm:px-6">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
