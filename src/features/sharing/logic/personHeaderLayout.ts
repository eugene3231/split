interface HeaderLayoutOptions {
  name: string;
  nameWidth: number;
  conversion: boolean;
  measure: (text: string) => number;
}

export function personHeaderLayout({ name, nameWidth, conversion, measure }: HeaderLayoutOptions) {
  const lines: string[] = [];
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  let rest = Array.from(segmenter.segment(name.trim()), ({ segment }) => segment);
  while (rest.length > 0) {
    let length = 1;
    while (length < rest.length && measure(rest.slice(0, length + 1).join('')) <= nameWidth)
      length += 1;
    if (length < rest.length) {
      const space = rest.lastIndexOf(' ', length);
      if (space > 0) length = space;
    }
    lines.push(rest.slice(0, length).join(''));
    rest = rest.slice(length);
    while (rest.length > 0 && rest[0].trim() === '') rest.shift();
  }
  const mainHeight = Math.max(64, 28 + lines.length * 30);
  return { lines, mainHeight, height: mainHeight + (conversion ? 30 : 0) };
}
