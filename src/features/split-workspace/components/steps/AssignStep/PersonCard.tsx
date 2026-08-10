import type { ReactNode } from 'react';
import { PersonAvatar } from '@features/split-workspace/components/shared/PersonAvatar';
import { cn } from '@shared/utils/cn';

type PersonCardProps = {
  id: string;
  name: string;
  colorIndex: number;
  isSelected: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
  status: ReactNode;
  control: ReactNode;
};

export function PersonCard({
  id,
  name,
  colorIndex,
  isSelected,
  onClick,
  onDoubleClick,
  status,
  control,
}: PersonCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      data-testid={`assign-person-btn-${id}`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onClick();
      }}
      className={cn(
        'flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all',
        isSelected
          ? 'border-2 border-secondary bg-surface-container-lowest shadow-[0_4px_14px_rgba(27,109,36,0.2)]'
          : 'border-2 border-transparent bg-surface-container-low hover:bg-surface-container',
      )}
    >
      <PersonAvatar name={name} colorIndex={colorIndex} />
      <div className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-on-surface">{name}</span>
        {status && (
          <span
            className={cn(
              'text-sm font-semibold',
              isSelected ? 'text-secondary' : 'text-on-surface-variant',
            )}
          >
            {status}
          </span>
        )}
      </div>
      {control}
    </div>
  );
}
