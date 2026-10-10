import { cn } from '@shared/utils/cn';
import { personColor } from '@shared/utils/personColors';

interface Props {
  name: string;
  colorIndex: number;
  size?: 'sm' | 'md';
  className?: string;
}

export function PersonAvatar({ name, colorIndex, size = 'md', className }: Props) {
  const initial = name.trim().charAt(0).toUpperCase() || '?';

  return (
    <div
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-bold text-white select-none',
        size === 'sm' ? 'h-6 w-6 text-xs' : 'h-10 w-10 text-sm',
        className,
      )}
      style={{ backgroundColor: personColor(colorIndex) }}
    >
      {initial}
    </div>
  );
}
