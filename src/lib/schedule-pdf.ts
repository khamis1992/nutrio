import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { addDays, format } from "date-fns";

import type { ScheduleTemplate } from "@/lib/schedule-templates";

export function createSchedulePdf(template: ScheduleTemplate, weekStart: Date): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  doc.setFillColor(246, 248, 251);
  doc.rect(0, 0, 210, 297, "F");
  doc.setTextColor(2, 6, 23);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(template.name, 16, 22);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(10);
  doc.text(`Week of ${format(weekStart, "MMMM d, yyyy")}  |  ${template.slots.length} meals`, 16, 29);

  const rows = [...template.slots]
    .sort((a, b) => a.dayOffset - b.dayOffset || a.mealType.localeCompare(b.mealType))
    .map((slot) => [
      format(addDays(weekStart, slot.dayOffset), "EEE, MMM d"),
      slot.mealType[0].toUpperCase() + slot.mealType.slice(1),
      slot.mealName,
      slot.deliveryTimeSlot || "-",
      `${slot.calories} kcal`,
      `${slot.proteinG} g`,
    ]);

  autoTable(doc, {
    startY: 38,
    head: [["Day", "Type", "Meal", "Delivery", "Calories", "Protein"]],
    body: rows,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 3.5, textColor: [2, 6, 23], lineColor: [229, 234, 241] },
    headStyles: { fillColor: [2, 6, 23], textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [255, 255, 255] },
  });
  return doc;
}

export function downloadSchedulePdf(template: ScheduleTemplate, weekStart: Date) {
  const fileName = `${template.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "meal-schedule"}.pdf`;
  createSchedulePdf(template, weekStart).save(fileName);
}
