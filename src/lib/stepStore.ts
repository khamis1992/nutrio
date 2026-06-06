const STORAGE_KEY = "nutrio_step_data";

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

export function getStepData(): StepData {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const data = JSON.parse(raw) as StepData;
      if (data.today.date !== todayStr()) {
        data.history = [...data.history, data.today].slice(-30);
        data.today = { date: todayStr(), steps: 0, synced: false };
      }
      return data;
    } catch { /* fall through */ }
  }
  return {
    dailyGoal: DEFAULT_GOAL,
    history: [],
    today: { date: todayStr(), steps: 0, synced: false },
  };
}

export function saveStepData(data: StepData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function updateSteps(steps: number, synced: boolean): StepData {
  const data = getStepData();
  data.today = { date: todayStr(), steps, synced };
  saveStepData(data);
  return data;
}

export function setDailyGoal(goal: number): StepData {
  const data = getStepData();
  data.dailyGoal = Math.max(1000, Math.min(50000, goal));
  saveStepData(data);
  return data;
}

export function mergeHealthSteps(healthSteps: number | null): StepData {
  if (healthSteps === null || healthSteps === undefined) return getStepData();
  const data = getStepData();
  if (healthSteps > data.today.steps) {
    data.today = { date: todayStr(), steps: healthSteps, synced: true };
    saveStepData(data);
  }
  return data;
}
