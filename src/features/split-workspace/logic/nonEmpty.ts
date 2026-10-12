export type NonEmptyArray<T> = [T, ...T[]];

export function isNonEmpty<T>(values: T[]): values is NonEmptyArray<T> {
  return values.length > 0;
}

/** `Array.prototype.map` forgets that a non-empty array stays non-empty. */
export function mapNonEmpty<T, U>(
  values: NonEmptyArray<T>,
  transform: (value: T, index: number) => U,
): NonEmptyArray<U> {
  const [first, ...rest] = values;
  return [transform(first, 0), ...rest.map((value, index) => transform(value, index + 1))];
}
