import { describe, expect, it } from 'vitest';
import { resolveTipGuidance, selectedTipPercent } from './tipGuidance';
import {
  amountCharge,
  disabledCharge,
  percentCharge,
} from '../../../tests/integration/testHelpers';

describe('resolveTipGuidance', () => {
  it.each([
    [1, '18'],
    [5, '18'],
    [6, '20'],
    [12, '20'],
  ])('suggests %i people start at %s%%', (partySize, suggestedPercent) => {
    expect(resolveTipGuidance({ partySize, serviceCharge: disabledCharge }).suggestedPercent).toBe(
      suggestedPercent,
    );
  });

  it('warns about a service charge before the group size', () => {
    expect(resolveTipGuidance({ partySize: 8, serviceCharge: amountCharge('12.00') })).toEqual({
      suggestedPercent: '18',
      hint: 'This receipt already has a service charge, which usually takes the place of a tip.',
    });
  });

  it('ignores a service charge that is switched on at zero', () => {
    expect(resolveTipGuidance({ partySize: 2, serviceCharge: percentCharge('0') })).toEqual({
      suggestedPercent: '18',
      hint: 'For table service in the US, 15–20% of the bill before tax is usual.',
    });
  });
});

describe('selectedTipPercent', () => {
  it.each([
    ['a preset', percentCharge('20'), '20'],
    ['a preset written with decimals', percentCharge('15.00'), '15'],
    ['another percent', percentCharge('17'), null],
    ['a fixed amount', amountCharge('20'), null],
    ['a tip that is off', { ...percentCharge('18'), enabled: false }, null],
  ])('reads %s', (_, tip, expected) => {
    expect(selectedTipPercent(tip)).toBe(expected);
  });
});
