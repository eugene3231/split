import type { LocalDate } from '@features/group-ledger/domain/types';

/** "Today", "Yesterday", "Mon 17 Nov", or "Mon 17 Nov 2025" in another year. */
export function dateLabel(date: LocalDate, today: LocalDate): string {
  if (date === today) return 'Today';
  if (date === shiftDays(today, -1)) return 'Yesterday';
  const day = parseLocal(date);
  const sameYear = date.slice(0, 4) === today.slice(0, 4);
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
    .format(day)
    .replace(',', '');
}

/** "just now", "5 min ago", "2 h ago", "3 days ago" from an ISO time. */
export function timeAgo(iso: string, now: Date): string {
  const seconds = Math.max(0, (now.getTime() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
  const days = Math.floor(seconds / 86400);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

function parseLocal(date: LocalDate): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function shiftDays(date: LocalDate, days: number): string {
  const shifted = parseLocal(date);
  shifted.setDate(shifted.getDate() + days);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${shifted.getFullYear()}-${pad(shifted.getMonth() + 1)}-${pad(shifted.getDate())}`;
}
