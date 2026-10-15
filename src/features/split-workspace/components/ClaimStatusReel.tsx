import type { ReactNode } from 'react';
import { cn } from '@shared/utils/cn';
import { BottomNavStatus } from './BottomNav';
import { CheckIcon } from './shared/CheckIcon';

interface Props {
  label: string;
  value: ReactNode;
  complete: boolean;
}

export function ClaimStatusReel({ label, value, complete }: Props) {
  return (
    <div data-testid="claim-status-reel" className="@container h-11 min-w-0 overflow-hidden">
      <div
        className={cn(
          'h-22',
          complete && 'motion-safe:animate-status-reel motion-reduce:-translate-y-1/2',
        )}
      >
        <div
          data-testid="claim-owes-panel"
          aria-hidden={complete}
          className="flex h-11 flex-col justify-center"
        >
          <BottomNavStatus label={label} value={value} />
        </div>
        <div
          role={complete ? 'status' : undefined}
          aria-hidden={!complete}
          className="grid h-11 grid-cols-[1.25rem_1fr] content-center items-center gap-x-1 @min-[120px]:flex @min-[120px]:gap-2"
        >
          {complete && (
            <>
              <span
                aria-hidden
                className="relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary-container/15 text-secondary-container motion-safe:animate-pop-in motion-safe:[animation-delay:240ms] @min-[120px]:h-7 @min-[120px]:w-7"
              >
                <CheckIcon className="h-3 w-3 @min-[120px]:h-4 @min-[120px]:w-4" />
                <span className="material-symbols-outlined absolute -top-1 -right-1 hidden text-xs motion-safe:block motion-safe:animate-status-sparkle">
                  auto_awesome
                </span>
                <span className="material-symbols-outlined absolute -bottom-1 -left-1 hidden text-[10px] motion-safe:block motion-safe:animate-status-sparkle motion-safe:[animation-delay:360ms]">
                  star
                </span>
              </span>
              <span
                data-testid="claim-all-assigned"
                className="contents text-[10px] leading-tight font-bold text-white @min-[64px]:text-xs @min-[120px]:block @min-[120px]:text-sm"
              >
                <span>All</span> <span className="col-span-2 @min-[120px]:inline">assigned</span>
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
