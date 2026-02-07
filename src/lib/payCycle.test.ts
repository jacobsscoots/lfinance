import { describe, it, expect } from "vitest";
import { 
  getPayCycleForDate, 
  getNextPayCycle, 
  getPrevPayCycle, 
  formatPayCycleLabel 
} from "./payCycle";
import { PaydaySettings } from "./payday";

const defaultSettings: PaydaySettings = {
  paydayDate: 20,
  adjustmentRule: "previous_working_day",
};

describe("getPayCycleForDate", () => {
  it("returns correct cycle for date after payday", () => {
    // 25 Feb 2026 is after the 20th
    const date = new Date(2026, 1, 25); // Feb 25, 2026
    const cycle = getPayCycleForDate(date, defaultSettings);
    
    // Should start on Feb 20, 2026 (Friday - working day)
    expect(cycle.start.getDate()).toBe(20);
    expect(cycle.start.getMonth()).toBe(1); // February
    
    // Should end on Mar 19, 2026 (day before Mar 20)
    expect(cycle.end.getDate()).toBe(19);
    expect(cycle.end.getMonth()).toBe(2); // March
  });

  it("returns correct cycle for date before payday", () => {
    // 10 Feb 2026 is before the 20th
    const date = new Date(2026, 1, 10); // Feb 10, 2026
    const cycle = getPayCycleForDate(date, defaultSettings);
    
    // Should start on Jan 20, 2026
    expect(cycle.start.getMonth()).toBe(0); // January
    expect(cycle.start.getDate()).toBe(20);
    
    // Should end on Feb 19, 2026
    expect(cycle.end.getMonth()).toBe(1); // February
    expect(cycle.end.getDate()).toBe(19);
  });

  it("returns correct cycle when date is exactly on payday", () => {
    // Feb 20, 2026 is a Friday (working day)
    const date = new Date(2026, 1, 20);
    const cycle = getPayCycleForDate(date, defaultSettings);
    
    // Should be part of the cycle starting Feb 20
    expect(cycle.start.getDate()).toBe(20);
    expect(cycle.start.getMonth()).toBe(1);
  });

  it("handles weekend payday adjustment", () => {
    // Sept 20, 2026 is a Sunday - should adjust to Friday Sept 18
    const date = new Date(2026, 8, 25); // Sept 25, 2026
    const cycle = getPayCycleForDate(date, defaultSettings);
    
    // With previous_working_day, Sept 20 (Sun) -> Sept 18 (Fri)
    expect(cycle.start.getDate()).toBe(18);
    expect(cycle.start.getMonth()).toBe(8); // September
  });
});

describe("getNextPayCycle", () => {
  it("returns the next pay cycle", () => {
    const currentCycle = getPayCycleForDate(new Date(2026, 1, 25), defaultSettings);
    const nextCycle = getNextPayCycle(currentCycle, defaultSettings);
    
    // Current ends Mar 19, next should start Mar 20
    expect(nextCycle.start.getMonth()).toBe(2); // March
    expect(nextCycle.start.getDate()).toBe(20);
  });
});

describe("getPrevPayCycle", () => {
  it("returns the previous pay cycle", () => {
    const currentCycle = getPayCycleForDate(new Date(2026, 1, 25), defaultSettings);
    const prevCycle = getPrevPayCycle(currentCycle, defaultSettings);
    
    // Current starts Feb 20, prev should start Jan 20
    expect(prevCycle.start.getMonth()).toBe(0); // January
    expect(prevCycle.start.getDate()).toBe(20);
  });
});

describe("formatPayCycleLabel", () => {
  it("formats cycle label correctly", () => {
    const cycle = {
      start: new Date(2026, 1, 17), // Feb 17
      end: new Date(2026, 2, 16), // Mar 16
    };
    
    const label = formatPayCycleLabel(cycle);
    expect(label).toBe("17 Feb → 16 Mar 2026");
  });
});
