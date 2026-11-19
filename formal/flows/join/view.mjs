export const title = 'A friend opens my invite link and joins';

const screens = {
  link: 'Opens the invite link',
  joining: 'Joining the group',
  'needs-signal': 'Joining needs a signal',
  'bad-link': "This link doesn't open a group",
  'couldnt-join': "Couldn't join just now",
  home: 'Back on their groups',
  opening: 'Opening the group',
  'waiting-signal': 'Waiting for a signal',
  'who-are-you': 'Who are you?',
};

export const state = (v) => {
  if (v.screen !== 'in-group') return screens[v.screen];
  if (v.myName === 'ana-sending') return 'In the group as Ana, not yet sent';
  if (v.myName === 'ana') return 'In the group as Ana';
  return 'In the group under a new name';
};

export const group = (v) => {
  if (['link', 'joining'].includes(v.screen)) return 'joining';
  if (['needs-signal', 'bad-link', 'couldnt-join', 'home'].includes(v.screen)) return 'stuck';
  if (['opening', 'waiting-signal', 'who-are-you'].includes(v.screen)) return 'joined';
  return 'in';
};

export const colors = { joining: 'blue', stuck: 'orange', joined: 'teal', in: 'purple' };

export const step = (action, from, to) => {
  switch (action) {
    case 'YouOpenTheLink':
      return from.screen === 'home' ? 'they open the link again' : 'they tap the link';
    case 'JoinNoSignal':
      return 'there is no signal';
    case 'JoinNotFound':
      return 'no group opens with this code [maker still offline, or link cut short]';
    case 'JoinServerFails':
      return 'the server fails';
    case 'Joined':
      return 'they are in';
    case 'YouTryAgain':
      return 'they tap Try again';
    case 'YouGoHome':
      return 'they go to their groups';
    case 'SignalDrops':
      return 'the signal drops';
    case 'SignalComesBack':
      return 'the signal comes back';
    case 'GroupArrives':
      return 'the group arrives';
    case 'YouPickAna':
      return 'they tap Ana [nobody has her yet]';
    case 'ClaimArrives':
      return to.myName === 'ana' ? 'the server takes it' : 'a friend had picked Ana first';
    case 'YouAddYourName':
      return "they tap I'm not on the list and add a name";
    case 'Done':
      return 'done';
    default:
      return null;
  }
};
