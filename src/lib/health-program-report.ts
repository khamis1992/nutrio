import { jsPDF } from "jspdf";
import type { ActiveHealthProgram, HealthProgramCheckin, HealthProgramTask } from "@/hooks/useHealthPrograms";

export function downloadHealthProgramReport({ enrollment, checkins, tasks }: { enrollment: ActiveHealthProgram; checkins: HealthProgramCheckin[]; tasks: HealthProgramTask[] }) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const left = 48;
  const width = 500;
  let y = 52;
  const line = (text: string, size = 10, color: [number, number, number] = [51, 65, 85]) => {
    doc.setFont("helvetica", size >= 16 ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(text, width);
    doc.text(lines, left, y);
    y += lines.length * (size + 4);
  };
  line("Nutrio support progress report", 20, [2, 6, 23]);
  line(enrollment.health_programs.name, 14, [124, 131, 246]);
  line(`Period: ${enrollment.start_date} to ${enrollment.target_end_date}`);
  line(`Generated: ${new Date().toLocaleString()}`);
  y += 8;
  line("Important boundary", 14, [2, 6, 23]);
  line("This user-controlled report contains self-tracked nutrition, activity, and symptom information. Nutrio does not diagnose, prescribe, recommend a dose, or replace the prescribing clinician.");
  y += 8;
  line("Program activity", 14, [2, 6, 23]);
  line(`Completed task records: ${tasks.length}`);
  line(`Strength task records: ${tasks.filter((item) => item.task_type === "strength").length}`);
  line(`Hydration task records: ${tasks.filter((item) => item.task_type === "hydration").length}`);
  line(`Check-in days: ${checkins.length}`);
  y += 8;
  line("Recent self-tracked check-ins", 14, [2, 6, 23]);
  if (checkins.length === 0) line("No check-ins recorded.");
  checkins.slice(-14).forEach((item) => {
    if (y > 740) { doc.addPage(); y = 52; }
    line(`${item.checkin_date}  Appetite ${item.appetite ?? "-"}/5  Energy ${item.energy ?? "-"}/5  Fluids ${item.hydration_ability ?? "-"}/5`, 10, [2, 6, 23]);
    line(`Nausea ${item.nausea}/4, vomiting ${item.vomiting}/4, constipation ${item.constipation}/4, diarrhea ${item.diarrhea}/4, reflux ${item.reflux}/4. Guidance shown: ${item.guidance_level}.`, 9, [100, 116, 139]);
    y += 4;
  });
  const filename = `nutrio-support-report-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
