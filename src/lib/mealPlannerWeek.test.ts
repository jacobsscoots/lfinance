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

    it("should return correct range when anchor is any Monday in the week", () => {
      // With the fix, Monday is now day 2 of its week (starts from previous Sunday)
      // Feb 16 (Monday) should return Feb 15-23, not Feb 8-16
      const anchor = new Date("2026-02-16"); // Monday
      const range = getShoppingWeekRange(anchor);
      
      // Monday now belongs to the week that started the day before (Sunday Feb 15)
      expect(format(range.start, "yyyy-MM-dd")).toBe("2026-02-15");
      expect(format(range.end, "yyyy-MM-dd")).toBe("2026-02-23");
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

  describe("regression: Feb 9-16 week range", () => {
    it("should include all dates from Feb 8 to Feb 16 when anchor is Feb 9 (Monday)", () => {
      // The user reported that Feb 9-16 wasn't generating meals
      // Anchor: Feb 9 (Monday) should be part of the Feb 8-16 shopping week
      const anchor = new Date("2026-02-09");
      const range = getShoppingWeekRange(anchor);
      const dates = getShoppingWeekDateStrings(range);
      
      // Feb 9 is Monday, part of shopping week that started Sun Feb 8
      expect(format(range.start, "yyyy-MM-dd")).toBe("2026-02-08");
      expect(format(range.end, "yyyy-MM-dd")).toBe("2026-02-16");
      expect(dates.length).toBe(9);
      
      // Verify all dates from Feb 8-16 are included
      expect(dates).toContain("2026-02-09");
      expect(dates).toContain("2026-02-10");
      expect(dates).toContain("2026-02-11");
      expect(dates).toContain("2026-02-12");
      expect(dates).toContain("2026-02-13");
      expect(dates).toContain("2026-02-14");
      expect(dates).toContain("2026-02-15");
      expect(dates).toContain("2026-02-16");
    });

    it("should handle Feb 9 anchor correctly - NOT go back to Feb 1 week", () => {
      // Critical: Feb 9 (Monday) should stay in Feb 8-16 week
      // NOT be treated as end of Feb 1-9 week
      const anchor = new Date("2026-02-09");
      const range = getShoppingWeekRange(anchor);
      
      // Should NOT be Feb 1-9
      expect(format(range.start, "yyyy-MM-dd")).not.toBe("2026-02-01");
      expect(format(range.end, "yyyy-MM-dd")).not.toBe("2026-02-09");
      
      // Should be Feb 8-16
      expect(format(range.start, "yyyy-MM-dd")).toBe("2026-02-08");
      expect(format(range.end, "yyyy-MM-dd")).toBe("2026-02-16");
    });

    it("should correctly navigate from current week to next without overlapping dates", () => {
      // When navigating weeks, dates should be sequential, not overlapping
      const week1 = getShoppingWeekRange(new Date("2026-02-10")); // Feb 8-16
      const week2 = getNextShoppingWeek(week1); // Should be Feb 15-23
      
      const dates1 = getShoppingWeekDateStrings(week1);
      const dates2 = getShoppingWeekDateStrings(week2);
      
      // Verify week ranges
      expect(format(week1.start, "yyyy-MM-dd")).toBe("2026-02-08");
      expect(format(week1.end, "yyyy-MM-dd")).toBe("2026-02-16");
      expect(format(week2.start, "yyyy-MM-dd")).toBe("2026-02-15");
      expect(format(week2.end, "yyyy-MM-dd")).toBe("2026-02-23");
      
      // Note: Shopping weeks DO overlap by design (9-day window)
      // Feb 15 and Feb 16 appear in both weeks
      expect(dates1).toContain("2026-02-15");
      expect(dates1).toContain("2026-02-16");
      expect(dates2).toContain("2026-02-15");
      expect(dates2).toContain("2026-02-16");
    });
  });
});
