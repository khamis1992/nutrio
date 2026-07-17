import { addDays, differenceInCalendarDays, format } from "date-fns";

import type { ScheduleMealInput } from "@/lib/schedule-meals";

const LEGACY_STORAGE_KEY = "nutrio:schedule-templates:v1";
const STORAGE_PREFIX = "nutrio:schedule-templates:v2:";

export interface ScheduleTemplateSource {
  scheduled_date: string;
  meal_type: string;
  meal_id: string;
  delivery_time_slot?: string | null;
  meal?: {
    name?: string;
    calories?: number;
    protein_g?: number;
  };
}

export interface ScheduleTemplateSlot {
  dayOffset: number;
  mealId: string;
  mealName: string;
  mealType: ScheduleMealInput["meal_type"];
  deliveryTimeSlot?: string | null;
  calories: number;
  proteinG: number;
}

export interface ScheduleTemplate {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
  slots: ScheduleTemplateSlot[];
}

const storageKey = (userId: string) => `${STORAGE_PREFIX}${userId}`;

const readAll = (userId: string): ScheduleTemplate[] => {
  if (typeof localStorage === "undefined") return [];
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    const parsed = JSON.parse(localStorage.getItem(storageKey(userId)) || "[]");
    return Array.isArray(parsed)
      ? parsed.filter((template) => template?.userId === userId).slice(-12)
      : [];
  } catch {
    return [];
  }
};

const writeAll = (userId: string, templates: ScheduleTemplate[]) => {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(storageKey(userId), JSON.stringify(templates.slice(-12)));
};

export function listScheduleTemplates(userId: string): ScheduleTemplate[] {
  return readAll(userId);
}

export function saveScheduleTemplate(
  userId: string,
  name: string,
  weekStart: Date,
  schedules: ScheduleTemplateSource[],
): ScheduleTemplate {
  const normalizedName = name.trim().slice(0, 60);
  if (!normalizedName) throw new Error("TEMPLATE_NAME_REQUIRED");
  if (schedules.length === 0) throw new Error("TEMPLATE_MEALS_REQUIRED");

  const slots = schedules.map((schedule) => {
    const mealType = schedule.meal_type as ScheduleMealInput["meal_type"];
    if (!(["breakfast", "lunch", "dinner", "snack"] as string[]).includes(mealType)) {
      throw new Error("INVALID_TEMPLATE_MEAL_TYPE");
    }
    const dayOffset = differenceInCalendarDays(new Date(`${schedule.scheduled_date}T12:00:00`), weekStart);
    if (dayOffset < 0 || dayOffset > 6) throw new Error("TEMPLATE_DATE_OUTSIDE_WEEK");

    return {
      dayOffset,
      mealId: schedule.meal_id,
      mealName: schedule.meal?.name || "Meal",
      mealType,
      deliveryTimeSlot: schedule.delivery_time_slot,
      calories: Number(schedule.meal?.calories || 0),
      proteinG: Number(schedule.meal?.protein_g || 0),
    };
  });

  const template: ScheduleTemplate = {
    id: crypto.randomUUID(),
    userId,
    name: normalizedName,
    createdAt: new Date().toISOString(),
    slots,
  };
  writeAll(userId, [...readAll(userId), template]);
  return template;
}

export function deleteScheduleTemplate(userId: string, templateId: string) {
  writeAll(userId, readAll(userId).filter((template) => template.id !== templateId));
}

export function clearScheduleTemplatesForUser(userId: string): void {
  if (typeof localStorage !== "undefined") localStorage.removeItem(storageKey(userId));
}

export function templateToScheduleItems(template: ScheduleTemplate, targetWeekStart: Date): ScheduleMealInput[] {
  return template.slots.map((slot) => ({
    meal_id: slot.mealId,
    scheduled_date: format(addDays(targetWeekStart, slot.dayOffset), "yyyy-MM-dd"),
    meal_type: slot.mealType,
    delivery_time_slot: slot.deliveryTimeSlot,
    schedule_source: "customer",
  }));
}
