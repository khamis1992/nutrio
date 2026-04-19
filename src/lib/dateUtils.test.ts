import { describe, it, expect } from "vitest";
import {
  QATAR_TIMEZONE,
  getQatarDate,
  getQatarDay,
  getQatarNow,
  isQatarToday,
  getWeekStartDay,
  WEEK_DAYS_SATURDAY,
  WEEK_DAYS_MONDAY,
} from "./dateUtils";

describe("dateUtils", () => {
  describe("QATAR_TIMEZONE", () => {
    it("is Asia/Qatar", () => {
      expect(QATAR_TIMEZONE).toBe("Asia/Qatar");
    });
  });

  describe("getQatarDay", () => {
    it("returns date string in yyyy-MM-dd format", () => {
      const result = getQatarDay(new Date("2026-04-18T12:00:00Z"));
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("returns consistent results for the same input", () => {
      const date = new Date("2026-04-18T12:00:00Z");
      expect(getQatarDay(date)).toBe(getQatarDay(date));
    });

    it("uses Qatar timezone (UTC+3, no DST)", () => {
      const utcNoon = new Date("2026-01-15T12:00:00Z");
      const result = getQatarDay(utcNoon);
      expect(result).toBe("2026-01-15");

      const utcLate = new Date("2026-01-15T23:00:00Z");
      const resultLate = getQatarDay(utcLate);
      expect(resultLate).toBe("2026-01-16");
    });

    it("defaults to current date when no argument", () => {
      const result = getQatarDay();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe("getQatarNow", () => {
    it("returns a Date object", () => {
      const result = getQatarNow();
      expect(result).toBeInstanceOf(Date);
    });

    it("returns a date in Qatar timezone", () => {
      const result = getQatarNow();
      expect(result.getFullYear()).toBeGreaterThanOrEqual(2025);
    });
  });

  describe("getQatarDate", () => {
    it("returns a Date object converted to Qatar timezone", () => {
      const result = getQatarDate(new Date("2026-04-18T00:00:00Z"));
      expect(result).toBeInstanceOf(Date);
    });

    it("defaults to current date when no argument", () => {
      const result = getQatarDate();
      expect(result).toBeInstanceOf(Date);
    });
  });

  describe("isQatarToday", () => {
    it("returns true for today's Qatar date string", () => {
      const todayStr = getQatarDay();
      expect(isQatarToday(todayStr)).toBe(true);
    });

    it("returns false for a date string that is not today", () => {
      expect(isQatarToday("2000-01-01")).toBe(false);
    });

    it("returns false for yesterday", () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = getQatarDay(yesterday);
      if (yesterdayStr !== getQatarDay()) {
        expect(isQatarToday(yesterdayStr)).toBe(false);
      }
    });
  });

  describe("getWeekStartDay", () => {
    it("returns 6 (Saturday) for Arabic locale", () => {
      expect(getWeekStartDay("ar")).toBe(6);
    });

    it("returns 6 for Arabic with region code", () => {
      expect(getWeekStartDay("ar-QA")).toBe(6);
    });

    it("returns 1 (Monday) for English", () => {
      expect(getWeekStartDay("en")).toBe(1);
    });

    it("returns 1 (Monday) for undefined", () => {
      expect(getWeekStartDay(undefined)).toBe(1);
    });

    it("returns 1 (Monday) for French", () => {
      expect(getWeekStartDay("fr")).toBe(1);
    });
  });

  describe("WEEK_DAYS constants", () => {
    it("WEEK_DAYS_SATURDAY starts with 6 (Saturday)", () => {
      expect(WEEK_DAYS_SATURDAY[0]).toBe(6);
    });

    it("WEEK_DAYS_SATURDAY has 7 elements", () => {
      expect(WEEK_DAYS_SATURDAY).toHaveLength(7);
    });

    it("WEEK_DAYS_MONDAY starts with 1 (Monday)", () => {
      expect(WEEK_DAYS_MONDAY[0]).toBe(1);
    });

    it("WEEK_DAYS_MONDAY has 7 elements", () => {
      expect(WEEK_DAYS_MONDAY).toHaveLength(7);
    });

    it("WEEK_DAYS_SATURDAY contains all days 0-6", () => {
      const sorted = [...WEEK_DAYS_SATURDAY].sort();
      expect(sorted).toEqual([0, 1, 2, 3, 4, 5, 6]);
    });

    it("WEEK_DAYS_MONDAY contains all days 0-6", () => {
      const sorted = [...WEEK_DAYS_MONDAY].sort();
      expect(sorted).toEqual([0, 1, 2, 3, 4, 5, 6]);
    });
  });
});