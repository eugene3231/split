export const title = 'I keep my groups with my email';

export const state = (v) => {
  switch (v.step) {
    case 'anonymous':
      return v.name === 'anon' ? 'On this phone only, name picked' : 'On this phone only';
    case 'sending':
      return 'Sending the code';
    case 'code-sent':
      return 'Code sent to the email';
    case 'checking':
      return 'Checking the code';
    case 'finding':
      return 'Signed in, groups coming back';
    case 'linked':
      return v.name === 'orphan'
        ? 'Signed in, own name shows as Taken'
        : 'Signed in with the email';
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
      return "the code can't be sent";
    case 'CodeSent':
      return 'a 6-digit code is emailed';
    case 'YouCancel':
      return 'you cancel';
    case 'YouEnterTheCode':
      return 'you enter the code';
    case 'WrongCode':
      return 'the code is wrong';
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
