/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck - Jest mock types are incompatible with service/repository signatures
import { describe, it, expect } from '@jest/globals';
import { validateStatusTransition } from '../src/services/rat.service.helpers.js';
import { RatmasEventStatus } from '../src/types/ratmas.types.js';

describe('RatService.helpers - validateStatusTransition', () => {
  describe('OPEN status transitions', () => {
    it('should allow transition from OPEN to WISHLIST', () => {
      expect(() => {
        validateStatusTransition(RatmasEventStatus.OPEN, RatmasEventStatus.WISHLIST);
      }).not.toThrow();
    });

    it('should allow transition from OPEN to LOCKED', () => {
      expect(() => {
        validateStatusTransition(RatmasEventStatus.OPEN, RatmasEventStatus.LOCKED);
      }).not.toThrow();
    });

    it('should allow transition from OPEN to CANCELLED', () => {
      expect(() => {
        validateStatusTransition(RatmasEventStatus.OPEN, RatmasEventStatus.CANCELLED);
      }).not.toThrow();
    });

    it('should reject transition from OPEN to MATCHED', () => {
      expect(() => {
        validateStatusTransition(RatmasEventStatus.OPEN, RatmasEventStatus.MATCHED);
      }).toThrow('Invalid status transition');
    });
  });

  describe('WISHLIST status transitions', () => {
    it('should allow transition from WISHLIST to LOCKED', () => {
      expect(() => {
        validateStatusTransition(RatmasEventStatus.WISHLIST, RatmasEventStatus.LOCKED);
      }).not.toThrow();
    });

    it('should allow transition from WISHLIST to CANCELLED', () => {
      expect(() => {
        validateStatusTransition(RatmasEventStatus.WISHLIST, RatmasEventStatus.CANCELLED);
      }).not.toThrow();
    });

    it('should reject transition from WISHLIST to MATCHED', () => {
      expect(() => {
        validateStatusTransition(RatmasEventStatus.WISHLIST, RatmasEventStatus.MATCHED);
      }).toThrow('Invalid status transition');
    });

    it('should reject transition from WISHLIST to OPEN', () => {
      expect(() => {
        validateStatusTransition(RatmasEventStatus.WISHLIST, RatmasEventStatus.OPEN);
      }).toThrow('Invalid status transition');
    });
  });

  describe('LOCKED status transitions', () => {
    it('should allow transition from LOCKED to MATCHED', () => {
      expect(() => {
        validateStatusTransition(RatmasEventStatus.LOCKED, RatmasEventStatus.MATCHED);
      }).not.toThrow();
    });

    it('should allow transition from LOCKED to OPEN', () => {
      expect(() => {
        validateStatusTransition(RatmasEventStatus.LOCKED, RatmasEventStatus.OPEN);
      }).not.toThrow();
    });

    it('should allow transition from LOCKED to CANCELLED', () => {
      expect(() => {
        validateStatusTransition(RatmasEventStatus.LOCKED, RatmasEventStatus.CANCELLED);
      }).not.toThrow();
    });
  });

  describe('MATCHED status transitions', () => {
    it('should allow transition from MATCHED to NOTIFIED', () => {
      expect(() => {
        validateStatusTransition(RatmasEventStatus.MATCHED, RatmasEventStatus.NOTIFIED);
      }).not.toThrow();
    });

    it('should allow transition from MATCHED to CANCELLED', () => {
      expect(() => {
        validateStatusTransition(RatmasEventStatus.MATCHED, RatmasEventStatus.CANCELLED);
      }).not.toThrow();
    });
  });

  describe('NOTIFIED status transitions', () => {
    it('should allow transition from NOTIFIED to COMPLETED', () => {
      expect(() => {
        validateStatusTransition(RatmasEventStatus.NOTIFIED, RatmasEventStatus.COMPLETED);
      }).not.toThrow();
    });

    it('should allow transition from NOTIFIED to CANCELLED', () => {
      expect(() => {
        validateStatusTransition(RatmasEventStatus.NOTIFIED, RatmasEventStatus.CANCELLED);
      }).not.toThrow();
    });
  });

  describe('Terminal status transitions', () => {
    it('should reject any transition from COMPLETED', () => {
      expect(() => {
        validateStatusTransition(RatmasEventStatus.COMPLETED, RatmasEventStatus.OPEN);
      }).toThrow('Invalid status transition');
    });

    it('should reject any transition from CANCELLED', () => {
      expect(() => {
        validateStatusTransition(RatmasEventStatus.CANCELLED, RatmasEventStatus.OPEN);
      }).toThrow('Invalid status transition');
    });
  });
});
