import { DateTime } from 'luxon';

export interface RatmasScheduleInput {
  startDate: string;
  endDate: string;
  revealDate: string;
  purchaseDeadline: string;
  timezone?: string;
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
export function toDiscordTimestamp(
  date: Date,
  style: 't' | 'T' | 'd' | 'D' | 'f' | 'F' | 'R' = 'D'
): string {
  const timestamp = Math.floor(date.getTime() / 1000);
  return `<t:${timestamp}:${style}>`;
}

export function parseRatmasSchedule(input: RatmasScheduleInput): RatmasSchedule {
  const timezone = input.timezone || 'UTC';

  // Validate timezone
  const testDateTime = DateTime.now().setZone(timezone);
  if (!testDateTime.isValid || testDateTime.invalidReason) {
    throw new Error(
      `Invalid timezone: ${timezone}. Please use a valid IANA timezone (e.g., America/New_York, Europe/London, UTC).`
    );
  }

  const eventStart = parseDateField(input.startDate, 'Start date', 'start', timezone);
  const eventEnd = parseDateField(input.endDate, 'End date', 'end', timezone);
  const reveal = parseDateField(input.revealDate, 'Opening day', 'start', timezone);
  const purchaseDeadline = parseDateField(
    input.purchaseDeadline,
    'Purchase deadline',
    'end',
    timezone
  );

  return {
    eventStartDate: eventStart.toJSDate(),
    eventEndDate: eventEnd.toJSDate(),
    revealDate: reveal.toJSDate(),
    purchaseDeadline: purchaseDeadline.toJSDate(),
  };
}

export function calculateAssignmentAnnouncementDate(eventStartDate: Date): string {
  const assignmentDate = DateTime.fromJSDate(eventStartDate, { zone: 'utc' }).plus({ days: 5 });

  return toDiscordTimestamp(assignmentDate.toJSDate(), 'D');
}

function parseDateField(
  value: string,
  label: string,
  boundary: 'start' | 'end',
  timezone: string
): DateTime {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${label} is required.`);
  }

  // Parse in the user's timezone, then convert to UTC
  const parsed = DateTime.fromISO(trimmed, { zone: timezone });
  if (!parsed.isValid) {
    throw new Error(`${label} must be in YYYY-MM-DD format.`);
  }

  // Apply boundary (start or end of day) in user's timezone, then convert to UTC
  const withBoundary = boundary === 'end' ? parsed.endOf('day') : parsed.startOf('day');
  return withBoundary.toUTC();
}
