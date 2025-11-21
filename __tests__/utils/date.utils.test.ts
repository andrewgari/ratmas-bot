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
    });

    expect(schedule.eventStartDate.toISOString()).toBe('2025-12-01T00:00:00.000Z');
    expect(schedule.eventEndDate.toISOString()).toBe('2025-12-25T23:59:59.999Z');
    expect(schedule.revealDate.toISOString()).toBe('2025-12-26T00:00:00.000Z');
    expect(schedule.purchaseDeadline.toISOString()).toBe('2025-12-15T23:59:59.999Z');
  });

  it('throws when provided an invalid date', () => {
    expect(() =>
      parseRatmasSchedule({
        startDate: 'invalid-date',
        endDate: '2025-12-25',
        revealDate: '2025-12-26',
        purchaseDeadline: '2025-12-15',
      })
    ).toThrow('Start date must be in YYYY-MM-DD format');
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
