import { createId } from '@shared/logic/core/id';
import type {
  EntryId,
  GroupId,
  InviteCode,
  LocalDate,
  MemberId,
  OpId,
  UserId,
} from '@features/group-ledger/domain/types';

// The only casts into the branded types. Text from outside (a URL, storage, the server) goes
// through one of these once it has been checked; everything else gets its ids from the makers.

export const asGroupId = (value: string) => value as GroupId;
export const asMemberId = (value: string) => value as MemberId;
export const asEntryId = (value: string) => value as EntryId;
export const asOpId = (value: string) => value as OpId;
export const asUserId = (value: string) => value as UserId;
export const asInviteCode = (value: string) => value as InviteCode;
export const asLocalDate = (value: string) => value as LocalDate;

export const newGroupId = () => asGroupId(createId());
export const newMemberId = () => asMemberId(createId());
export const newEntryId = () => asEntryId(createId());
export const newOpId = () => asOpId(createId());

export function newInviteCode(): InviteCode {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return asInviteCode(
    btoa(String.fromCharCode(...bytes))
      .replaceAll('+', '-')
      .replaceAll('/', '_')
      .replaceAll('=', ''),
  );
}

export function todayLocalDate(now: Date = new Date()): LocalDate {
  const pad = (value: number) => String(value).padStart(2, '0');
  return asLocalDate(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
}

/** The keys of a record keyed by member, which `Object.keys` would hand back as plain strings. */
export function memberIdsOf(record: Record<MemberId, unknown>): MemberId[] {
  return Object.keys(record) as MemberId[];
}

/** Orders ids and dates by code unit, not by locale, so every phone sorts them the same way. */
export function byCodeUnit(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
