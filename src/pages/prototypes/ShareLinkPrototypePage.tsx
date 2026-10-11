import { ShareLinkPrototype } from '@features/share-link';

interface ShareLinkPrototypePageProps {
  hash: string;
}

export function ShareLinkPrototypePage({ hash }: ShareLinkPrototypePageProps) {
  const query = hash.split('?')[1] ?? '';
  return (
    <main className="font-body min-h-screen bg-surface text-on-surface">
      <ShareLinkPrototype encodedReceipt={new URLSearchParams(query).get('d')} />
    </main>
  );
}
