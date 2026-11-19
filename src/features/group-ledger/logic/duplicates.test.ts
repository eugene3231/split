import { describe, expect, it } from 'vitest';
import { likelyDuplicates } from './duplicates';
import { ana, ben, cat, dan, makeMember } from './testHelpers';

describe('likelyDuplicates', () => {
  it('pairs members whose names match once case and outer spaces are ignored', () => {
    const members = [
      makeMember(ana, { name: 'Ben' }),
      makeMember(ben, { name: ' ben ' }),
      makeMember(cat, { name: 'Cat' }),
    ];

    expect(likelyDuplicates(members)).toEqual([['ana', 'ben']]);
  });

  it('pairs every two of three members with one name, in the order they were added', () => {
    const members = [ana, ben, cat].map((id) => makeMember(id, { name: 'Sam' }));

    expect(likelyDuplicates(members)).toEqual([
      ['ana', 'ben'],
      ['ana', 'cat'],
      ['ben', 'cat'],
    ]);
  });

  it('leaves out archived members and members with no name', () => {
    const members = [
      makeMember(ana, { name: 'Sam' }),
      makeMember(ben, { name: 'Sam', archived: true }),
      makeMember(cat, { name: '  ' }),
      makeMember(dan, { name: '' }),
    ];

    expect(likelyDuplicates(members)).toEqual([]);
  });
});
