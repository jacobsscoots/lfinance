// Dev-only debug helpers to prove whether solver totals/targets match UI totals/targets.
// This file is intentionally side-effect free; callers decide when to log/store.

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

function isDebugEnabled(): boolean {
  if (!import.meta.env.DEV) return false;
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

export function storePortioningSolverDebug(payload: PortioningSolverDebugPayload) {
  if (!isDebugEnabled()) return;
  getStore()[payload.mealDate] = payload;
}

export function readPortioningSolverDebug(mealDate: string): PortioningSolverDebugPayload | null {
  const store = getStore();
  return store[mealDate] ?? null;
}

export function logPortioningUiComparison(args: {
  mealDate: string;
  uiTargets: PortioningDebugTotals;
  uiAchieved: PortioningDebugTotals;
  uiItems: PortioningDebugItem[];
}) {
  if (!isDebugEnabled()) return;

  const solver = readPortioningSolverDebug(args.mealDate);
  // eslint-disable-next-line no-console
  console.groupCollapsed(`[portioning debug] ${args.mealDate}`);
  // eslint-disable-next-line no-console
  console.log("UI targets:", args.uiTargets);
  // eslint-disable-next-line no-console
  console.log("UI achieved:", args.uiAchieved);
  // eslint-disable-next-line no-console
  console.log("UI items:", args.uiItems);

  if (!solver) {
    // eslint-disable-next-line no-console
    console.warn("No solver debug payload stored for this date (toggle localStorage debug_portioning=1 BEFORE generating).");
    // eslint-disable-next-line no-console
    console.groupEnd();
    return;
  }

  // eslint-disable-next-line no-console
  console.log("Solver targets:", solver.targets);
  // eslint-disable-next-line no-console
  console.log("Solver achieved:", solver.achieved);
  // eslint-disable-next-line no-console
  console.log("Solver warnings:", solver.warnings);
  if (solver.phases?.length) {
    // eslint-disable-next-line no-console
    console.log("Solver phases:", solver.phases);
  }

  const diff = (a: number, b: number) => Math.round((a - b) * 1000) / 1000;
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
  console.log("Δ achieved (UI - solver):", totalsDelta);
  // eslint-disable-next-line no-console
  console.log("Δ targets (UI - solver):", targetsDelta);
  // eslint-disable-next-line no-console
  console.groupEnd();
}
