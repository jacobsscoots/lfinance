import { describe, it, expect } from "vitest";
import { 
  getPaydayForMonth, 
  isWorkingDay, 
  isBankHoliday, 
  isWeekend,
  getPayCycleForDate 
} from "./ukWorkingDays";

describe("UK Payday Calculation", () => {
  it("returns 20th when it falls on Tuesday", () => {
    // May 2025: 20th is Tuesday
    const payday = getPaydayForMonth(2025, 4);
    expect(payday.getDate()).toBe(20);
    expect(payday.getDay()).toBe(2); // Tuesday
  });

  it("returns 20th when it falls on Wednesday", () => {
    // August 2025: 20th is Wednesday
    const payday = getPaydayForMonth(2025, 7);
    expect(payday.getDate()).toBe(20);
    expect(payday.getDay()).toBe(3); // Wednesday
  });

  it("returns 20th when it falls on Thursday", () => {
    // February 2025: 20th is Thursday
    const payday = getPaydayForMonth(2025, 1);
    expect(payday.getDate()).toBe(20);
    expect(payday.getDay()).toBe(4); // Thursday
  });

  it("returns 20th when it falls on Friday", () => {
    // June 2025: 20th is Friday
    const payday = getPaydayForMonth(2025, 5);
    expect(payday.getDate()).toBe(20);
    expect(payday.getDay()).toBe(5); // Friday
  });

  it("returns Friday 17th when 20th is Monday", () => {
    // January 2025: 20th is Monday → should be Friday 17th
    const payday = getPaydayForMonth(2025, 0);
    expect(payday.getDate()).toBe(17);
    expect(payday.getDay()).toBe(5); // Friday
  });

  it("returns Friday 19th when 20th is Saturday", () => {
    // September 2025: 20th is Saturday → Friday 19th
    const payday = getPaydayForMonth(2025, 8);
    expect(payday.getDate()).toBe(19);
    expect(payday.getDay()).toBe(5); // Friday
  });

  it("returns Friday 18th when 20th is Sunday", () => {
    // July 2025: 20th is Sunday → Friday 18th
    const payday = getPaydayForMonth(2025, 6);
    expect(payday.getDate()).toBe(18);
    expect(payday.getDay()).toBe(5); // Friday
  });

  it("handles year boundary correctly", () => {
    // December 2025: 20th is Saturday → Friday 19th
    const payday = getPaydayForMonth(2025, 11);
    expect(payday.getDate()).toBe(19);
    expect(payday.getMonth()).toBe(11);
    expect(payday.getFullYear()).toBe(2025);
  });
});

describe("Working Day Detection", () => {
  it("Saturday is not a working day", () => {
    expect(isWorkingDay(new Date(2025, 0, 4))).toBe(false); // Jan 4 2025 is Saturday
  });

  it("Sunday is not a working day", () => {
    expect(isWorkingDay(new Date(2025, 0, 5))).toBe(false); // Jan 5 2025 is Sunday
  });

  it("Monday is a working day (when not a bank holiday)", () => {
    expect(isWorkingDay(new Date(2025, 0, 6))).toBe(true); // Jan 6 2025 is Monday
  });

  it("Friday is a working day (when not a bank holiday)", () => {
    expect(isWorkingDay(new Date(2025, 0, 3))).toBe(true); // Jan 3 2025 is Friday
  });

  it("New Year's Day is a bank holiday", () => {
    expect(isBankHoliday(new Date(2025, 0, 1))).toBe(true);
    expect(isWorkingDay(new Date(2025, 0, 1))).toBe(false);
  });

  it("Christmas Day is a bank holiday", () => {
    expect(isBankHoliday(new Date(2025, 11, 25))).toBe(true);
  });

  it("Good Friday 2025 is a bank holiday", () => {
    expect(isBankHoliday(new Date(2025, 3, 18))).toBe(true); // April 18, 2025
  });

  it("Regular Tuesday is not a bank holiday", () => {
    expect(isBankHoliday(new Date(2025, 0, 7))).toBe(false); // Jan 7 2025
  });
});

describe("Weekend Detection", () => {
  it("identifies Saturday as weekend", () => {
    expect(isWeekend(new Date(2025, 0, 4))).toBe(true);
  });

  it("identifies Sunday as weekend", () => {
    expect(isWeekend(new Date(2025, 0, 5))).toBe(true);
  });

  it("identifies Monday as not weekend", () => {
    expect(isWeekend(new Date(2025, 0, 6))).toBe(false);
  });

  it("identifies Friday as not weekend", () => {
    expect(isWeekend(new Date(2025, 0, 3))).toBe(false);
  });
});

describe("Pay Cycle Calculation", () => {
  it("returns correct cycle when before payday", () => {
    // Jan 10, 2025: before Jan 17 payday
    const cycle = getPayCycleForDate(new Date(2025, 0, 10));
    
    // Previous payday was Dec 19, 2024 (Dec 20 is Friday)
    expect(cycle.start.getMonth()).toBe(11); // December
    expect(cycle.start.getDate()).toBe(20); // Dec 20, 2024 (Friday)
    
    // Current payday is Jan 17, 2025
    expect(cycle.end.getDate()).toBe(16); // Day before Jan 17
    expect(cycle.end.getMonth()).toBe(0); // January
  });

  it("returns correct cycle when after payday", () => {
    // Jan 20, 2025: after Jan 17 payday
    const cycle = getPayCycleForDate(new Date(2025, 0, 20));
    
    // Current cycle starts Jan 17
    expect(cycle.start.getMonth()).toBe(0); // January
    expect(cycle.start.getDate()).toBe(17);
    
    // Ends day before Feb payday (Feb 20, 2025 is Thursday, so payday is 20th)
    expect(cycle.end.getMonth()).toBe(1); // February
    expect(cycle.end.getDate()).toBe(19);
  });
});
