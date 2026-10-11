interface Props {
  rows: number;
}

/** A bulleted list whose length shows how many items a card lists. */
export function ItemListIcon({ rows }: Props) {
  const gap = rows > 2 ? 4.5 : 5;
  const top = 12 - ((rows - 1) * gap) / 2;

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="currentColor">
      {Array.from({ length: rows }, (_, row) => {
        const y = top + row * gap;
        return (
          <g key={row}>
            <circle cx="5" cy={y} r="1.3" />
            <rect x="8.5" y={y - 1} width="11.5" height="2" rx="1" />
          </g>
        );
      })}
    </svg>
  );
}
