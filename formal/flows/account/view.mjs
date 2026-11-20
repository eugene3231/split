export const title = 'I keep my groups with my email';

export const state = (v) => {
  switch (v.step) {
    case 'anonymous':
      return v.name === 'anon' ? 'On this phone only, name picked' : 'On this phone only';
    case 'sending':
      return 'Sending the code';
    case 'code-sent':
      return 'Code sent to the email';
    case 'releasing':
      return 'Handing your name over';
    case 'checking':
      if (v.name === 'released') return 'Checking the code, name handed over';
      if (v.mode === 'sign-in' && v.name === 'anon')
        return 'Checking the code, a name picked meanwhile';
      return 'Checking the code';
    case 'finding':
      return 'Signed in, groups and name coming back';
    case 'linked':
      if (v.name === 'orphan') return 'Signed in, own name shows as Taken';
      return 'Signed in with the email';
  }
};

export const group = (v) =>
  v.step === 'anonymous' ? 'phone' : v.step === 'linked' || v.step === 'finding' ? 'email' : 'code';

export const colors = { phone: 'tan', code: 'blue', email: 'teal' };

export const step = (action, from, to) => {
  switch (action) {
    case 'YouPickYourName':
      return from.step === 'anonymous' ? 'you pick your name in a group' : null;
    case 'YouEnterEmail':
      return 'you tap Keep my groups and enter your email';
    case 'CodeNotSent':
      return null;
    case 'CodeSent':
      return 'a 6-digit code is emailed';
    case 'YouCancel':
      return null;
    case 'YouEnterTheCode':
      return 'you enter the code';
    case 'ReleaseReachesServer':
      return 'the server has it';
    case 'ReleaseNoSignal':
      return 'no signal: your name is taken back, try again';
    case 'YouPickInAnotherTab':
      return 'you pick a name in another tab';
    case 'WrongCode':
      return from.name === 'anon' && from.mode === 'sign-in' ? null : 'the code is wrong';
    case 'CodeAccepted':
      if (from.mode === 'link') return 'the code is right [new email: it joins this phone]';
      return 'the code is right [email has an account: the phone switches to it]';
    case 'GroupsFound':
      return "the account's groups come back";
    case 'YouSignOut':
      return 'you sign out';
    default:
      return null;
  }
};
