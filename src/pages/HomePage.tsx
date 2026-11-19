import { Link } from '@shared/routing';

export function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center gap-6 bg-surface px-6 font-body text-on-surface">
      <h1 className="font-headline text-4xl font-bold tracking-tight text-primary">Split</h1>
      <p className="text-on-surface-variant">
        Groups that keep a running tab are coming. For now, split a bill in one go.
      </p>
      <Link
        to={{ kind: 'split' }}
        className="flex h-12 items-center justify-center rounded-2xl bg-primary px-5 font-semibold text-on-primary transition-colors hover:bg-primary-container"
      >
        Quick split
      </Link>
    </main>
  );
}
