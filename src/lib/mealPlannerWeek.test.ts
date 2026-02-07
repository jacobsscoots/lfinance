import { describe, it, expect } from "vitest";
import {
  getShoppingWeekRange,
  formatShoppingWeekRange,
  getShoppingWeekDates,
  getShoppingWeekDateStrings,
  isDateBlackout,
  getActiveDatesInRange,
  getActiveDateStringsInRange,
  getNextShoppingWeek,
  getPreviousShoppingWeek,
  isCurrentShoppingWeek,
  BlackoutRange,
} from "./mealPlannerWeek";
import { format, addDays } from "date-fns";

describe("mealPlannerWeek", () => {
  describe("getShoppingWeekRange", () => {
    it("should return Sun 8 Feb → Mon 16 Feb for anchor 2026-02-10 (Tuesday)", () => {
      const anchor = new Date("2026-02-10"); // Tuesday
      const range = getShoppingWeekRange(anchor);
      
      expect(format(range.start, "yyyy-MM-dd")).toBe("2026-02-08"); // Sunday
      expect(format(range.end, "yyyy-MM-dd")).toBe("2026-02-16");   // Monday
    });

    it("should return 9 days inclusive from Sunday to Monday", () => {
      const anchor = new Date("2026-02-10");
      const range = getShoppingWeekRange(anchor);
      const dates = getShoppingWeekDates(range);
      
      expect(dates.length).toBe(9);
    });

    it("should return correct range when anchor is Sunday", () => {
      const anchor = new Date("2026-02-08"); // Sunday
      const range = getShoppingWeekRange(anchor);
      
      expect(format(range.start, "yyyy-MM-dd")).toBe("2026-02-08");
      expect(format(range.end, "yyyy-MM-dd")).toBe("2026-02-16");
    });

    it("should return correct range when anchor is the ending Monday", () => {
      const anchor = new Date("2026-02-16"); // Monday (end of cycle)
      const range = getShoppingWeekRange(anchor);
      
      // This Monday is the last day of the cycle that started Sun 8 Feb
      expect(format(range.start, "yyyy-MM-dd")).toBe("2026-02-08");
      expect(format(range.end, "yyyy-MM-dd")).toBe("2026-02-16");
    });

    it("should return correct range when anchor is Saturday", () => {
      const anchor = new Date("2026-02-14"); // Saturday
      const range = getShoppingWeekRange(anchor);
      
      expect(format(range.start, "yyyy-MM-dd")).toBe("2026-02-08");
      expect(format(range.end, "yyyy-MM-dd")).toBe("2026-02-16");
    });
  });

  describe("formatShoppingWeekRange", () => {
    it("should format as 'Sun 8 Feb → Mon 16 Feb 2026'", () => {
      const range = getShoppingWeekRange(new Date("2026-02-10"));
      const formatted = formatShoppingWeekRange(range);
      
      expect(formatted).toBe("Sun 8 Feb → Mon 16 Feb 2026");
    });
  });

  describe("getShoppingWeekDateStrings", () => {
    it("should return 9 date strings", () => {
      const range = getShoppingWeekRange(new Date("2026-02-10"));
      const dates = getShoppingWeekDateStrings(range);
      
      expect(dates).toEqual([
        "2026-02-08", // Sun
        "2026-02-09", // Mon
        "2026-02-10", // Tue
        "2026-02-11", // Wed
        "2026-02-12", // Thu
        "2026-02-13", // Fri
        "2026-02-14", // Sat
        "2026-02-15", // Sun
        "2026-02-16", // Mon
      ]);
    });
  });

  describe("isDateBlackout", () => {
    const blackouts: BlackoutRange[] = [
      {
        id: "1",
        user_id: "user1",
        start_date: "2026-02-12",
        end_date: "2026-02-14",
        reason: "Holiday",
        created_at: "",
        updated_at: "",
      },
    ];

    it("should return true for dates within blackout range", () => {
      expect(isDateBlackout("2026-02-12", blackouts)).toBe(true);
      expect(isDateBlackout("2026-02-13", blackouts)).toBe(true);
      expect(isDateBlackout("2026-02-14", blackouts)).toBe(true);
    });

    it("should return false for dates outside blackout range", () => {
      expect(isDateBlackout("2026-02-11", blackouts)).toBe(false);
      expect(isDateBlackout("2026-02-15", blackouts)).toBe(false);
    });

    it("should return false when no blackouts", () => {
      expect(isDateBlackout("2026-02-12", [])).toBe(false);
    });
  });

  describe("getActiveDatesInRange", () => {
    it("should exclude blackout dates from range", () => {
      const range = getShoppingWeekRange(new Date("2026-02-10"));
      const blackouts: BlackoutRange[] = [
        {
          id: "1",
          user_id: "user1",
          start_date: "2026-02-12",
          end_date: "2026-02-14",
          reason: "Holiday",
          created_at: "",
          updated_at: "",
        },
      ];
      
      const activeDates = getActiveDatesInRange(range, blackouts);
      
      // 9 days total - 3 blackout days = 6 active days
      expect(activeDates.length).toBe(6);
    });

    it("should return all dates when no blackouts", () => {
      const range = getShoppingWeekRange(new Date("2026-02-10"));
      const activeDates = getActiveDatesInRange(range, []);
      
      expect(activeDates.length).toBe(9);
    });
  });

  describe("getActiveDateStringsInRange", () => {
    it("should return correct active date strings excluding blackouts", () => {
      const range = getShoppingWeekRange(new Date("2026-02-10"));
      const blackouts: BlackoutRange[] = [
        {
          id: "1",
          user_id: "user1",
          start_date: "2026-02-12",
          end_date: "2026-02-14",
          reason: "Holiday",
          created_at: "",
          updated_at: "",
        },
      ];
      
      const activeStrings = getActiveDateStringsInRange(range, blackouts);
      
      expect(activeStrings).toEqual([
        "2026-02-08", // Sun
        "2026-02-09", // Mon
        "2026-02-10", // Tue
        "2026-02-11", // Wed
        // 12, 13, 14 are blackout
        "2026-02-15", // Sun
        "2026-02-16", // Mon
      ]);
    });
  });

  describe("getNextShoppingWeek / getPreviousShoppingWeek", () => {
    it("should get next week starting on the following Sunday", () => {
      const current = getShoppingWeekRange(new Date("2026-02-10"));
      const next = getNextShoppingWeek(current);
      
      // Current: Sun 8 Feb → Mon 16 Feb
      // Next: Sun 15 Feb → Mon 23 Feb
      expect(format(next.start, "yyyy-MM-dd")).toBe("2026-02-15");
      expect(format(next.end, "yyyy-MM-dd")).toBe("2026-02-23");
    });

    it("should get previous week starting on the previous Sunday", () => {
      const current = getShoppingWeekRange(new Date("2026-02-10"));
      const prev = getPreviousShoppingWeek(current);
      
      // Current: Sun 8 Feb → Mon 16 Feb
      // Previous: Sun 1 Feb → Mon 9 Feb
      expect(format(prev.start, "yyyy-MM-dd")).toBe("2026-02-01");
      expect(format(prev.end, "yyyy-MM-dd")).toBe("2026-02-09");
    });
  });

  describe("grocery list exclusion (integration check)", () => {
    it("should reduce active day count when blackouts exist", () => {
      const range = getShoppingWeekRange(new Date("2026-02-10"));
      const blackouts: BlackoutRange[] = [
        {
          id: "1",
          user_id: "user1",
          start_date: "2026-02-12",
          end_date: "2026-02-14",
          reason: "Holiday",
          created_at: "",
          updated_at: "",
        },
      ];
      
      const allDates = getShoppingWeekDateStrings(range);
      const activeDates = getActiveDateStringsInRange(range, blackouts);
      
      // Should have 3 fewer dates
      expect(allDates.length - activeDates.length).toBe(3);
    });
  });
});
