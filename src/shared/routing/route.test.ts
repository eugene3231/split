import { describe, expect, it } from 'vitest';
import { href, parseRoute, type Route } from './route';

function at(address: string): Route {
  const url = new URL(address, 'https://split.test');
  return parseRoute({ pathname: url.pathname, hash: url.hash });
}

const everyRoute: Route[] = [
  { kind: 'home' },
  { kind: 'split' },
  { kind: 'join', code: 'k7Qp-x2' },
  { kind: 'group', groupId: 'g1' },
  { kind: 'newExpense', groupId: 'g1' },
  { kind: 'newReceipt', groupId: 'g1' },
  { kind: 'entry', groupId: 'g1', entryId: 'e1' },
  { kind: 'settle', groupId: 'g1' },
  { kind: 'activity', groupId: 'g1' },
];

describe('routes', () => {
  it.each(everyRoute)('reads back $kind from its own address', (route) => {
    expect(at(href(route))).toEqual(route);
  });

  it('writes the addresses the design names', () => {
    expect(everyRoute.map(href)).toEqual([
      '/',
      '/split',
      '/join#k7Qp-x2',
      '/g/g1',
      '/g/g1/new',
      '/g/g1/receipt',
      '/g/g1/e/e1',
      '/g/g1/settle',
      '/g/g1/activity',
    ]);
  });

  it('keeps ids and codes with reserved characters intact', () => {
    const group: Route = { kind: 'entry', groupId: 'a/b c', entryId: 'é#?' };
    const join: Route = { kind: 'join', code: 'a b#c' };

    expect(at(href(group))).toEqual(group);
    expect(at(href(join))).toEqual(join);
  });

  it('ignores a trailing slash', () => {
    expect(at('/g/g1/settle/')).toEqual({ kind: 'settle', groupId: 'g1' });
    expect(at('/split/')).toEqual({ kind: 'split' });
  });

  it.each([
    '/nowhere',
    '/split/extra',
    '/join',
    '/join#',
    '/g',
    '/g/g1/unknown',
    '/g/g1/new/e1',
    '/g/g1/e',
    '/g/g1/receipt/e1',
    '/g/%E0%A4%A',
  ])('opens home for %s', (address) => {
    expect(at(address)).toEqual({ kind: 'home' });
  });
});
