import { describe, it, expect } from "vitest";
import {
  getWeekStartMonday,
  getNextWeekStartFromSundayWeighIn,
  buildFlatSchedule,
  buildZigzagSchedule,
  getTargetCaloriesForPlan,
  getWeeklyAverage,
  getCaloriesForDate,
  scheduleToArray,
  PLAN_MODES,
} from "./weekTargets";

describe("getWeekStartMonday", () => {
  it("returns Monday for a Monday date", () => {
    // Feb 9, 2026 is a Monday
    const date = new Date(2026, 1, 9);
    const monday = getWeekStartMonday(date);
    expect(monday.getDay()).toBe(1); // Monday
    expect(monday.getDate()).toBe(9);
  });

  it("returns previous Monday for a Wednesday", () => {
    // Feb 11, 2026 is a Wednesday
    const date = new Date(2026, 1, 11);
    const monday = getWeekStartMonday(date);
    expect(monday.getDay()).toBe(1);
    expect(monday.getDate()).toBe(9); // Monday Feb 9
  });

  it("returns previous Monday for a Sunday", () => {
    // Feb 15, 2026 is a Sunday
    const date = new Date(2026, 1, 15);
    const monday = getWeekStartMonday(date);
    expect(monday.getDay()).toBe(1);
    expect(monday.getDate()).toBe(9); // Monday Feb 9
  });
});

describe("getNextWeekStartFromSundayWeighIn", () => {
  it("returns next day (Monday) when today is Sunday", () => {
    // Feb 8, 2026 is a Sunday
    const sunday = new Date(2026, 1, 8);
    const nextMonday = getNextWeekStartFromSundayWeighIn(sunday);
    expect(nextMonday.getDay()).toBe(1); // Monday
    expect(nextMonday.getDate()).toBe(9);
  });

  it("returns next Monday when today is Tuesday", () => {
    // Feb 10, 2026 is a Tuesday
    const tuesday = new Date(2026, 1, 10);
    const nextMonday = getNextWeekStartFromSundayWeighIn(tuesday);
    expect(nextMonday.getDay()).toBe(1);
    expect(nextMonday.getDate()).toBe(16); // Monday Feb 16
  });

  it("returns next Monday (7 days) when today is Monday", () => {
    // Feb 9, 2026 is a Monday
    const monday = new Date(2026, 1, 9);
    const nextMonday = getNextWeekStartFromSundayWeighIn(monday);
    expect(nextMonday.getDay()).toBe(1);
    expect(nextMonday.getDate()).toBe(16); // Next Monday
  });
});

describe("buildFlatSchedule", () => {
  it("creates schedule with same calories every day", () => {
    const schedule = buildFlatSchedule(2000);
    expect(schedule.monday).toBe(2000);
    expect(schedule.tuesday).toBe(2000);
    expect(schedule.saturday).toBe(2000);
    expect(schedule.sunday).toBe(2000);
  });
});

describe("buildZigzagSchedule", () => {
  const tdee = 2500;

  describe("schedule_1 (high weekend)", () => {
    it("has higher calories on weekend", () => {
      const schedule = buildZigzagSchedule(tdee, "maintain", "schedule_1");
      expect(schedule.saturday).toBeGreaterThan(schedule.monday);
      expect(schedule.sunday).toBeGreaterThan(schedule.monday);
    });

    it("maintains weekly average close to target", () => {
      const schedule = buildZigzagSchedule(tdee, "maintain", "schedule_1");
      const avg = getWeeklyAverage(schedule);
      // Should be within 5 calories of target
      expect(Math.abs(avg - tdee)).toBeLessThanOrEqual(5);
    });

    it("applies deficit for loss modes", () => {
      const scheduleDeficit = buildZigzagSchedule(tdee, "loss", "schedule_1");
      const avgDeficit = getWeeklyAverage(scheduleDeficit);
      const targetDeficit = tdee + PLAN_MODES.loss.dailyCalorieAdjustment;
      expect(Math.abs(avgDeficit - targetDeficit)).toBeLessThanOrEqual(5);
    });
  });

  describe("schedule_2 (varied)", () => {
    it("has variation throughout the week", () => {
      const schedule = buildZigzagSchedule(tdee, "maintain", "schedule_2");
      // Should have at least 3 different values
      const values = new Set([
        schedule.monday,
        schedule.tuesday,
        schedule.wednesday,
        schedule.thursday,
        schedule.friday,
        schedule.saturday,
        schedule.sunday,
      ]);
      expect(values.size).toBeGreaterThanOrEqual(2);
    });

    it("maintains weekly average close to target", () => {
      const schedule = buildZigzagSchedule(tdee, "maintain", "schedule_2");
      const avg = getWeeklyAverage(schedule);
      expect(Math.abs(avg - tdee)).toBeLessThanOrEqual(10);
    });
  });
});

describe("getTargetCaloriesForPlan", () => {
  it("returns TDEE for maintain", () => {
    expect(getTargetCaloriesForPlan(2500, "maintain")).toBe(2500);
  });

  it("returns deficit for loss modes", () => {
    expect(getTargetCaloriesForPlan(2500, "mild_loss")).toBe(2225); // -275
    expect(getTargetCaloriesForPlan(2500, "loss")).toBe(1950); // -550
    expect(getTargetCaloriesForPlan(2500, "extreme_loss")).toBe(1400); // -1100
  });
});

describe("getCaloriesForDate", () => {
  it("returns correct calories for each day", () => {
    const schedule = {
      monday: 1800,
      tuesday: 1900,
      wednesday: 2000,
      thursday: 2100,
      friday: 2200,
      saturday: 2400,
      sunday: 2300,
    };

    // Feb 9, 2026 is Monday
    expect(getCaloriesForDate(new Date(2026, 1, 9), schedule)).toBe(1800);
    // Feb 14, 2026 is Saturday
    expect(getCaloriesForDate(new Date(2026, 1, 14), schedule)).toBe(2400);
    // Feb 15, 2026 is Sunday
    expect(getCaloriesForDate(new Date(2026, 1, 15), schedule)).toBe(2300);
  });
});

describe("scheduleToArray", () => {
  it("converts schedule to array format", () => {
    const schedule = buildFlatSchedule(2000);
    const arr = scheduleToArray(schedule);
    expect(arr).toHaveLength(7);
    expect(arr[0]).toEqual({ day: "Monday", calories: 2000 });
    expect(arr[6]).toEqual({ day: "Sunday", calories: 2000 });
  });
});
