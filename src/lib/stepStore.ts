const LEGACY_STORAGE_KEY = "nutrio_step_data";
const STORAGE_PREFIX = "nutrio:step-data:v2:";

export interface StepDay {
  date: string;
  steps: number;
  synced: boolean;
}

export interface StepData {
  dailyGoal: number;
  history: StepDay[];
  today: StepDay;
}

const DEFAULT_GOAL = 8000;

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function defaultStepData(): StepData {
  return {
    dailyGoal: DEFAULT_GOAL,
    history: [],
    today: { date: todayStr(), steps: 0, synced: false },
  };
}

function storageKey(userId: string | null | undefined): string | null {
  return userId && /^[A-Za-z0-9_-]{1,160}$/.test(userId)
    ? `${STORAGE_PREFIX}${userId}`
    : null;
}

function normalizeStepData(value: unknown): StepData | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Partial<StepData>;
  if (
    !Number.isFinite(candidate.dailyGoal) || Number(candidate.dailyGoal) < 1_000 ||
    Number(candidate.dailyGoal) > 50_000 || !candidate.today ||
    typeof candidate.today.date !== "string" ||
    !Number.isFinite(candidate.today.steps) || Number(candidate.today.steps) < 0 ||
    Number(candidate.today.steps) > 1_000_000 ||
    typeof candidate.today.synced !== "boolean" || !Array.isArray(candidate.history)
  ) {
    return null;
  }
  const history = candidate.history.filter((day): day is StepDay => Boolean(
    day && typeof day.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day.date) &&
    Number.isFinite(day.steps) && day.steps >= 0 && day.steps <= 1_000_000 &&
    typeof day.synced === "boolean"
  )).slice(-30);
  return {
    dailyGoal: Math.round(Number(candidate.dailyGoal)),
    history,
    today: {
      date: candidate.today.date,
      steps: Math.round(Number(candidate.today.steps)),
      synced: candidate.today.synced,
    },
  };
}

export function getStepData(userId?: string | null): StepData {
  if (typeof localStorage === "undefined") return defaultStepData();
  localStorage.removeItem(LEGACY_STORAGE_KEY);
  const key = storageKey(userId);
  if (!key) return defaultStepData();
  const raw = localStorage.getItem(key);
  if (raw) {
    try {
      const data = normalizeStepData(JSON.parse(raw));
      if (!data) throw new Error("invalid_step_data");
      if (data.today.date !== todayStr()) {
        data.history = [...data.history, data.today].slice(-30);
        data.today = { date: todayStr(), steps: 0, synced: false };
        saveStepData(userId, data);
      }
      return data;
    } catch { /* fall through */ }
  }
  return defaultStepData();
}

export function saveStepData(userId: string | null | undefined, data: StepData): void {
  const key = storageKey(userId);
  const normalized = normalizeStepData(data);
  if (!key || !normalized || typeof localStorage === "undefined") return;
  localStorage.setItem(key, JSON.stringify(normalized));
}

export function updateSteps(userId: string, steps: number, synced: boolean): StepData {
  const data = getStepData(userId);
  data.today = {
    date: todayStr(),
    steps: Math.max(0, Math.min(1_000_000, Math.round(steps))),
    synced,
  };
  saveStepData(userId, data);
  return data;
}

export function setDailyGoal(userId: string, goal: number): StepData {
  const data = getStepData(userId);
  data.dailyGoal = Math.max(1000, Math.min(50000, goal));
  saveStepData(userId, data);
  return data;
}

export function mergeHealthSteps(userId: string, healthSteps: number | null): StepData {
  if (healthSteps === null || healthSteps === undefined) return getStepData(userId);
  const data = getStepData(userId);
  if (healthSteps > data.today.steps) {
    data.today = {
      date: todayStr(),
      steps: Math.max(0, Math.min(1_000_000, Math.round(healthSteps))),
      synced: true,
    };
    saveStepData(userId, data);
  }
  return data;
}

export function clearStepData(userId: string): void {
  const key = storageKey(userId);
  if (key && typeof localStorage !== "undefined") localStorage.removeItem(key);
}
