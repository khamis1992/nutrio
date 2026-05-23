import { formatInTimeZone, toZonedTime } from "date-fns-tz";

export const QATAR_TIMEZONE = "Asia/Qatar";

export function getQatarDate(date: Date = new Date()): Date {
  return toZonedTime(date, QATAR_TIMEZONE);
}

export function getQatarDay(date: Date = new Date()): string {
  return formatInTimeZone(date, QATAR_TIMEZONE, "yyyy-MM-dd");
}

export function getQatarNow(): Date {
  return toZonedTime(new Date(), QATAR_TIMEZONE);
}

export function isQatarToday(dateStr: string): boolean {
  return dateStr === getQatarDay();
}

export function getWeekStartDay(locale?: string): number {
  if (locale === "ar" || locale?.startsWith("ar")) return 6;
  return 1;
}

export const WEEK_DAYS_SATURDAY = [6, 0, 1, 2, 3, 4, 5];
export const WEEK_DAYS_MONDAY = [1, 2, 3, 4, 5, 6, 0];

/** Format a date using the user's locale — Arabic gets ar-QA, English gets en-US */
export function formatLocaleDate(
  date: Date | string | number,
  language: string,
  options: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }
): string {
  const locale = language === "ar" ? "ar-QA" : "en-US";
  return new Date(date).toLocaleDateString(locale, options);
}
