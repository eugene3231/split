import { useSettleUpTrip } from '../hooks/useSettleUpTrip';
import { SAMPLE_PAYERS } from '../logic/sampleTrip';
import { SettleUpBoard } from './SettleUpBoard';

export function SettleUpPrototype() {
  const { people, receipts, isSample } = useSettleUpTrip();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-6 pb-24 md:px-8 md:pt-10">
      <a href="#" className="text-sm font-semibold text-primary">
        ← Back to Split
      </a>
      <h1 className="font-headline mt-4 text-3xl font-extrabold tracking-tight text-on-surface md:text-5xl">
        Settle up
      </h1>
      <p className="mt-1 mb-6 text-on-surface-variant">
        Mark who paid each receipt and get the fewest transfers to square everyone up.
      </p>
      {isSample && (
        <p className="mb-6 rounded-xl bg-primary-fixed px-4 py-3 text-sm text-on-primary-fixed">
          Showing a sample trip. Split a few receipts in the app and come back to settle them.
        </p>
      )}
      <SettleUpBoard
        key={isSample ? 'sample' : 'trip'}
        people={people}
        receipts={receipts}
        initialPayers={isSample ? SAMPLE_PAYERS : {}}
      />
    </div>
  );
}
