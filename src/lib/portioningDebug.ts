// Debug helpers to prove whether solver totals/targets match UI totals/targets.
// Works in ANY environment when localStorage.debug_portioning === "1"

export type PortioningDebugTotals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type PortioningDebugItem = {
  itemId: string;
  name: string;
  mealType?: string;
  grams: number;
  per100g: PortioningDebugTotals;
  contribution: PortioningDebugTotals;
  flags: {
    locked: boolean;
    fixed: boolean;
    ignored: boolean;
    seasoningLike: boolean;
  };
  constraints?: {
    minGrams: number;
    maxGrams: number;
  };
};

export type PortioningSolverDebugPayload = {
  mealDate: string;
  targets: PortioningDebugTotals;
  achieved: PortioningDebugTotals;
  warnings: string[];
  items: PortioningDebugItem[];
  phases?: Array<{ name: string; achieved: PortioningDebugTotals }>;
  createdAt: string;
};

/** Check if debug mode is enabled - works in ANY environment */
function isDebugEnabled(): boolean {
  try {
    return localStorage.getItem("debug_portioning") === "1";
  } catch {
    return false;
  }
}

function getStore(): Record<string, PortioningSolverDebugPayload> {
  const w = window as any;
  if (!w.__portioningDebug) w.__portioningDebug = {};
  return w.__portioningDebug;
}

/** Store solver debug payload immediately after calculation */
export function storePortioningSolverDebug(payload: PortioningSolverDebugPayload) {
  if (!isDebugEnabled()) return;
  getStore()[payload.mealDate] = payload;
  
  // IMMEDIATE log so we can see solver output right away
  // eslint-disable-next-line no-console
  console.log(`%c[SOLVER DEBUG] ${payload.mealDate}`, "background: #4CAF50; color: white; padding: 2px 6px; border-radius: 3px;");
  // eslint-disable-next-line no-console
  console.log("  Targets:", payload.targets);
  // eslint-disable-next-line no-console
  console.log("  Achieved:", payload.achieved);
  // eslint-disable-next-line no-console
  console.log("  Warnings:", payload.warnings);
  // eslint-disable-next-line no-console
  console.table(payload.items.map(i => ({
    name: i.name.substring(0, 30),
    grams: i.grams,
    kcal: Math.round(i.contribution.calories),
    P: Math.round(i.contribution.protein * 10) / 10,
    C: Math.round(i.contribution.carbs * 10) / 10,
    F: Math.round(i.contribution.fat * 10) / 10,
    locked: i.flags.locked ? "🔒" : "",
    fixed: i.flags.fixed ? "📌" : "",
  })));
}

export function readPortioningSolverDebug(mealDate: string): PortioningSolverDebugPayload | null {
  const store = getStore();
  return store[mealDate] ?? null;
}

/** Compare UI totals with solver totals - called when modal opens */
export function logPortioningUiComparison(args: {
  mealDate: string;
  uiTargets: PortioningDebugTotals;
  uiAchieved: PortioningDebugTotals;
  uiItems: PortioningDebugItem[];
}) {
  if (!isDebugEnabled()) return;

  // eslint-disable-next-line no-console
  console.log(`%c[UI DEBUG] ${args.mealDate} - Modal Opened`, "background: #2196F3; color: white; padding: 2px 6px; border-radius: 3px;");

  const solver = readPortioningSolverDebug(args.mealDate);
  
  // eslint-disable-next-line no-console
  console.log("=== UI VALUES ===");
  // eslint-disable-next-line no-console
  console.log("  UI Targets:", args.uiTargets);
  // eslint-disable-next-line no-console
  console.log("  UI Achieved:", args.uiAchieved);
  // eslint-disable-next-line no-console
  console.table(args.uiItems.map(i => ({
    name: i.name.substring(0, 30),
    grams: i.grams,
    kcal: Math.round(i.contribution.calories),
    P: Math.round(i.contribution.protein * 10) / 10,
    C: Math.round(i.contribution.carbs * 10) / 10,
    F: Math.round(i.contribution.fat * 10) / 10,
    locked: i.flags.locked ? "🔒" : "",
    fixed: i.flags.fixed ? "📌" : "",
  })));

  if (!solver) {
    // eslint-disable-next-line no-console
    console.warn("⚠️ No solver debug payload stored for this date. Make sure to set localStorage.debug_portioning='1' BEFORE clicking Generate Portions.");
    return;
  }

  // eslint-disable-next-line no-console
  console.log("=== SOLVER VALUES ===");
  // eslint-disable-next-line no-console
  console.log("  Solver Targets:", solver.targets);
  // eslint-disable-next-line no-console
  console.log("  Solver Achieved:", solver.achieved);
  // eslint-disable-next-line no-console
  console.log("  Solver Warnings:", solver.warnings);

  // Calculate deltas
  const diff = (a: number, b: number) => Math.round((a - b) * 100) / 100;
  const totalsDelta = {
    calories: diff(args.uiAchieved.calories, solver.achieved.calories),
    protein: diff(args.uiAchieved.protein, solver.achieved.protein),
    carbs: diff(args.uiAchieved.carbs, solver.achieved.carbs),
    fat: diff(args.uiAchieved.fat, solver.achieved.fat),
  };
  const targetsDelta = {
    calories: diff(args.uiTargets.calories, solver.targets.calories),
    protein: diff(args.uiTargets.protein, solver.targets.protein),
    carbs: diff(args.uiTargets.carbs, solver.targets.carbs),
    fat: diff(args.uiTargets.fat, solver.targets.fat),
  };

  // eslint-disable-next-line no-console
  console.log("=== DELTA (UI - Solver) ===");
  // eslint-disable-next-line no-console
  console.log("  Δ Targets:", targetsDelta);
  // eslint-disable-next-line no-console
  console.log("  Δ Achieved:", totalsDelta);

  // Highlight mismatch
  const hasMismatch = Object.values(totalsDelta).some(v => Math.abs(v) > 0.5) ||
                      Object.values(targetsDelta).some(v => Math.abs(v) > 0.5);
  if (hasMismatch) {
    // eslint-disable-next-line no-console
    console.warn("🚨 MISMATCH DETECTED between UI and Solver values!");
  } else {
    // eslint-disable-next-line no-console
    console.log("✅ UI and Solver values match within 0.5 tolerance");
  }
}
