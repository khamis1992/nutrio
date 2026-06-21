import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

import type { AIReportContent } from "@/lib/ai-report-generator";
import { assetPath } from "@/lib/asset-path";
import type { MealPlanMeal, WeeklyReportData } from "@/lib/professional-weekly-report-pdf";

const PAGE = { w: 210, h: 297 };
const M = 14;
const CONTENT_W = PAGE.w - M * 2;
const BOTTOM = PAGE.h - 22;

const C = {
  paper: [246, 248, 244] as RGB,
  white: [255, 255, 255] as RGB,
  ink: [2, 6, 23] as RGB,
  muted: [100, 116, 139] as RGB,
  line: [226, 232, 240] as RGB,
  green: [2, 6, 23] as RGB,
  greenSoft: [241, 245, 249] as RGB,
  orange: [249, 115, 22] as RGB,
  orangeSoft: [255, 237, 213] as RGB,
  amber: [245, 158, 11] as RGB,
  red: [220, 68, 56] as RGB,
  blue: [2, 132, 199] as RGB,
  violet: [124, 58, 237] as RGB,
};

type RGB = [number, number, number];
type TableDoc = jsPDF & { lastAutoTable?: { finalY?: number } };

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function pct(value: number, target: number) {
  if (!target || target <= 0) return 0;
  return clamp(Math.round((value / target) * 100));
}

function safe(value: string | null | undefined, fallback = "-") {
  return value && value.trim() ? value : fallback;
}

function signed(value: number, unit = "") {
  if (value === 0) return `0${unit}`;
  return `${value > 0 ? "+" : ""}${Math.round(value)}${unit}`;
}

class AIReportPDF {
  private doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  private page = 1;
  private totalPages = 1;
  private logoDataUrl: string | null = null;

  async download(data: WeeklyReportData, content?: AIReportContent | null) {
    this.logoDataUrl = await this.loadLogo();
    const pdf = this.generate(data, content);
    pdf.save(`nutrio-ai-report-${format(new Date(), "yyyy-MM-dd")}.pdf`);
  }

  generate(data: WeeklyReportData, content?: AIReportContent | null) {
    this.doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
    this.page = 1;
    this.totalPages = 1;

    this.drawPageBackground();
    this.cover(data, content);
    this.wellnessScore(data);
    this.weeklySnapshot(data, content);
    this.eatingRhythm(data);
    this.momentum(data);
    this.habitCheckin(data, content);
    this.calorieAlignment(data);
    this.macroBalance(data, content);
    this.hydration(data);
    this.personalizedTips(data, content);
    this.mealPlan(data);
    this.trends(data);
    this.lookingAhead(data, content);
    this.dataNotes(data);

    this.totalPages = this.doc.getNumberOfPages();
    for (let i = 1; i <= this.totalPages; i += 1) {
      this.doc.setPage(i);
      this.footer(i);
    }

    return this.doc;
  }

  private drawPageBackground() {
    this.doc.setFillColor(...C.paper);
    this.doc.rect(0, 0, PAGE.w, PAGE.h, "F");
  }

  private newPage() {
    this.doc.addPage();
    this.page += 1;
    this.drawPageBackground();
  }

  private ensureSpace(y: number, h: number) {
    if (y + h <= BOTTOM) return y;
    this.newPage();
    return 24;
  }

  private footer(pageNumber: number) {
    this.doc.setDrawColor(...C.line);
    this.doc.setLineWidth(0.25);
    this.doc.line(M, PAGE.h - 14, PAGE.w - M, PAGE.h - 14);
    this.drawLogo(M, PAGE.h - 12.5, 8, 8);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(8);
    this.doc.setTextColor(...C.muted);
    this.doc.text("Nutrio AI Nutrition Report", M + 10, PAGE.h - 8);
    this.doc.text(`${pageNumber} / ${this.totalPages}`, PAGE.w - M, PAGE.h - 8, { align: "right" });
  }

  private async loadLogo() {
    if (this.logoDataUrl) return this.logoDataUrl;
    try {
      const response = await fetch(assetPath("/logo.png"));
      if (!response.ok) return null;
      const blob = await response.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }

  private drawLogo(x: number, y: number, w: number, h: number) {
    if (!this.logoDataUrl) return;
    try {
      this.doc.addImage(this.logoDataUrl, "PNG", x, y, w, h, undefined, "FAST");
    } catch {
      // Text branding remains available if the image cannot be embedded.
    }
  }

  private card(x: number, y: number, w: number, h: number, fill: RGB = C.white, stroke: RGB = C.line) {
    this.doc.setFillColor(...fill);
    this.doc.setDrawColor(...stroke);
    this.doc.setLineWidth(0.25);
    this.doc.roundedRect(x, y, w, h, 5, 5, "FD");
  }

  private sectionTitle(number: string, title: string, y: number, eyebrow?: string) {
    this.doc.setFillColor(...C.green);
    this.doc.roundedRect(M, y - 1, 13, 10, 3, 3, "F");
    this.doc.setTextColor(...C.white);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(8);
    this.doc.text(number, M + 6.5, y + 6, { align: "center" });

    if (eyebrow) {
      this.doc.setFontSize(7);
      this.doc.setTextColor(...C.muted);
      this.doc.text(eyebrow.toUpperCase(), M + 18, y);
    }

    this.doc.setFontSize(16);
    this.doc.setTextColor(...C.ink);
    this.doc.text(title, M + 18, eyebrow ? y + 8 : y + 6);
  }

  private wrap(text: string, maxWidth: number) {
    return this.doc.splitTextToSize(text, maxWidth) as string[];
  }

  private ellipsize(text: string, maxWidth: number) {
    if (this.doc.getTextWidth(text) <= maxWidth) return text;
    let trimmed = text;
    while (trimmed.length > 4 && this.doc.getTextWidth(`${trimmed}...`) > maxWidth) {
      trimmed = trimmed.slice(0, -1);
    }
    return `${trimmed.trim()}...`;
  }

  private progressBar(x: number, y: number, w: number, value: number, color: RGB) {
    const clamped = clamp(value);
    this.doc.setFillColor(226, 232, 240);
    this.doc.roundedRect(x, y, w, 4, 2, 2, "F");
    if (clamped > 0) {
      this.doc.setFillColor(...color);
      this.doc.roundedRect(x, y, (w * clamped) / 100, 4, 2, 2, "F");
    }
  }

  private ring(cx: number, cy: number, r: number, value: number, color: RGB) {
    const stroke = 4;
    this.doc.setDrawColor(226, 232, 240);
    this.doc.setLineWidth(stroke);
    this.doc.circle(cx, cy, r, "S");
    this.doc.setDrawColor(...color);
    const steps = Math.round((clamp(value) / 100) * 44);
    for (let i = 0; i < steps; i += 1) {
      const a1 = (-90 + i * (360 / 44)) * Math.PI / 180;
      const a2 = (-90 + (i + 0.75) * (360 / 44)) * Math.PI / 180;
      this.doc.line(cx + r * Math.cos(a1), cy + r * Math.sin(a1), cx + r * Math.cos(a2), cy + r * Math.sin(a2));
    }
  }

  private metricCard(x: number, y: number, w: number, label: string, value: string, sub: string, color: RGB) {
    this.card(x, y, w, 30);
    this.doc.setFillColor(...color);
    this.doc.roundedRect(x + 4, y + 5, 3, 20, 1.5, 1.5, "F");
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(16);
    this.doc.setTextColor(...C.ink);
    this.doc.text(value, x + 10, y + 13);
    this.doc.setFontSize(8);
    this.doc.setTextColor(...C.muted);
    this.doc.text(label, x + 10, y + 21);
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(7);
    this.doc.text(sub, x + w - 5, y + 21, { align: "right" });
  }

  private textCard(y: number, title: string, body: string, accent: RGB = C.orange) {
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(8.5);
    const lines = this.wrap(body, CONTENT_W - 30);
    const h = Math.max(34, 22 + lines.length * 5);
    y = this.ensureSpace(y, h);
    this.card(M, y, CONTENT_W, h);
    this.doc.setFillColor(...accent);
    this.doc.roundedRect(M + 5, y + 6, 3, h - 12, 1.5, 1.5, "F");
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(10);
    this.doc.setTextColor(...C.ink);
    this.doc.text(title, M + 13, y + 11);
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(8.5);
    this.doc.setTextColor(...C.muted);
    this.doc.text(lines, M + 13, y + 21, { lineHeightFactor: 1.35, maxWidth: CONTENT_W - 30 });
    return y + h + 8;
  }

  private cover(data: WeeklyReportData, content?: AIReportContent | null) {
    this.doc.setFillColor(...C.green);
    this.doc.roundedRect(M, 14, CONTENT_W, 72, 9, 9, "F");
    this.doc.setFillColor(15, 23, 42);
    this.doc.circle(PAGE.w - M - 18, 35, 22, "F");
    this.doc.setFillColor(...C.white);
    this.doc.roundedRect(PAGE.w - M - 40, 24, 34, 34, 9, 9, "F");
    this.drawLogo(PAGE.w - M - 34, 29, 22, 22);

    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(9);
    this.doc.setTextColor(203, 213, 225);
    this.doc.text("NUTRIO", M + 9, 28);
    this.doc.setFontSize(7);
    this.doc.text("AI NUTRITION INTELLIGENCE", M + 9, 35);
    this.doc.setFontSize(28);
    this.doc.setTextColor(...C.white);
    this.doc.text("Nutrition Report", M + 9, 51);
    this.doc.setFontSize(10);
    this.doc.setFont("helvetica", "normal");
    this.doc.setTextColor(226, 232, 240);
    this.doc.text(`${format(new Date(data.weekStart), "MMM d")} - ${format(new Date(data.weekEnd), "MMM d, yyyy")}`, M + 9, 63);
    this.doc.text(safe(data.userEmail), M + 9, 73);

    this.card(M, 100, CONTENT_W, 58);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(15);
    this.doc.setTextColor(...C.ink);
    this.doc.text(`Hi ${safe(data.userName, "there")}`, M + 8, 115);
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(9.5);
    this.doc.setTextColor(...C.muted);
    const summary = content?.summary || this.quickInsight(data);
    this.doc.text(this.wrap(summary, CONTENT_W - 16), M + 8, 127);

    const w = (CONTENT_W - 8) / 3;
    this.metricCard(M, 174, w, "Goal", safe(data.activeGoal, "Nutrition"), `${Math.round(data.goalProgress)}% progress`, C.green);
    this.metricCard(M + w + 4, 174, w, "Current Weight", data.currentWeight ? `${data.currentWeight} kg` : "-", data.weightGoal ? `goal ${data.weightGoal} kg` : "not set", C.orange);
    this.metricCard(M + (w + 4) * 2, 174, w, "Streak", `${data.currentStreak}`, `best ${data.bestStreak}`, C.violet);
  }

  private wellnessScore(data: WeeklyReportData) {
    this.newPage();
    this.sectionTitle("01", "Wellness Score", 24, "overall progress");
    const score = this.overallScore(data);
    this.card(M, 50, CONTENT_W, 70, C.white);
    this.ring(M + 38, 85, 23, score, C.orange);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(22);
    this.doc.setTextColor(...C.ink);
    this.doc.text(`${score}%`, M + 38, 89, { align: "center" });
    this.doc.setFontSize(14);
    this.doc.text(score >= 80 ? "Excellent momentum" : score >= 60 ? "Solid foundation" : "Building rhythm", M + 76, 72);
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(9);
    this.doc.setTextColor(...C.muted);
    this.doc.text(this.wrap(this.quickInsight(data), CONTENT_W - 86), M + 76, 84);

    const checks = [
      ["Consistency", data.consistencyScore, C.green],
      ["Calorie alignment", pct(data.avgCalories, data.calorieTarget), C.orange],
      ["Protein", pct(data.avgProtein, data.proteinTarget), C.red],
      ["Meal quality", data.mealQualityScore, C.violet],
      ["Hydration", pct(data.waterAverage, 8), C.blue],
      ["Streak", pct(data.currentStreak, Math.max(data.bestStreak, 1)), C.amber],
    ] as const;

    let y = 137;
    checks.forEach(([label, value, color]) => {
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(8.5);
      this.doc.setTextColor(...C.ink);
      this.doc.text(label, M, y);
      this.doc.text(`${Math.round(value)}%`, PAGE.w - M, y, { align: "right" });
      this.progressBar(M, y + 4, CONTENT_W, value, color);
      y += 16;
    });
  }

  private weeklySnapshot(data: WeeklyReportData, content?: AIReportContent | null) {
    this.newPage();
    this.sectionTitle("02", "Weekly Snapshot", 24, "your week in numbers");
    const w = (CONTENT_W - 8) / 3;
    this.metricCard(M, 50, w, "Days Tracked", `${data.daysLogged}/${data.totalDays}`, "meals logged", C.green);
    this.metricCard(M + w + 4, 50, w, "Avg Calories", `${Math.round(data.avgCalories)}`, `target ${data.calorieTarget}`, C.orange);
    this.metricCard(M + (w + 4) * 2, 50, w, "Water Days", `${data.dailyData.filter((d) => d.water > 0).length}/7`, "hydration tracked", C.blue);
    this.metricCard(M, 88, w, "Milestones", `${data.milestonesAchieved}/${data.totalMilestones}`, "achieved", C.violet);
    this.metricCard(M + w + 4, 88, w, "Meal Quality", `${Math.round(data.mealQualityScore)}`, "score /100", C.amber);
    this.metricCard(M + (w + 4) * 2, 88, w, "Goal Progress", `${Math.round(data.goalProgress)}%`, safe(data.activeGoal), C.green);

    const insight = content?.weightAnalysis || this.quickInsight(data);
    const afterReflection = this.textCard(136, "This week's reflection", insight, C.green);

    autoTable(this.doc, {
      startY: Math.max(184, afterReflection + 6),
      margin: { left: M, right: M },
      head: [["Compared with last week", "Change"]],
      body: [
        ["Calories", signed(data.vsLastWeek.calories, " kcal")],
        ["Weight", signed(data.vsLastWeek.weight, " kg")],
        ["Consistency", signed(data.vsLastWeek.consistency, "%")],
      ],
      styles: { font: "helvetica", fontSize: 9, cellPadding: 3, textColor: C.ink },
      headStyles: { fillColor: C.green, textColor: C.white, fontStyle: "bold" },
      alternateRowStyles: { fillColor: C.paper },
      tableLineColor: C.line,
      tableLineWidth: 0.2,
    });
  }

  private eatingRhythm(data: WeeklyReportData) {
    this.newPage();
    this.sectionTitle("03", "Eating Rhythm", 24, "daily intake pattern");
    const logged = data.dailyData.filter((d) => d.calories > 0);
    const variance = this.variance(logged.map((d) => d.calories));
    this.metricCard(M, 50, (CONTENT_W - 8) / 3, "Variance", `${Math.round(variance)}%`, variance < 15 ? "steady" : "variable", variance < 15 ? C.green : C.amber);
    this.metricCard(M + (CONTENT_W - 8) / 3 + 4, 50, (CONTENT_W - 8) / 3, "Logged Days", `${logged.length}`, "with calories", C.orange);
    this.metricCard(M + ((CONTENT_W - 8) / 3 + 4) * 2, 50, (CONTENT_W - 8) / 3, "Target", `${data.calorieTarget}`, "kcal / day", C.violet);

    const chartY = 106;
    const chartH = 68;
    this.card(M, chartY - 16, CONTENT_W, 108);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(11);
    this.doc.setTextColor(...C.ink);
    this.doc.text("Daily calorie rhythm", M + 7, chartY - 5);

    const maxCal = Math.max(...data.dailyData.map((d) => d.calories), data.calorieTarget, 1);
    const baseY = chartY + chartH;
    const barW = 14;
    const gap = (CONTENT_W - 20 - barW * data.dailyData.length) / Math.max(data.dailyData.length - 1, 1);
    const targetY = baseY - (data.calorieTarget / maxCal) * chartH;
    this.doc.setDrawColor(...C.orange);
    this.doc.setLineWidth(0.4);
    this.doc.line(M + 10, targetY, PAGE.w - M - 10, targetY);
    data.dailyData.forEach((d, i) => {
      const x = M + 10 + i * (barW + gap);
      const h = (d.calories / maxCal) * chartH;
      this.doc.setFillColor(...(d.calories > data.calorieTarget * 1.1 ? C.amber : d.calories < data.calorieTarget * 0.8 ? C.red : C.green));
      if (h > 0) this.doc.roundedRect(x, baseY - h, barW, h, 2, 2, "F");
      this.doc.setFontSize(7);
      this.doc.setTextColor(...C.muted);
      this.doc.text(format(new Date(d.date), "EEE"), x + barW / 2, baseY + 11, { align: "center" });
    });

    const body = variance < 15
      ? "Your daily calorie rhythm was steady this week. This usually makes energy, appetite, and progress easier to manage."
      : "Your daily intake moved around this week. Planning the next day in advance can smooth the highs and lows without making meals feel strict.";
    this.textCard(218, "Pattern insight", body, variance < 15 ? C.green : C.amber);
  }

  private momentum(data: WeeklyReportData) {
    this.newPage();
    this.sectionTitle("04", "Your Momentum", 24, "direction and pace");
    const momentum = this.momentumScore(data);
    this.card(M, 50, CONTENT_W, 48, momentum >= 0 ? C.greenSoft : C.orangeSoft);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(28);
    this.doc.setTextColor(...(momentum >= 0 ? C.green : C.orange));
    this.doc.text(momentum >= 0 ? `+${momentum}` : `${momentum}`, M + 10, 78);
    this.doc.setFontSize(13);
    this.doc.setTextColor(...C.ink);
    this.doc.text(momentum >= 3 ? "Strong weekly momentum" : momentum >= 0 ? "Momentum is forming" : "Rebuild with small wins", M + 42, 68);
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(9);
    this.doc.setTextColor(...C.muted);
    this.doc.text(this.wrap("Momentum combines tracking consistency, protein alignment, intake stability, hydration, and current streak.", CONTENT_W - 56), M + 42, 80);

    const strengths = [
      data.consistencyScore > 50 && "Consistent tracking habits",
      pct(data.avgProtein, data.proteinTarget) > 70 && "Protein intake is moving toward target",
      this.variance(data.dailyData.map((d) => d.calories).filter(Boolean)) < 20 && "Stable daily intake pattern",
      data.waterAverage > 5 && "Regular hydration logging",
      data.currentStreak > 3 && "Active streak building momentum",
    ].filter(Boolean) as string[];
    this.listBlock(120, "Momentum builders", strengths.length ? strengths : ["Track one more meal per day", "Add water check-ins", "Choose one protein anchor"]);
  }

  private habitCheckin(data: WeeklyReportData, content?: AIReportContent | null) {
    this.newPage();
    this.sectionTitle("05", "Habit Check-in", 24, "patterns noticed");
    const risks = this.habitRisks(data);
    const wins = content?.insights?.filter((i) => i.type === "success").map((i) => i.text).slice(0, 4) || data.insights.slice(0, 4);
    const nextY = this.listBlock(50, "What is working", wins);
    this.listBlock(nextY + 8, "Needs attention", risks.length ? risks : ["No major habit risks detected this week. Keep your current rhythm and focus on one small improvement."]);
  }

  private calorieAlignment(data: WeeklyReportData) {
    this.newPage();
    this.sectionTitle("06", "Calorie Alignment", 24, "target comparison");
    const diff = data.avgCalories - data.calorieTarget;
    this.metricCard(M, 50, (CONTENT_W - 8) / 3, "Daily Target", `${data.calorieTarget}`, "kcal", C.green);
    this.metricCard(M + (CONTENT_W - 8) / 3 + 4, 50, (CONTENT_W - 8) / 3, "Weekly Avg", `${Math.round(data.avgCalories)}`, "kcal", C.orange);
    this.metricCard(M + ((CONTENT_W - 8) / 3 + 4) * 2, 50, (CONTENT_W - 8) / 3, "Difference", signed(diff), "kcal", Math.abs(diff) < 150 ? C.green : C.red);
    this.progressBar(M, 104, CONTENT_W, pct(data.avgCalories, data.calorieTarget), Math.abs(diff) < 150 ? C.green : C.orange);
    const body = Math.abs(diff) < 100
      ? "Your average intake is very close to your daily target. This is a strong signal for goal alignment."
      : diff > 0
        ? `Your average intake is about ${Math.round(diff)} calories above target. Small portion or snack adjustments can bring it closer.`
        : `Your average intake is about ${Math.round(Math.abs(diff))} calories below target. Make sure meals are fully logged and that your intake supports your goal safely.`;
    this.textCard(128, "Calorie note", body, Math.abs(diff) < 100 ? C.green : C.orange);
  }

  private macroBalance(data: WeeklyReportData, content?: AIReportContent | null) {
    this.newPage();
    this.sectionTitle("07", "Macro Balance", 24, "protein, carbs, and fat");
    const macros = [
      ["Protein", data.avgProtein, data.proteinTarget, C.red],
      ["Carbs", data.avgCarbs, data.carbsTarget, C.amber],
      ["Fat", data.avgFat, data.fatTarget, C.violet],
    ] as const;

    let y = 54;
    macros.forEach(([label, value, target, color]) => {
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(10);
      this.doc.setTextColor(...C.ink);
      this.doc.text(label, M, y);
      this.doc.setTextColor(...C.muted);
      this.doc.text(`${Math.round(value)} / ${Math.round(target)} g`, PAGE.w - M, y, { align: "right" });
      this.progressBar(M, y + 6, CONTENT_W, pct(value, target), color);
      y += 28;
    });

    const caloriesFromProtein = data.avgProtein * 4;
    const caloriesFromCarbs = data.avgCarbs * 4;
    const caloriesFromFat = data.avgFat * 9;
    const total = Math.max(caloriesFromProtein + caloriesFromCarbs + caloriesFromFat, 1);
    const mix = [
      ["Protein", Math.round((caloriesFromProtein / total) * 100)],
      ["Carbs", Math.round((caloriesFromCarbs / total) * 100)],
      ["Fat", Math.round((caloriesFromFat / total) * 100)],
    ];
    autoTable(this.doc, {
      startY: 150,
      margin: { left: M, right: M },
      head: [["Calorie Mix", "Share"]],
      body: mix.map(([label, value]) => [label, `${value}%`]),
      styles: { font: "helvetica", fontSize: 9, cellPadding: 3, textColor: C.ink },
      headStyles: { fillColor: C.green, textColor: C.white, fontStyle: "bold" },
      alternateRowStyles: { fillColor: C.paper },
    });

    const tableY = (this.doc as TableDoc).lastAutoTable?.finalY || 184;
    this.textCard(tableY + 12, "Macro insight", content?.macroCommentary || `Your calorie mix is ${mix.map(([l, v]) => `${v}% ${l.toString().toLowerCase()}`).join(", ")}. Protein alignment is ${pct(data.avgProtein, data.proteinTarget)}% of target.`, C.green);
  }

  private hydration(data: WeeklyReportData) {
    this.newPage();
    this.sectionTitle("08", "Hydration", 24, "water tracking");
    const tracked = data.dailyData.filter((d) => d.water > 0).length;
    this.metricCard(M, 50, (CONTENT_W - 8) / 3, "Daily Average", data.waterAverage.toFixed(1), "glasses", C.blue);
    this.metricCard(M + (CONTENT_W - 8) / 3 + 4, 50, (CONTENT_W - 8) / 3, "Days Tracked", `${tracked}/7`, "with water", C.green);
    this.metricCard(M + ((CONTENT_W - 8) / 3 + 4) * 2, 50, (CONTENT_W - 8) / 3, "Target", data.trackerInsights?.waterTargetMl ? `${data.trackerInsights.waterTargetMl}ml` : "8 cups", "daily", C.orange);
    const nextY = this.listBlock(104, "Daily water", data.dailyData.map((d) => `${format(new Date(d.date), "EEE")}: ${Math.round(d.water)} glasses`));
    this.textCard(nextY + 8, "Hydration note", data.waterAverage >= 6 ? "Hydration is looking consistent. Keep pairing water with meals and workouts." : "Hydration has room to improve. Keeping a bottle nearby and pairing water with meals can make it easier.", C.blue);
  }

  private personalizedTips(data: WeeklyReportData, content?: AIReportContent | null) {
    this.newPage();
    this.sectionTitle("09", "Personalized Tips", 24, "next best actions");
    const recs = content?.recommendations?.length
      ? content.recommendations.map((r) => `${r.title}: ${r.description}`)
      : data.recommendations.length
        ? data.recommendations
        : this.mealRecs(data).map((r) => `${r.title}: ${r.description}`);
    const nextY = this.listBlock(50, "Recommendations", recs.slice(0, 6));
    this.textCard(nextY + 8, "Protein assessment", content?.proteinAssessment || `Your protein intake is ${pct(data.avgProtein, data.proteinTarget)}% of target.`, C.red);
  }

  private mealPlan(data: WeeklyReportData) {
    this.newPage();
    this.sectionTitle("10", "Your Meal Plan", 24, "week ahead");
    if (!data.mealPlan?.length) {
      this.textCard(50, "Generate your meal plan", "No meal plan was attached to this report. Generate a personalized meal plan to include restaurant meals, nutrition totals, and weekly estimated cost.", C.orange);
      return;
    }

    const totals = data.mealPlan.reduce((t, day) => ({
      calories: t.calories + day.dailyCalories,
      protein: t.protein + day.dailyProtein,
      price: t.price + day.dailyPrice,
    }), { calories: 0, protein: 0, price: 0 });
    const w = (CONTENT_W - 8) / 3;
    this.metricCard(M, 50, w, "Avg Calories", `${Math.round(totals.calories / data.mealPlan.length)}`, "per day", C.orange);
    this.metricCard(M + w + 4, 50, w, "Avg Protein", `${Math.round(totals.protein / data.mealPlan.length)}g`, "per day", C.red);
    this.metricCard(M + (w + 4) * 2, 50, w, "Est. Cost", `QAR ${totals.price.toFixed(0)}`, "for week", C.green);

    let y = 94;
    data.mealPlan.forEach((day) => {
      y = this.ensureSpace(y, 84);
      this.card(M, y, CONTENT_W, 76);
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(11);
      this.doc.setTextColor(...C.ink);
      this.doc.text(day.day, M + 7, y + 10);
      this.doc.setFontSize(8);
      this.doc.setTextColor(...C.orange);
      this.doc.text(`${day.dailyCalories} kcal | ${day.dailyProtein}g protein | QAR ${day.dailyPrice.toFixed(0)}`, PAGE.w - M - 7, y + 10, { align: "right" });

      let yy = y + 24;
      [
        ["Breakfast", day.breakfast],
        ["Lunch", day.lunch],
        ["Dinner", day.dinner],
        ["Snack", day.snack],
      ].forEach(([type, meal]) => {
        if (!meal) return;
        this.mealLine(M + 7, yy, type as string, meal as MealPlanMeal, data);
        yy += 13;
      });
      y += 84;
    });
  }

  private trends(data: WeeklyReportData) {
    this.newPage();
    this.sectionTitle("11", "Your Trends", 24, "directional signals");
    const variance = this.variance(data.dailyData.map((d) => d.calories).filter(Boolean));
    const trends = [
      ["Calorie Intake", data.avgCalories > data.calorieTarget ? "Above target" : data.avgCalories < data.calorieTarget * 0.9 ? "Below target" : "On target"],
      ["Protein", pct(data.avgProtein, data.proteinTarget) >= 90 ? "On target" : "Needs focus"],
      ["Hydration", data.waterAverage >= 6 ? "Steady" : "Needs focus"],
      ["Intake Stability", variance < 15 ? "Consistent" : "Variable"],
    ];
    autoTable(this.doc, {
      startY: 50,
      margin: { left: M, right: M },
      head: [["Area", "Trend"]],
      body: trends,
      styles: { font: "helvetica", fontSize: 9, cellPadding: 4, textColor: C.ink },
      headStyles: { fillColor: C.green, textColor: C.white, fontStyle: "bold" },
      alternateRowStyles: { fillColor: C.paper },
    });
    const finalY = (this.doc as TableDoc).lastAutoTable?.finalY || 100;
    this.textCard(finalY + 14, "Trend summary", data.daysLogged < 4 ? `Trend analysis needs at least 4 days of tracking. You logged ${data.daysLogged} day${data.daysLogged === 1 ? "" : "s"} this week.` : `${trends.filter(([, v]) => ["On target", "Steady", "Consistent"].includes(v)).length} of 4 tracked trend areas are in a good place.`, C.green);
  }

  private lookingAhead(data: WeeklyReportData, content?: AIReportContent | null) {
    this.newPage();
    this.sectionTitle("12", "Looking Ahead", 24, "next week plan");
    const weeks = this.timeline(data);
    this.metricCard(M, 50, (CONTENT_W - 8) / 3, "Timeline", `${weeks} wks`, "estimated", C.green);
    this.metricCard(M + (CONTENT_W - 8) / 3 + 4, 50, (CONTENT_W - 8) / 3, "Focus", pct(data.avgProtein, data.proteinTarget) < 80 ? "Protein" : "Consistency", "priority", C.orange);
    this.metricCard(M + ((CONTENT_W - 8) / 3 + 4) * 2, 50, (CONTENT_W - 8) / 3, "Goal", safe(data.activeGoal), `${Math.round(data.goalProgress)}%`, C.violet);
    const nextY = this.listBlock(104, "Suggested weekly commitments", [
      "Log meals on at least 5 days",
      "Choose one protein anchor daily",
      "Pair water with every meal",
      "Review progress before the weekend",
    ]);
    this.textCard(nextY + 8, "Coach note", content?.metabolicCommentary || "Small repeatable actions matter more than perfect days. Keep the plan simple and measurable for the next week.", C.orange);
  }

  private dataNotes(data: WeeklyReportData) {
    this.newPage();
    this.sectionTitle("13", "About This Report", 24, "data notes");
    const nextY = this.listBlock(50, "Included data", [
      `Report date: ${data.reportDate}`,
      `Week range: ${format(new Date(data.weekStart), "MMM d")} - ${format(new Date(data.weekEnd), "MMM d, yyyy")}`,
      `Meals and nutrition logs: ${data.daysLogged}/${data.totalDays} days`,
      `Weight: ${data.currentWeight ? `${data.currentWeight} kg` : "not logged"}`,
      `BMI: ${data.trackerInsights?.bmi ? `${data.trackerInsights.bmi} (${safe(data.trackerInsights.bmiLabel)})` : "not available"}`,
      `Step goal: ${data.trackerInsights?.stepGoal || "not available"}`,
      `Water target: ${data.trackerInsights?.waterTargetMl || "8 cups"}`,
    ]);
    this.textCard(nextY + 8, "Important note", "This report is for wellness tracking and education. It is not a medical diagnosis or a substitute for professional healthcare advice.", C.red);
  }

  private listBlock(y: number, title: string, items: string[]) {
    const lines = items.length ? items : ["No data available yet."];
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(8.5);
    const wrappedItems = lines.map((item) => this.wrap(item, CONTENT_W - 32));
    const h = Math.max(32, 20 + wrappedItems.reduce((sum, wrapped) => sum + wrapped.length * 5 + 4, 0));
    y = this.ensureSpace(y, h);
    this.card(M, y, CONTENT_W, h);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(11);
    this.doc.setTextColor(...C.ink);
    this.doc.text(title, M + 7, y + 12);
    let yy = y + 24;
    wrappedItems.forEach((wrapped, i) => {
      this.doc.setFillColor(...C.orange);
      this.doc.circle(M + 9, yy - 2, 2.1, "F");
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(8.5);
      this.doc.setTextColor(...C.muted);
      this.doc.text(wrapped, M + 15, yy, { lineHeightFactor: 1.35, maxWidth: CONTENT_W - 32 });
      yy += wrapped.length * 5 + 4;
    });
    return y + h + 8;
  }

  private mealLine(x: number, y: number, type: string, meal: MealPlanMeal, data: WeeklyReportData) {
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(7.5);
    this.doc.setTextColor(...C.orange);
    this.doc.text(type.toUpperCase(), x, y);
    this.doc.setTextColor(...C.ink);
    const nameMaxWidth = 76;
    this.doc.text(this.ellipsize(safe(meal.name), nameMaxWidth), x + 23, y);
    this.doc.setFont("helvetica", "normal");
    this.doc.setTextColor(...C.muted);
    this.doc.setFontSize(7);
    this.doc.text(`${meal.calories || 0} kcal | P:${meal.protein_g || 0} C:${meal.carbs_g || 0} F:${meal.fat_g || 0}`, PAGE.w - M - 34, y, { align: "right" });

    const img = data.mealImages?.get(meal.id) || (meal.image_url?.startsWith("data:image/") ? meal.image_url : null);
    if (img && y < 252) {
      try {
        const formatName = img.includes("image/png") ? "PNG" : "JPEG";
        this.doc.addImage(img, formatName, PAGE.w - M - 20, y - 7, 10, 10, undefined, "FAST");
      } catch {
        // Ignore image rendering failures; meal text remains available.
      }
    }
  }

  private overallScore(data: WeeklyReportData) {
    const scores = [
      data.consistencyScore * 0.3,
      pct(data.avgCalories, data.calorieTarget) * 0.25,
      pct(data.avgProtein, data.proteinTarget) * 0.15,
      data.mealQualityScore * 0.1,
      pct(data.waterAverage, 8) * 0.1,
      pct(data.currentStreak, Math.max(data.bestStreak, 1)) * 0.1,
    ];
    return Math.round(scores.reduce((a, b) => a + b, 0));
  }

  private variance(values: number[]) {
    if (!values.length) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    if (!mean) return 0;
    const squared = values.map((v) => Math.pow(v - mean, 2));
    return Math.sqrt(squared.reduce((a, b) => a + b, 0) / squared.length) / mean * 100;
  }

  private momentumScore(data: WeeklyReportData) {
    let score = 0;
    if (data.consistencyScore > 50) score += 2;
    if (pct(data.avgProtein, data.proteinTarget) > 70) score += 2;
    if (this.variance(data.dailyData.map((d) => d.calories).filter(Boolean)) < 20) score += 2;
    if (data.waterAverage > 5) score += 2;
    if (data.currentStreak > 3) score += 2;
    return score - 5;
  }

  private habitRisks(data: WeeklyReportData) {
    const risks: string[] = [];
    if (data.daysLogged <= 3) risks.push(`Only ${data.daysLogged} days tracked. Aim for 5+ for more meaningful insights.`);
    if (this.variance(data.dailyData.map((d) => d.calories).filter(Boolean)) > 25) risks.push("Daily calories fluctuate quite a bit. Meal planning may help smooth the pattern.");
    if (pct(data.avgProtein, data.proteinTarget) < 50) risks.push(`Protein is at ${pct(data.avgProtein, data.proteinTarget)}% of target. Consider adding protein-rich foods.`);
    const weekendHigh = data.dailyData.filter((d) => {
      const day = new Date(d.date).getDay();
      return (day === 0 || day === 6) && d.calories > data.calorieTarget * 1.3;
    });
    if (weekendHigh.length) risks.push("Weekend intake is higher than target. Pre-planning weekend meals could help.");
    return risks;
  }

  private timeline(data: WeeklyReportData) {
    const diff = Math.abs(data.avgCalories - data.calorieTarget);
    const consistency = data.consistencyScore / 100;
    const base = diff > 300 ? 12 : diff > 100 ? 8 : 4;
    return Math.round(base / Math.max(consistency, 0.3));
  }

  private quickInsight(data: WeeklyReportData) {
    if (data.daysLogged < 3) return `You logged ${data.daysLogged} day${data.daysLogged === 1 ? "" : "s"} this week. Keep tracking to unlock a fuller picture of your wellness.`;
    const parts: string[] = [];
    if (data.consistencyScore >= 80) parts.push(`${Math.round(data.consistencyScore)}% tracking consistency shows strong dedication.`);
    else if (data.consistencyScore >= 50) parts.push(`You tracked ${data.daysLogged} days, which is a solid foundation.`);
    else parts.push(`You logged ${data.daysLogged} days. Small increases in consistency will improve the report quality.`);
    const diff = data.avgCalories - data.calorieTarget;
    if (Math.abs(diff) < 50) parts.push("Your calorie intake aligned closely with your target.");
    else if (diff > 0) parts.push(`Intake averaged ${Math.round(diff)} calories above target.`);
    else parts.push(`Intake averaged ${Math.round(Math.abs(diff))} calories below target.`);
    const proteinPct = pct(data.avgProtein, data.proteinTarget);
    if (proteinPct >= 90) parts.push(`Protein reached ${proteinPct}% of target.`);
    else if (proteinPct < 60) parts.push(`Protein is at ${proteinPct}% of target, with room to grow.`);
    return parts.join(" ");
  }

  private mealRecs(data: WeeklyReportData) {
    const recs: Array<{ title: string; description: string }> = [];
    if (pct(data.avgProtein, data.proteinTarget) < 80) {
      recs.push({ title: "Add protein to each meal", description: "Use eggs, chicken, fish, yogurt, tofu, or legumes as simple anchors." });
    }
    if (Math.abs(data.avgCalories - data.calorieTarget) > 200) {
      recs.push({ title: "Plan tomorrow tonight", description: "A quick evening plan reduces impulsive choices and keeps calories steadier." });
    }
    if (data.consistencyScore < 70) {
      recs.push({ title: "Anchor logging to routines", description: "Log breakfast with coffee, lunch after eating, and dinner during evening wind-down." });
    }
    if (recs.length < 3) {
      recs.push({ title: "Prep once, eat all week", description: "Prepare a few flexible ingredients and mix them through the week." });
    }
    return recs.slice(0, 3);
  }
}

export const aiReportPDF = new AIReportPDF();
