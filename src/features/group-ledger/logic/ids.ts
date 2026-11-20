import type {
  EntryId,
  GroupId,
  InviteCode,
  LocalDate,
  MemberId,
  OpId,
  UserId,
} from '@features/group-ledger/domain/types';

export const asGroupId = (value: string) => value as GroupId;
export const asMemberId = (value: string) => value as MemberId;
export const asEntryId = (value: string) => value as EntryId;
export const asOpId = (value: string) => value as OpId;
export const asUserId = (value: string) => value as UserId;
export const asInviteCode = (value: string) => value as InviteCode;
export const asLocalDate = (value: string) => value as LocalDate;

/**
 * A lowercase version 4 UUID, which the server's `uuid` columns require. Built from
 * `getRandomValues` because `crypto.randomUUID` is missing on plain-http pages, such as the dev
 * server opened on a phone over the LAN.
 */
export function newUuid(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export const newGroupId = () => asGroupId(newUuid());
export const newMemberId = () => asMemberId(newUuid());
export const newEntryId = () => asEntryId(newUuid());
export const newOpId = () => asOpId(newUuid());

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
