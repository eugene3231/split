type Vars = Record<string, unknown>;

export const title = 'I add an expense, maybe offline, and it reaches my friends';

export function state(v: Vars): string {
  if (v.phone === 'none') return 'Not added yet';
  if (v.phone === 'dropped') return 'Refused as too large, shown to you';
  if (v.phone === 'pending') {
    if (v.engine === 'sending') return 'Sending';
    if (v.engine === 'stuck') return 'Kept on this phone, server failing';
    if (v.signal === 'off') return 'Kept on this phone, no signal';
    return 'Kept on this phone, retrying soon';
  }
  if (v.replaced) return "A friend's later edit replaced it";
  if (v.friend === 'seen') return 'Your friends see it';
  return 'Synced';
}

export function group(v: Vars): string {
  if (v.phone === 'pending') return 'waiting';
  if (v.phone === 'dropped' || v.replaced) return 'attention';
  if (v.phone === 'none') return 'start';
  return 'done';
}

export const colors = { start: 'blue', waiting: 'orange', attention: 'pink', done: 'teal' };

export function step(action: string, from: Vars, to: Vars): string | null {
  switch (action) {
    case 'YouAdd':
      return 'you save an expense';
    case 'SignalDrops':
      return from.phone === 'pending' ? 'the signal drops' : null;
    case 'SignalBack':
      return 'the signal comes back';
    case 'NoConnection':
      return 'no connection';
    case 'RetryTimer':
      return 'the retry timer fires';
    case 'ReplyLost':
      return 'the server stores it but the reply is lost';
    case 'Synced':
      return 'the server takes it';
    case 'Refused':
      return 'the server refuses it [too large]';
    case 'ServerFails':
      return 'the server fails';
    case 'FriendGetsIt':
      return to.phone === 'confirmed' ? "a friend's phone pulls it" : null;
    case 'FriendsEditWins':
      return "a friend's later edit lands";
    case 'YouRestore':
      return 'you tap restore';
    default:
      return null;
  }
}
