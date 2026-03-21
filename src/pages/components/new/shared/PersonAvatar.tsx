import { getPersonColor } from '@shared/utils/personColors'

interface Props {
  name: string
  colorIndex: number
  size?: 'sm' | 'md'
}

export function PersonAvatar({ name, colorIndex, size = 'md' }: Props) {
  const color = getPersonColor(colorIndex)
  const initial = name.trim().charAt(0).toUpperCase() || '?'
  const sizeClasses = size === 'sm' ? 'w-6 h-6 text-xs' : 'w-10 h-10 text-sm'

  return (
    <div
      className={`${sizeClasses} rounded-full flex items-center justify-center font-bold flex-shrink-0`}
      style={{ backgroundColor: color.avatarBg, color: color.avatarText }}
    >
      {initial}
    </div>
  )
}
