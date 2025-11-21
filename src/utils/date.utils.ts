import { DateTime } from 'luxon';

export interface RatmasScheduleInput {
  startDate: string;
  endDate: string;
  revealDate: string;
  purchaseDeadline: string;
  timezone: string;
}

export interface RatmasSchedule {
  eventStartDate: Date;
  eventEndDate: Date;
  revealDate: Date;
  purchaseDeadline: Date;
  timezone: string;
}

export function validateTimezone(timezone: string): boolean {
  if (!timezone.trim()) {
    return false;
  }

  return DateTime.now().setZone(timezone).isValid;
}

export function parseRatmasSchedule(input: RatmasScheduleInput): RatmasSchedule {
  const timezone = input.timezone.trim();
  if (!validateTimezone(timezone)) {
    throw new Error('Please provide a valid IANA timezone (e.g., America/Los_Angeles).');
  }

  const eventStart = parseDateField(input.startDate, timezone, 'Start date', 'start');
  const eventEnd = parseDateField(input.endDate, timezone, 'End date', 'end');
  const reveal = parseDateField(input.revealDate, timezone, 'Opening day', 'start');
  const purchaseDeadline = parseDateField(
    input.purchaseDeadline,
    timezone,
    'Purchase deadline',
    'end'
  );

  return {
    eventStartDate: eventStart.toUTC().toJSDate(),
    eventEndDate: eventEnd.toUTC().toJSDate(),
    revealDate: reveal.toUTC().toJSDate(),
    purchaseDeadline: purchaseDeadline.toUTC().toJSDate(),
    timezone,
  };
}

export function formatDateForTimezone(date: Date, timezone: string): string {
  return DateTime.fromJSDate(date, { zone: 'utc' })
    .setZone(timezone)
    .toLocaleString(DateTime.DATE_HUGE);
}

export function calculateAssignmentAnnouncementDate(
  eventStartDate: Date,
  timezone: string
): string {
  const assignmentDate = DateTime.fromJSDate(eventStartDate, { zone: 'utc' })
    .setZone(timezone)
    .plus({ days: 5 });

  return assignmentDate.toLocaleString(DateTime.DATE_HUGE);
}

function parseDateField(
  value: string,
  timezone: string,
  label: string,
  boundary: 'start' | 'end'
): DateTime {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${label} is required.`);
  }

  const parsed = DateTime.fromISO(trimmed, { zone: timezone });
  if (!parsed.isValid) {
    throw new Error(`${label} must be in YYYY-MM-DD format.`);
  }

  return boundary === 'end' ? parsed.endOf('day') : parsed.startOf('day');
}
