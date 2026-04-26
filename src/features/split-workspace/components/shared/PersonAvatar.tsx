import { getPersonColor } from '@shared/utils/personColors';

interface Props {
  name: string;
  colorIndex: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  selected?: boolean;
  dimmed?: boolean;
}

export function PersonAvatar({ name, colorIndex, size = 'md', selected, dimmed }: Props) {
  const color = getPersonColor(colorIndex);
  const initial = name.trim().charAt(0).toUpperCase() || '?';

  const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-14 h-14 text-lg',
  }[size];

  const ringStyle = selected
    ? { boxShadow: `0 0 0 2.5px #FFFCF7, 0 0 0 4.5px ${color.avatarBg}` }
    : {};

  const bgColor = dimmed ? '#E8E2D4' : color.avatarBg;
  const textColor = dimmed ? '#5C5A55' : color.avatarText;

  return (
    <div
      className={`${sizeClasses} flex flex-shrink-0 items-center justify-center rounded-full font-display font-semibold transition-all`}
      style={{ backgroundColor: bgColor, color: textColor, ...ringStyle }}
    >
      {initial}
    </div>
  );
}
