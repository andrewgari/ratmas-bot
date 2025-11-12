import { describe, it, expect } from '@jest/globals';
import {
  parseRatmasSchedule,
  formatDateForTimezone,
  calculateAssignmentAnnouncementDate,
} from '../../src/utils/date.utils.js';

describe('date.utils', () => {
  it('parses a valid schedule and normalises to UTC boundaries', () => {
    const schedule = parseRatmasSchedule({
      startDate: '2025-12-01',
      endDate: '2025-12-25',
      revealDate: '2025-12-26',
      purchaseDeadline: '2025-12-15',
      timezone: 'America/New_York',
    });

    expect(schedule.timezone).toBe('America/New_York');
    expect(schedule.eventStartDate.toISOString()).toBe('2025-12-01T05:00:00.000Z');
    expect(schedule.eventEndDate.toISOString()).toBe('2025-12-26T04:59:59.999Z');
    expect(schedule.revealDate.toISOString()).toBe('2025-12-26T05:00:00.000Z');
    expect(schedule.purchaseDeadline.toISOString()).toBe('2025-12-16T04:59:59.999Z');
  });

  it('throws when provided an invalid timezone', () => {
    expect(() =>
      parseRatmasSchedule({
        startDate: '2025-12-01',
        endDate: '2025-12-25',
        revealDate: '2025-12-26',
        purchaseDeadline: '2025-12-15',
        timezone: 'Moon/Base-One',
      })
    ).toThrow('Please provide a valid IANA timezone');
  });

  it('formats timeline helpers with the supplied timezone', () => {
    const schedule = parseRatmasSchedule({
      startDate: '2025-12-01',
      endDate: '2025-12-25',
      revealDate: '2025-12-26',
      purchaseDeadline: '2025-12-15',
      timezone: 'Europe/Paris',
    });

    expect(formatDateForTimezone(schedule.eventStartDate, schedule.timezone)).toContain(
      'December 1, 2025'
    );
    expect(calculateAssignmentAnnouncementDate(schedule.eventStartDate, schedule.timezone)).toContain(
      'December 6, 2025'
    );
  });
});
