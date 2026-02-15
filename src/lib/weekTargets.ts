import { startOfWeek, addDays, format, getDay, isSunday, addWeeks, subWeeks } from "date-fns";

export type PlanMode = "maintain" | "mild_loss" | "loss" | "extreme_loss";
export type ZigzagSchedule = "schedule_1" | "schedule_2";

export interface WeeklyCalorieSchedule {
  monday: number;
  tuesday: number;
  wednesday: number;
  thursday: number;
  friday: number;
  saturday: number;
  sunday: number;
}

export interface PlanModeConfig {
  label: string;
  weeklyDeficitKg: number;
  dailyCalorieAdjustment: number; // negative for deficit, positive for surplus
}

export const PLAN_MODES: Record<PlanMode, PlanModeConfig> = {
  maintain: {
    label: "Maintain",
    weeklyDeficitKg: 0,
    dailyCalorieAdjustment: 0,
  },
  mild_loss: {
    label: "Mild Weight Loss",
    weeklyDeficitKg: 0.25,
    dailyCalorieAdjustment: -250, // 0.25kg/week ≈ 250 kcal/day deficit (matches calculator.net)
  },
  loss: {
    label: "Weight Loss",
    weeklyDeficitKg: 0.5,
    dailyCalorieAdjustment: -500, // 0.5kg/week ≈ 500 kcal/day deficit (matches calculator.net)
  },
  extreme_loss: {
    label: "Extreme Weight Loss",
    weeklyDeficitKg: 1.0,
    dailyCalorieAdjustment: -1000, // 1kg/week ≈ 1000 kcal/day deficit
  },
};

/**
 * Gets the Monday that starts a meal plan week for a given date.
 * Meal plan weeks are Mon-Sun.
 */
export function getWeekStartMonday(date: Date): Date {
  // startOfWeek with weekStartsOn: 1 gives us Monday
  return startOfWeek(date, { weekStartsOn: 1 });
}

/**
 * Given a Sunday weigh-in date, returns the next Monday for the upcoming week's targets.
 * If today is Sunday, the next week starts tomorrow (Monday).
 * If today is any other day, returns the next upcoming Monday.
 */
export function getNextWeekStartFromSundayWeighIn(today: Date): Date {
  if (isSunday(today)) {
    // Next Monday is tomorrow
    return addDays(today, 1);
  }
  // Find the next Monday
  const dayOfWeek = getDay(today);
  // Days until Monday: if Monday=1, Tuesday=2, etc.
  // Monday=1: (8-1)%7 = 0 days... but we want next Monday, so 7
  // Actually: (1 - dayOfWeek + 7) % 7, but if result is 0, use 7
  let daysUntilMonday = (1 - dayOfWeek + 7) % 7;
  if (daysUntilMonday === 0) daysUntilMonday = 7; // Already Monday, go to next
  return addDays(today, daysUntilMonday);
}

/**
 * Builds a flat daily calorie schedule for a week without zigzag.
 */
export function buildFlatSchedule(dailyCalories: number): WeeklyCalorieSchedule {
  return {
    monday: dailyCalories,
    tuesday: dailyCalories,
    wednesday: dailyCalories,
    thursday: dailyCalories,
    friday: dailyCalories,
    saturday: dailyCalories,
    sunday: dailyCalories,
  };
}

/**
 * Builds a zigzag schedule based on the selected plan and schedule type.
 * 
 * Schedule 1 (High Weekend): Higher calories on Sat+Sun, lower Mon-Fri
 * Schedule 2 (Varied): Alternating pattern throughout the week
 * 
 * Both maintain the same weekly average.
 */
export function buildZigzagSchedule(
  tdee: number,
  planMode: PlanMode,
  scheduleType: ZigzagSchedule
): WeeklyCalorieSchedule {
  const adjustment = PLAN_MODES[planMode].dailyCalorieAdjustment;
  const targetDaily = Math.round(tdee + adjustment);
  const weeklyTotal = targetDaily * 7;

  if (scheduleType === "schedule_1") {
    // Calculator.net Schedule 1: Weekend days = maintenance TDEE,
    // Weekdays absorb the full weekly deficit.
    const highDay = Math.round(tdee); // maintenance on Sat + Sun
    const weekdayTotal = weeklyTotal - highDay * 2;
    const lowDay = Math.round(weekdayTotal / 5);
    
    return {
      monday: lowDay,
      tuesday: lowDay,
      wednesday: lowDay,
      thursday: lowDay,
      friday: lowDay,
      saturday: highDay,
      sunday: highDay,
    };
  } else {
    // Schedule 2: Varied pattern - alternating high/low throughout week
    const low = Math.round(targetDaily * 0.85);
    const med = targetDaily;
    const high = Math.round(targetDaily * 1.15);
    
    // Adjust to hit weekly total
    const rawTotal = low * 2 + med * 3 + high * 2;
    const diff = weeklyTotal - rawTotal;
    const medAdjusted = med + Math.round(diff / 3);
    
    return {
      monday: low,
      tuesday: medAdjusted,
      wednesday: low,
      thursday: medAdjusted,
      friday: high,
      saturday: high,
      sunday: medAdjusted,
    };
  }
}

/**
 * Calculates the target daily calories for a given plan mode.
 */
export function getTargetCaloriesForPlan(tdee: number, planMode: PlanMode): number {
  const adjustment = PLAN_MODES[planMode].dailyCalorieAdjustment;
  return Math.round(tdee + adjustment);
}

/**
 * Gets the weekly average from a calorie schedule.
 */
export function getWeeklyAverage(schedule: WeeklyCalorieSchedule): number {
  const total = schedule.monday + schedule.tuesday + schedule.wednesday + 
                schedule.thursday + schedule.friday + schedule.saturday + schedule.sunday;
  return Math.round(total / 7);
}

/**
 * Gets calories for a specific date from a weekly schedule.
 */
export function getCaloriesForDate(date: Date, schedule: WeeklyCalorieSchedule): number {
  const dayOfWeek = getDay(date); // 0=Sun, 1=Mon, ...
  
  switch (dayOfWeek) {
    case 0: return schedule.sunday;
    case 1: return schedule.monday;
    case 2: return schedule.tuesday;
    case 3: return schedule.wednesday;
    case 4: return schedule.thursday;
    case 5: return schedule.friday;
    case 6: return schedule.saturday;
    default: return schedule.monday;
  }
}

/**
 * Formats a week start date as a label.
 */
export function formatWeekLabel(weekStart: Date): string {
  const weekEnd = addDays(weekStart, 6);
  return `${format(weekStart, "d MMM")} – ${format(weekEnd, "d MMM yyyy")}`;
}

/**
 * Gets the day name for a day index (0-6, where 0 is Sunday).
 */
export function getDayName(dayIndex: number): string {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return days[dayIndex] || "Monday";
}

/**
 * Converts a WeeklyCalorieSchedule to an array of { day, calories } for display.
 */
export function scheduleToArray(schedule: WeeklyCalorieSchedule): { day: string; calories: number }[] {
  return [
    { day: "Monday", calories: schedule.monday },
    { day: "Tuesday", calories: schedule.tuesday },
    { day: "Wednesday", calories: schedule.wednesday },
    { day: "Thursday", calories: schedule.thursday },
    { day: "Friday", calories: schedule.friday },
    { day: "Saturday", calories: schedule.saturday },
    { day: "Sunday", calories: schedule.sunday },
  ];
}
