import { ASSUMPTIONS, INITIAL_VALUES, SCENARIO_REVENUE_INITIAL } from "./yakiniku-assumptions";
import type { Values } from "./yakiniku-model";

export interface ScenarioState {
  values: Values;
  scenarioRevenue: number;
}

const STORAGE_KEY = "yakiniku-simulator-scenario-v1";
const cleanValues = (value: unknown): Values => {
  const next = { ...INITIAL_VALUES };
  if (value && typeof value === "object") {
    for (const assumption of ASSUMPTIONS) {
      const raw = (value as Record<string, unknown>)[assumption.id];
      if (typeof raw === "number" && Number.isFinite(raw)) next[assumption.id] = raw;
    }
  }
  next.p26 = 60;
  return next;
};

export function loadScenario(): ScenarioState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { values: { ...INITIAL_VALUES }, scenarioRevenue: SCENARIO_REVENUE_INITIAL };
    const saved = JSON.parse(raw) as Partial<ScenarioState>;
    return {
      values: cleanValues(saved.values),
      scenarioRevenue: typeof saved.scenarioRevenue === "number" && Number.isFinite(saved.scenarioRevenue)
        ? Math.max(0, saved.scenarioRevenue)
        : SCENARIO_REVENUE_INITIAL,
    };
  } catch {
    return { values: { ...INITIAL_VALUES }, scenarioRevenue: SCENARIO_REVENUE_INITIAL };
  }
}

export function saveScenario(state: ScenarioState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...state,
      values: { ...state.values, p26: 60 },
    }));
    return true;
  } catch {
    return false;
  }
}

export function restoreScenario(): ScenarioState {
  const state = { values: { ...INITIAL_VALUES }, scenarioRevenue: SCENARIO_REVENUE_INITIAL };
  saveScenario(state);
  return state;
}
