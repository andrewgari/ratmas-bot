import { DateTime } from 'luxon';

export interface RatmasScheduleInput {
  startDate: string;
  endDate: string;
  revealDate: string;
  purchaseDeadline: string;
}

export interface RatmasSchedule {
  eventStartDate: Date;
  eventEndDate: Date;
  revealDate: Date;
  purchaseDeadline: Date;
}

/**
 * Converts a Date object to Discord timestamp markdown format
 * @param date - The date to format
 * @param style - Discord timestamp style (t=short time, T=long time, d=short date, D=long date, f=short datetime, F=long datetime, R=relative)
 * @returns Discord timestamp markdown string
 */
export function toDiscordTimestamp(date: Date, style: 't' | 'T' | 'd' | 'D' | 'f' | 'F' | 'R' = 'D'): string {
  const timestamp = Math.floor(date.getTime() / 1000);
  return `<t:${timestamp}:${style}>`;
}

export function parseRatmasSchedule(input: RatmasScheduleInput): RatmasSchedule {
  const eventStart = parseDateFieldUTC(input.startDate, 'Start date', 'start');
  const eventEnd = parseDateFieldUTC(input.endDate, 'End date', 'end');
  const reveal = parseDateFieldUTC(input.revealDate, 'Opening day', 'start');
  const purchaseDeadline = parseDateFieldUTC(
    input.purchaseDeadline,
    'Purchase deadline',
    'end'
  );

  return {
    eventStartDate: eventStart.toJSDate(),
    eventEndDate: eventEnd.toJSDate(),
    revealDate: reveal.toJSDate(),
    purchaseDeadline: purchaseDeadline.toJSDate(),
  };
}

export function calculateAssignmentAnnouncementDate(eventStartDate: Date): string {
  const assignmentDate = DateTime.fromJSDate(eventStartDate, { zone: 'utc' })
    .plus({ days: 5 });

  return toDiscordTimestamp(assignmentDate.toJSDate(), 'D');
}

function parseDateFieldUTC(
  value: string,
  label: string,
  boundary: 'start' | 'end'
): DateTime {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${label} is required.`);
  }

  const parsed = DateTime.fromISO(trimmed, { zone: 'utc' });
  if (!parsed.isValid) {
    throw new Error(`${label} must be in YYYY-MM-DD format.`);
  }

  return boundary === 'end' ? parsed.endOf('day') : parsed.startOf('day');
}
