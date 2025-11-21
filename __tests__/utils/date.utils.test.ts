import { describe, it, expect } from '@jest/globals';
import {
  parseRatmasSchedule,
  toDiscordTimestamp,
  calculateAssignmentAnnouncementDate,
} from '../../src/utils/date.utils.js';

describe('date.utils', () => {
  it('parses a valid schedule and normalises to UTC boundaries', () => {
    const schedule = parseRatmasSchedule({
      startDate: '2025-12-01',
      endDate: '2025-12-25',
      revealDate: '2025-12-26',
      purchaseDeadline: '2025-12-15',
      timezone: 'UTC',
    });

    expect(schedule.eventStartDate.toISOString()).toBe('2025-12-01T00:00:00.000Z');
    expect(schedule.eventEndDate.toISOString()).toBe('2025-12-25T23:59:59.999Z');
    expect(schedule.revealDate.toISOString()).toBe('2025-12-26T00:00:00.000Z');
    expect(schedule.purchaseDeadline.toISOString()).toBe('2025-12-15T23:59:59.999Z');
  });

  it('converts timezone dates to UTC correctly', () => {
    const schedule = parseRatmasSchedule({
      startDate: '2025-12-01',
      endDate: '2025-12-25',
      revealDate: '2025-12-26',
      purchaseDeadline: '2025-12-15',
      timezone: 'America/New_York', // EST/EDT is UTC-5/-4
    });

    // 2025-12-01 00:00:00 EST = 2025-12-01 05:00:00 UTC (EST is UTC-5)
    expect(schedule.eventStartDate.toISOString()).toBe('2025-12-01T05:00:00.000Z');
    // 2025-12-25 23:59:59.999 EST = 2025-12-26 04:59:59.999 UTC
    expect(schedule.eventEndDate.toISOString()).toBe('2025-12-26T04:59:59.999Z');
    // 2025-12-26 00:00:00 EST = 2025-12-26 05:00:00 UTC
    expect(schedule.revealDate.toISOString()).toBe('2025-12-26T05:00:00.000Z');
    // 2025-12-15 23:59:59.999 EST = 2025-12-16 04:59:59.999 UTC
    expect(schedule.purchaseDeadline.toISOString()).toBe('2025-12-16T04:59:59.999Z');
  });

  it('defaults to UTC when timezone is not provided', () => {
    const schedule = parseRatmasSchedule({
      startDate: '2025-12-01',
      endDate: '2025-12-25',
      revealDate: '2025-12-26',
      purchaseDeadline: '2025-12-15',
    });

    expect(schedule.eventStartDate.toISOString()).toBe('2025-12-01T00:00:00.000Z');
    expect(schedule.eventEndDate.toISOString()).toBe('2025-12-25T23:59:59.999Z');
  });

  it('throws when provided an invalid timezone', () => {
    expect(() =>
      parseRatmasSchedule({
        startDate: '2025-12-01',
        endDate: '2025-12-25',
        revealDate: '2025-12-26',
        purchaseDeadline: '2025-12-15',
        timezone: 'Invalid/Timezone',
      })
    ).toThrow('Invalid timezone');
  });

  it('throws when provided an invalid date', () => {
    expect(() =>
      parseRatmasSchedule({
        startDate: 'invalid-date',
        endDate: '2025-12-25',
        revealDate: '2025-12-26',
        purchaseDeadline: '2025-12-15',
        timezone: 'UTC',
      })
    ).toThrow('Start date must be in YYYY-MM-DD format');
  });

  it('converts Europe/London timezone correctly (UTC+0/+1)', () => {
    const schedule = parseRatmasSchedule({
      startDate: '2025-12-01',
      endDate: '2025-12-25',
      revealDate: '2025-12-26',
      purchaseDeadline: '2025-12-15',
      timezone: 'Europe/London', // GMT is UTC+0
    });

    // 2025-12-01 00:00:00 GMT = 2025-12-01 00:00:00 UTC
    expect(schedule.eventStartDate.toISOString()).toBe('2025-12-01T00:00:00.000Z');
    // 2025-12-25 23:59:59.999 GMT = 2025-12-25 23:59:59.999 UTC
    expect(schedule.eventEndDate.toISOString()).toBe('2025-12-25T23:59:59.999Z');
    // 2025-12-26 00:00:00 GMT = 2025-12-26 00:00:00 UTC
    expect(schedule.revealDate.toISOString()).toBe('2025-12-26T00:00:00.000Z');
    // 2025-12-15 23:59:59.999 GMT = 2025-12-15 23:59:59.999 UTC
    expect(schedule.purchaseDeadline.toISOString()).toBe('2025-12-15T23:59:59.999Z');
  });

  it('converts Asia/Tokyo timezone correctly (UTC+9)', () => {
    const schedule = parseRatmasSchedule({
      startDate: '2025-12-01',
      endDate: '2025-12-25',
      revealDate: '2025-12-26',
      purchaseDeadline: '2025-12-15',
      timezone: 'Asia/Tokyo', // JST is UTC+9
    });

    // 2025-12-01 00:00:00 JST = 2025-11-30 15:00:00 UTC
    expect(schedule.eventStartDate.toISOString()).toBe('2025-11-30T15:00:00.000Z');
    // 2025-12-25 23:59:59.999 JST = 2025-12-25 14:59:59.999 UTC
    expect(schedule.eventEndDate.toISOString()).toBe('2025-12-25T14:59:59.999Z');
    // 2025-12-26 00:00:00 JST = 2025-12-25 15:00:00 UTC
    expect(schedule.revealDate.toISOString()).toBe('2025-12-25T15:00:00.000Z');
    // 2025-12-15 23:59:59.999 JST = 2025-12-15 14:59:59.999 UTC
    expect(schedule.purchaseDeadline.toISOString()).toBe('2025-12-15T14:59:59.999Z');
  });

  it('converts Australia/Sydney timezone correctly (UTC+10/+11)', () => {
    const schedule = parseRatmasSchedule({
      startDate: '2025-12-01',
      endDate: '2025-12-25',
      revealDate: '2025-12-26',
      purchaseDeadline: '2025-12-15',
      timezone: 'Australia/Sydney', // AEDT is UTC+11 in December
    });

    // 2025-12-01 00:00:00 AEDT = 2025-11-30 13:00:00 UTC (AEDT is UTC+11)
    expect(schedule.eventStartDate.toISOString()).toBe('2025-11-30T13:00:00.000Z');
    // 2025-12-25 23:59:59.999 AEDT = 2025-12-25 12:59:59.999 UTC
    expect(schedule.eventEndDate.toISOString()).toBe('2025-12-25T12:59:59.999Z');
    // 2025-12-26 00:00:00 AEDT = 2025-12-25 13:00:00 UTC
    expect(schedule.revealDate.toISOString()).toBe('2025-12-25T13:00:00.000Z');
    // 2025-12-15 23:59:59.999 AEDT = 2025-12-15 12:59:59.999 UTC
    expect(schedule.purchaseDeadline.toISOString()).toBe('2025-12-15T12:59:59.999Z');
  });

  it('converts America/Los_Angeles timezone correctly (UTC-8/-7)', () => {
    const schedule = parseRatmasSchedule({
      startDate: '2025-12-01',
      endDate: '2025-12-25',
      revealDate: '2025-12-26',
      purchaseDeadline: '2025-12-15',
      timezone: 'America/Los_Angeles', // PST is UTC-8
    });

    // 2025-12-01 00:00:00 PST = 2025-12-01 08:00:00 UTC (PST is UTC-8)
    expect(schedule.eventStartDate.toISOString()).toBe('2025-12-01T08:00:00.000Z');
    // 2025-12-25 23:59:59.999 PST = 2025-12-26 07:59:59.999 UTC
    expect(schedule.eventEndDate.toISOString()).toBe('2025-12-26T07:59:59.999Z');
    // 2025-12-26 00:00:00 PST = 2025-12-26 08:00:00 UTC
    expect(schedule.revealDate.toISOString()).toBe('2025-12-26T08:00:00.000Z');
    // 2025-12-15 23:59:59.999 PST = 2025-12-16 07:59:59.999 UTC
    expect(schedule.purchaseDeadline.toISOString()).toBe('2025-12-16T07:59:59.999Z');
  });

  it('handles date boundaries correctly with negative UTC offset', () => {
    // Test that a date in PST properly crosses into the next day in UTC
    const schedule = parseRatmasSchedule({
      startDate: '2025-06-15',
      endDate: '2025-06-15',
      revealDate: '2025-06-16',
      purchaseDeadline: '2025-06-14',
      timezone: 'America/Los_Angeles', // PDT is UTC-7 in June
    });

    // Start of day: 2025-06-15 00:00:00 PDT = 2025-06-15 07:00:00 UTC
    expect(schedule.eventStartDate.toISOString()).toBe('2025-06-15T07:00:00.000Z');
    // End of day: 2025-06-15 23:59:59.999 PDT = 2025-06-16 06:59:59.999 UTC (crosses into next day)
    expect(schedule.eventEndDate.toISOString()).toBe('2025-06-16T06:59:59.999Z');
  });

  it('handles date boundaries correctly with positive UTC offset', () => {
    // Test that a date in JST properly crosses into the previous day in UTC
    const schedule = parseRatmasSchedule({
      startDate: '2025-06-15',
      endDate: '2025-06-15',
      revealDate: '2025-06-16',
      purchaseDeadline: '2025-06-14',
      timezone: 'Asia/Tokyo', // JST is UTC+9
    });

    // Start of day: 2025-06-15 00:00:00 JST = 2025-06-14 15:00:00 UTC (crosses into previous day)
    expect(schedule.eventStartDate.toISOString()).toBe('2025-06-14T15:00:00.000Z');
    // End of day: 2025-06-15 23:59:59.999 JST = 2025-06-15 14:59:59.999 UTC
    expect(schedule.eventEndDate.toISOString()).toBe('2025-06-15T14:59:59.999Z');
  });

  it('preserves millisecond precision for end-of-day boundaries', () => {
    const schedule = parseRatmasSchedule({
      startDate: '2025-12-01',
      endDate: '2025-12-01',
      revealDate: '2025-12-02',
      purchaseDeadline: '2025-11-30',
      timezone: 'UTC',
    });

    // Verify millisecond precision is maintained
    expect(schedule.eventEndDate.getMilliseconds()).toBe(999);
    expect(schedule.purchaseDeadline.getMilliseconds()).toBe(999);

    // Verify exact time
    expect(schedule.eventEndDate.toISOString()).toBe('2025-12-01T23:59:59.999Z');
    expect(schedule.purchaseDeadline.toISOString()).toBe('2025-11-30T23:59:59.999Z');
  });

  it('handles DST transition dates correctly', () => {
    // Test around DST transition in March for America/New_York
    // DST starts March 9, 2025 at 2:00 AM (EDT begins, UTC-4)
    const beforeDST = parseRatmasSchedule({
      startDate: '2025-03-08',
      endDate: '2025-03-08',
      revealDate: '2025-03-09',
      purchaseDeadline: '2025-03-07',
      timezone: 'America/New_York',
    });

    const afterDST = parseRatmasSchedule({
      startDate: '2025-03-10',
      endDate: '2025-03-10',
      revealDate: '2025-03-11',
      purchaseDeadline: '2025-03-09',
      timezone: 'America/New_York',
    });

    // Before DST: EST is UTC-5
    expect(beforeDST.eventStartDate.toISOString()).toBe('2025-03-08T05:00:00.000Z');
    // After DST: EDT is UTC-4
    expect(afterDST.eventStartDate.toISOString()).toBe('2025-03-10T04:00:00.000Z');
  });

  it('correctly sequences dates across timezone conversions', () => {
    const schedule = parseRatmasSchedule({
      startDate: '2025-12-01',
      endDate: '2025-12-26',
      revealDate: '2025-12-26',
      purchaseDeadline: '2025-12-16',
      timezone: 'America/New_York',
    });

    // Verify logical ordering is maintained after UTC conversion
    expect(schedule.eventStartDate.getTime()).toBeLessThan(schedule.purchaseDeadline.getTime());
    expect(schedule.purchaseDeadline.getTime()).toBeLessThan(schedule.revealDate.getTime());
    expect(schedule.revealDate.getTime()).toBeLessThanOrEqual(schedule.eventEndDate.getTime());
  });

  it('formats dates as Discord timestamps', () => {
    const date = new Date('2025-12-01T00:00:00.000Z');

    expect(toDiscordTimestamp(date, 'D')).toBe('<t:1764547200:D>');
    expect(toDiscordTimestamp(date, 'F')).toBe('<t:1764547200:F>');
    expect(toDiscordTimestamp(date, 'R')).toBe('<t:1764547200:R>');
  });

  it('calculates assignment announcement date as Discord timestamp', () => {
    const startDate = new Date('2025-12-01T00:00:00.000Z');
    const announcement = calculateAssignmentAnnouncementDate(startDate);

    // Should be 5 days after start date
    expect(announcement).toContain('<t:');
    expect(announcement).toContain(':D>');
  });
});
