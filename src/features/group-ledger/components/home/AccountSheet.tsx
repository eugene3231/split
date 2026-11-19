import { useState } from 'react';
import { FAKE_EMAIL_CODE } from '@features/group-ledger/backend/fakeBackend';
import { supabaseConfig } from '@features/group-ledger/backend/createBackend';
import type { BackendFailure } from '@features/group-ledger/backend/port';
import { useAccount } from '@features/group-ledger/hooks/useAccount';
import { Button } from '@features/group-ledger/components/ui/Button';
import { Icon } from '@features/group-ledger/components/ui/IconButton';
import { Sheet } from '@features/group-ledger/components/ui/Sheet';
import { TextField } from '@features/group-ledger/components/ui/TextField';

interface AccountSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AccountSheet({ open, onOpenChange }: AccountSheetProps) {
  const account = useAccount();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const { session, emailSignIn: flow, failure } = account;
  const linkedEmail = session?.account.kind === 'linked' ? session.account.email : null;
  const waitingForCode = flow.step === 'code-sent' || flow.step === 'verifying';

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) account.cancelEmailSignIn();
        onOpenChange(next);
      }}
      title={linkedEmail ? 'Your account' : 'Keep your groups'}
      description={
        linkedEmail
          ? 'Your groups come back when you sign in on another phone.'
          : "You don't need an account. Add your email so you keep your groups if you lose or change your phone."
      }
    >
      {linkedEmail ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-2xl bg-surface-container p-4">
            <Icon name="verified_user" className="text-secondary" />
            <div className="min-w-0">
              <p className="text-xs text-on-surface-variant">Signed in as</p>
              <p className="truncate font-semibold">{linkedEmail}</p>
            </div>
          </div>
          <Button variant="secondary" className="w-full" onClick={() => void account.signOut()}>
            Sign out
          </Button>
          <FailureNote failure={failure} />
        </div>
      ) : waitingForCode ? (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void account.verifyEmailCode(code.trim());
          }}
        >
          <TextField
            label={`The 6-digit code we sent to ${flow.email}`}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
            placeholder="123456"
            hint={
              supabaseConfig() === null
                ? `On this test server the code is ${FAKE_EMAIL_CODE}.`
                : undefined
            }
          />
          <FailureNote failure={failure} />
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={code.length !== 6 || flow.step === 'verifying'}
          >
            {flow.step === 'verifying' ? 'Checking…' : 'Confirm'}
          </Button>
          <Button variant="ghost" className="w-full" onClick={account.cancelEmailSignIn}>
            Use another email
          </Button>
        </form>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            setCode('');
            void account.startEmailSignIn(email.trim());
          }}
        >
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
          <FailureNote failure={failure} />
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={!email.includes('@') || flow.step === 'sending'}
          >
            {flow.step === 'sending' ? 'Sending…' : 'Send me a code'}
          </Button>
        </form>
      )}
    </Sheet>
  );
}

function FailureNote({ failure }: { failure: BackendFailure | null }) {
  if (failure === null) return null;
  const text =
    failure.kind === 'offline'
      ? "You're offline. Try again with a signal."
      : failure.kind === 'failed'
        ? failure.message
        : 'Something went wrong. Try again.';
  return (
    <p
      role="alert"
      className="rounded-xl bg-error-container px-3 py-2 text-sm text-on-error-container"
    >
      {text}
    </p>
  );
}
