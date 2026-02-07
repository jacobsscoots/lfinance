import { describe, it, expect } from "vitest";
import {
  calculateSafeToSpend,
  calculateProjectedEndBalance,
  calculateNetPosition,
  checkRunwayRisk,
  buildDailySpendingData,
  generateAlerts,
  formatCurrency,
  getValueColorClass,
  getSafeToSpendColor,
  type PayCycleMetrics,
} from "./dashboardCalculations";

describe("calculateSafeToSpend", () => {
  it("returns positive when balance exceeds committed", () => {
    const result = calculateSafeToSpend(1000, 400, 10);
    expect(result).toBe(60); // (1000 - 400) / 10
  });

  it("returns 0 when balance equals committed", () => {
    const result = calculateSafeToSpend(500, 500, 10);
    expect(result).toBe(0);
  });

  it("returns 0 when balance is less than committed", () => {
    const result = calculateSafeToSpend(300, 500, 10);
    expect(result).toBe(0);
  });

  it("handles 0 days remaining", () => {
    const result = calculateSafeToSpend(1000, 400, 0);
    expect(result).toBe(0);
  });

  it("handles negative days remaining", () => {
    const result = calculateSafeToSpend(1000, 400, -5);
    expect(result).toBe(0);
  });
});

describe("calculateProjectedEndBalance", () => {
  it("projects based on current spending pace", () => {
    // Spent £200 in 5 days, 10 days remaining, £100 committed
    const result = calculateProjectedEndBalance(1000, 200, 5, 10, 100);
    
    // Best: 1000 - 100 = 900
    expect(result.best).toBe(900);
    
    // Expected: 1000 - 100 - (40 * 10) = 500
    expect(result.expected).toBe(500);
    
    // Worst: 1000 - 100 - (40 * 10 * 1.5) = 300
    expect(result.worst).toBe(300);
  });

  it("accounts for committed spending", () => {
    const result = calculateProjectedEndBalance(500, 0, 0, 10, 300);
    expect(result.best).toBe(200); // 500 - 300
  });

  it("best case assumes zero additional discretionary spend", () => {
    const result = calculateProjectedEndBalance(1000, 500, 5, 5, 200);
    expect(result.best).toBe(800); // 1000 - 200 only
  });

  it("handles zero days passed", () => {
    const result = calculateProjectedEndBalance(1000, 0, 0, 10, 200);
    expect(result.best).toBe(800);
    expect(result.expected).toBe(800); // No spending pace yet
    expect(result.worst).toBe(800);
  });
});

describe("calculateNetPosition", () => {
  it("returns positive for surplus", () => {
    expect(calculateNetPosition(2000, 1500)).toBe(500);
  });

  it("returns negative for deficit", () => {
    expect(calculateNetPosition(1500, 2000)).toBe(-500);
  });

  it("returns zero for breakeven", () => {
    expect(calculateNetPosition(1500, 1500)).toBe(0);
  });
});

describe("checkRunwayRisk", () => {
  it("returns true when daily discretionary below threshold", () => {
    // £50 for 10 days = £5/day < £10 threshold
    expect(checkRunwayRisk(50, 10)).toBe(true);
  });

  it("returns false when daily discretionary above threshold", () => {
    // £200 for 10 days = £20/day > £10 threshold
    expect(checkRunwayRisk(200, 10)).toBe(false);
  });

  it("returns false when at exactly threshold", () => {
    // £100 for 10 days = £10/day = threshold
    expect(checkRunwayRisk(100, 10)).toBe(false);
  });

  it("returns false when 0 days remaining", () => {
    expect(checkRunwayRisk(50, 0)).toBe(false);
  });

  it("respects custom threshold", () => {
    // £100 for 10 days = £10/day, threshold £15
    expect(checkRunwayRisk(100, 10, 15)).toBe(true);
  });
});

describe("buildDailySpendingData", () => {
  it("builds array for cycle length", () => {
    const cycle = {
      start: new Date("2024-01-01"),
      end: new Date("2024-01-10"),
    };
    
    const result = buildDailySpendingData(cycle, [], 1000);
    expect(result).toHaveLength(10);
  });

  it("calculates expected daily budget", () => {
    const cycle = {
      start: new Date("2024-01-01"),
      end: new Date("2024-01-10"),
    };
    
    const result = buildDailySpendingData(cycle, [], 1000);
    expect(result[0].expected).toBe(100); // 1000 / 10
  });

  it("calculates cumulative expected correctly", () => {
    const cycle = {
      start: new Date("2024-01-01"),
      end: new Date("2024-01-05"),
    };
    
    const result = buildDailySpendingData(cycle, [], 500);
    expect(result[0].expectedCumulative).toBe(100);
    expect(result[4].expectedCumulative).toBe(500);
  });
});

describe("generateAlerts", () => {
  const baseMetrics: PayCycleMetrics = {
    cycleStart: new Date(),
    cycleEnd: new Date(),
    daysTotal: 30,
    daysRemaining: 15,
    daysPassed: 15,
    startBalance: 2000,
    currentBalance: 1500,
    projectedEndBalance: { best: 800, expected: 500, worst: 200 },
    totalSpent: 400,
    totalIncome: 2000,
    expectedSpentByNow: 350,
    safeToSpendPerDay: 50,
    committedRemaining: 300,
    discretionaryRemaining: 700,
    bufferAmount: 500,
    isOverPace: false,
    runwayRisk: false,
    hasData: true,
    dailySpending: [],
  };

  it("returns no-data alert when hasData is false", () => {
    const metrics = { ...baseMetrics, hasData: false };
    const alerts = generateAlerts(metrics, []);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].id).toBe("no-data");
  });

  it("generates overspend warning when significantly over pace", () => {
    const metrics = { ...baseMetrics, totalSpent: 500, expectedSpentByNow: 350 };
    const alerts = generateAlerts(metrics, []);
    expect(alerts.some(a => a.id === "over-pace")).toBe(true);
  });

  it("generates positive alert when under budget", () => {
    const metrics = { ...baseMetrics, totalSpent: 300, expectedSpentByNow: 400 };
    const alerts = generateAlerts(metrics, []);
    expect(alerts.some(a => a.id === "under-budget")).toBe(true);
  });

  it("generates runway risk alert when low discretionary", () => {
    const metrics = { 
      ...baseMetrics, 
      runwayRisk: true,
      discretionaryRemaining: 100,
      safeToSpendPerDay: 6.67,
    };
    const alerts = generateAlerts(metrics, []);
    expect(alerts.some(a => a.id === "runway-risk")).toBe(true);
  });

  it("generates negative projection alert", () => {
    const metrics = { 
      ...baseMetrics, 
      projectedEndBalance: { best: 100, expected: -200, worst: -500 },
    };
    const alerts = generateAlerts(metrics, []);
    expect(alerts.some(a => a.id === "negative-projection")).toBe(true);
  });
});

describe("formatCurrency", () => {
  it("formats positive amounts correctly", () => {
    expect(formatCurrency(1234.56)).toBe("£1,234.56");
  });

  it("formats negative amounts correctly", () => {
    expect(formatCurrency(-500)).toBe("-£500.00");
  });

  it("shows sign when requested for positive", () => {
    expect(formatCurrency(100, true)).toBe("+£100.00");
  });

  it("shows sign when requested for negative", () => {
    expect(formatCurrency(-100, true)).toBe("-£100.00");
  });

  it("does not show sign for zero", () => {
    expect(formatCurrency(0, true)).toBe("£0.00");
  });
});

describe("getValueColorClass", () => {
  it("returns green for positive values", () => {
    expect(getValueColorClass(100)).toContain("emerald");
  });

  it("returns red for negative values", () => {
    expect(getValueColorClass(-100)).toContain("red");
  });

  it("returns muted for zero", () => {
    expect(getValueColorClass(0)).toContain("muted");
  });

  it("inverts colors when inverse is true", () => {
    expect(getValueColorClass(100, true)).toContain("red");
    expect(getValueColorClass(-100, true)).toContain("emerald");
  });
});

describe("getSafeToSpendColor", () => {
  it("returns default for healthy amounts", () => {
    expect(getSafeToSpendColor(50)).toBe("default");
    expect(getSafeToSpendColor(20)).toBe("default");
  });

  it("returns warning for moderate amounts", () => {
    expect(getSafeToSpendColor(15)).toBe("warning");
    expect(getSafeToSpendColor(10)).toBe("warning");
  });

  it("returns danger for low amounts", () => {
    expect(getSafeToSpendColor(5)).toBe("danger");
    expect(getSafeToSpendColor(0)).toBe("danger");
  });
});
