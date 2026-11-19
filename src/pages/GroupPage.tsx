import { Link } from '@shared/routing';

/** Every group screen until groups are built. */
export function GroupPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center gap-6 bg-surface px-6 font-body text-on-surface">
      <h1 className="font-headline text-3xl font-bold tracking-tight">Groups are coming</h1>
      <p className="text-on-surface-variant">This link will open a group once groups are ready.</p>
      <Link to={{ kind: 'home' }} className="font-semibold text-primary underline">
        Back to Split
      </Link>
    </main>
  );
}
