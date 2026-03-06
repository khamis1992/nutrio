import jsPDF from "jspdf";
import { format, subDays } from "date-fns";
import type { WeeklyReportData } from "./professional-weekly-report-pdf";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

// ─────────────────────────────────────────────
//  DESIGN TOKENS
// ─────────────────────────────────────────────
const C = {
  // Brand
  green:       [34,  168,  88]  as [number, number, number],
  greenDark:   [22,  140,  72]  as [number, number, number],
  teal:        [26,  178, 159]  as [number, number, number],
  // Semantic
  success:     [34,  197,  94]  as [number, number, number],
  warning:     [245, 158,  11]  as [number, number, number],
  danger:      [239,  68,  68]  as [number, number, number],
  violet:      [139,  92, 246]  as [number, number, number],
  amber:       [251, 191,  36]  as [number, number, number],
  cyan:        [  6, 182, 212]  as [number, number, number],
  // Neutrals
  ink:         [ 15,  23,  42]  as [number, number, number],
  slate:       [ 30,  41,  59]  as [number, number, number],
  muted:       [ 71,  85, 105]  as [number, number, number],
  subtle:      [148, 163, 184]  as [number, number, number],
  border:      [226, 232, 240]  as [number, number, number],
  surface:     [248, 250, 252]  as [number, number, number],
  white:       [255, 255, 255]  as [number, number, number],
};

const W  = 210;          // A4 width  mm
const H  = 297;          // A4 height mm
const MX = 14;           // horizontal margin
const CW = W - MX * 2;  // content width

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────
function lerp(a: number, b: number, t: number) { return Math.round(a + (b - a) * t); }

function gradientRect(
  doc: jsPDF,
  x: number, y: number, w: number, h: number,
  c1: [number,number,number], c2: [number,number,number],
  steps = 30
) {
  const sw = w / steps;
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    doc.setFillColor(lerp(c1[0],c2[0],t), lerp(c1[1],c2[1],t), lerp(c1[2],c2[2],t));
    doc.rect(x + i * sw, y, sw + 0.5, h, "F");
  }
}

function pill(
  doc: jsPDF,
  x: number, y: number, w: number, h: number,
  color: [number,number,number], text: string, textColor: [number,number,number] = C.white
) {
  doc.setFillColor(...color);
  doc.roundedRect(x, y, w, h, h / 2, h / 2, "F");
  doc.setTextColor(...textColor);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text(text, x + w / 2, y + h / 2 + 2.5, { align: "center" });
}

function scoreColor(score: number): [number,number,number] {
  if (score >= 80) return C.success;
  if (score >= 60) return C.green;
  if (score >= 40) return C.warning;
  return C.danger;
}

function scoreLabel(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Fair";
  return "Developing";
}

function pct(val: number, target: number): number {
  return target > 0 ? Math.min(100, Math.round((val / target) * 100)) : 0;
}

function progressBar(
  doc: jsPDF,
  x: number, y: number, w: number, h: number,
  value: number, // 0-100
  fillColor: [number,number,number],
  trackColor: [number,number,number] = C.border
) {
  doc.setFillColor(...trackColor);
  doc.roundedRect(x, y, w, h, h / 2, h / 2, "F");
  const fw = Math.max(h, (value / 100) * w);
  doc.setFillColor(...fillColor);
  doc.roundedRect(x, y, fw, h, h / 2, h / 2, "F");
}

// ─────────────────────────────────────────────
//  MAIN CLASS
// ─────────────────────────────────────────────
export class NutrioReportPDF {
  private doc!: jsPDF;
  private page = 1;
  private total = 0;
  private logo: string | null = null;

  // ── score calculation (same weights as original) ──
  private overallScore(d: WeeklyReportData): number {
    const s = [
      d.consistencyScore                                           * 0.30,
      pct(d.avgCalories, d.calorieTarget)                         * 0.25,
      pct(d.avgProtein,  d.proteinTarget)                         * 0.15,
      d.mealQualityScore                                          * 0.10,
      Math.min(100, Math.round((d.waterAverage / 8) * 100))       * 0.10,
      Math.min(100, (d.currentStreak / Math.max(d.bestStreak, 1)) * 100) * 0.10,
    ];
    return Math.round(s.reduce((a, b) => a + b, 0));
  }

  private variance(arr: number[]): number {
    if (!arr.length) return 0;
    const m = arr.reduce((a, b) => a + b, 0) / arr.length;
    return Math.sqrt(arr.map(v => (v - m) ** 2).reduce((a, b) => a + b, 0) / arr.length) / m * 100;
  }

  // ── logo loader ──
  private async loadLogo(): Promise<void> {
    try {
      const r = await fetch("/logo.png");
      if (!r.ok) return;
      const blob = await r.blob();
      await new Promise<void>(res => {
        const fr = new FileReader();
        fr.onloadend = () => { this.logo = fr.result as string; res(); };
        fr.onerror = () => res();
        fr.readAsDataURL(blob);
      });
    } catch { /* no logo */ }
  }

  // ── page header (called at top of every inner page) ──
  private header(section: string) {
    // Thin top gradient stripe
    gradientRect(this.doc, 0, 0, W, 2, C.green, C.teal);

    // Small logo with white background pill so it doesn't clash with the divider
    const lw = 14, lh = 10;
    this.doc.setFillColor(...C.white);
    this.doc.roundedRect(MX - 1, 3, lw + 2, lh + 2, 2, 2, "F");
    if (this.logo) {
      try {
        this.doc.addImage(this.logo.split(",")[1] || this.logo, "PNG", MX, 3.5, lw, lh, undefined, "FAST");
      } catch { this.logoCircle(MX + lw / 2, 3.5 + lh / 2, lh / 2); }
    } else {
      this.logoCircle(MX + lw / 2, 3.5 + lh / 2, lh / 2);
    }

    // Section label (right)
    this.doc.setTextColor(...C.subtle);
    this.doc.setFontSize(7);
    this.doc.setFont("helvetica", "normal");
    this.doc.text(section, W - MX, 11, { align: "right" });

    // Divider
    this.doc.setDrawColor(...C.border);
    this.doc.setLineWidth(0.3);
    this.doc.line(MX, 16, W - MX, 16);
  }

  // ── page footer ──
  private footer() {
    const y = 290;
    this.doc.setDrawColor(...C.border);
    this.doc.setLineWidth(0.2);
    this.doc.line(MX, y - 3, W - MX, y - 3);
    this.doc.setTextColor(...C.subtle);
    this.doc.setFontSize(6.5);
    this.doc.setFont("helvetica", "normal");
    this.doc.text("Nutrio  |  Weekly Nutrition Intelligence Report  |  For personal use only", MX, y);
    this.doc.text(`${this.page} / ${this.total}`, W - MX, y, { align: "right" });
    gradientRect(this.doc, 0, 294, W, 2, C.green, C.teal);
  }

  private logoCircle(cx: number, cy: number, r: number) {
    this.doc.setFillColor(...C.green);
    this.doc.circle(cx, cy, r, "F");
    this.doc.setTextColor(...C.white);
    this.doc.setFontSize(r * 1.6);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("N", cx, cy + r * 0.38, { align: "center" });
  }

  private newPage(section: string) {
    this.doc.addPage();
    this.page++;
    this.header(section);
  }

  // ─────────────────────────────────────────────
  //  PAGE 1 — COVER
  // ─────────────────────────────────────────────
  private cover(d: WeeklyReportData) {
    // Dark background
    this.doc.setFillColor(...C.slate);
    this.doc.rect(0, 0, W, H, "F");

    // Top gradient bar (thick)
    gradientRect(this.doc, 0, 0, W, 6, C.green, C.teal);

    // Logo inside white rounded box
    const lx = W / 2, ly = 52;
    const logoW = 56, logoH = 40, pad = 8;
    const boxW = logoW + pad * 2, boxH = logoH + pad * 2;
    const boxX = lx - boxW / 2, boxY = ly - boxH / 2;
    this.doc.setFillColor(...C.white);
    this.doc.roundedRect(boxX, boxY, boxW, boxH, 10, 10, "F");
    if (this.logo) {
      try {
        this.doc.addImage(this.logo.split(",")[1] || this.logo, "PNG", lx - logoW / 2, ly - logoH / 2, logoW, logoH, undefined, "FAST");
      } catch { this.logoCircle(lx, ly, 18); }
    } else {
      this.logoCircle(lx, ly, 18);
    }

    // Divider
    gradientRect(this.doc, lx - 35, boxY + boxH + 6, 70, 1.5, C.green, C.teal);

    // Report title
    this.doc.setTextColor(...C.white);
    this.doc.setFontSize(22);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("WEEKLY PERFORMANCE", lx, 118, { align: "center" });
    this.doc.text("& HABIT INTELLIGENCE", lx, 130, { align: "center" });

    this.doc.setTextColor(...C.teal);
    this.doc.setFontSize(9);
    this.doc.setFont("helvetica", "normal");
    this.doc.text("Weekly Report", lx, 140, { align: "center" });

    // Date range pill
    const dr = `${format(new Date(d.weekStart), "MMM d")} – ${format(new Date(d.weekEnd), "MMM d, yyyy")}`;
    pill(this.doc, lx - 35, 148, 70, 10, C.green, dr);

    // ── User card ──
    this.doc.setFillColor(22, 33, 50);
    this.doc.roundedRect(MX + 15, 168, CW - 30, 52, 8, 8, "F");

    this.doc.setTextColor(...C.subtle);
    this.doc.setFontSize(7);
    this.doc.setFont("helvetica", "normal");
    this.doc.text("PREPARED FOR", lx, 181, { align: "center" });

    this.doc.setTextColor(...C.white);
    this.doc.setFontSize(16);
    this.doc.setFont("helvetica", "bold");
    this.doc.text(d.userName.toUpperCase(), lx, 196, { align: "center" });

    this.doc.setTextColor(...C.subtle);
    this.doc.setFontSize(7.5);
    this.doc.setFont("helvetica", "normal");
    this.doc.text(d.userEmail, lx, 207, { align: "center" });

     // ── Overall score ring ──
    // Ring center at Y=232, radius=22 → bottom edge at Y=254
    // Labels start at Y=260 — well clear of the ring
    const score = this.overallScore(d);
    const sc = scoreColor(score);
    const sl = scoreLabel(score);
    const ringCY = 232;
    const ringR  = 22;

    // Outer ring (colored)
    this.doc.setFillColor(...sc);
    this.doc.circle(lx, ringCY, ringR, "F");
    // Inner ring (dark fill — creates the donut effect)
    this.doc.setFillColor(...C.slate);
    this.doc.circle(lx, ringCY, ringR - 5, "F");
    // Score number — vertically centred inside the ring
    this.doc.setTextColor(...C.white);
    this.doc.setFontSize(20);
    this.doc.setFont("helvetica", "bold");
    this.doc.text(`${score}`, lx, ringCY + 3.5, { align: "center" });
    // Score quality label — below the ring with a clear gap
    this.doc.setTextColor(...sc);
    this.doc.setFontSize(7.5);
    this.doc.setFont("helvetica", "bold");
    this.doc.text(sl.toUpperCase(), lx, ringCY + ringR + 8, { align: "center" });
    // "OVERALL SCORE" subtitle
    this.doc.setTextColor(...C.subtle);
    this.doc.setFontSize(6.5);
    this.doc.setFont("helvetica", "normal");
    this.doc.text("OVERALL SCORE", lx, ringCY + ringR + 15, { align: "center" });
    // Generated timestamp
    this.doc.setTextColor(...C.subtle);
    this.doc.setFontSize(6.5);
    this.doc.text(`Generated ${format(new Date(), "MMMM d, yyyy 'at' h:mm a")}`, lx, ringCY + ringR + 26, { align: "center" });

    // Bottom gradient bar
    gradientRect(this.doc, 0, 291, W, 6, C.green, C.teal);
  }

  // ─────────────────────────────────────────────
  //  PAGE 2 — EXECUTIVE SUMMARY (4 KPI cards + score breakdown)
  // ─────────────────────────────────────────────
  private executiveSummary(d: WeeklyReportData) {
    this.newPage("Executive Summary");
    let y = 24;

    // Section title
    this.doc.setTextColor(...C.ink);
    this.doc.setFontSize(13);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Executive Summary", MX, y);
    y += 8;

    // ── 4 KPI cards ──
    const kpis = [
      { label: "Avg Calories",   value: `${Math.round(d.avgCalories)}`, unit: "kcal/day",  color: C.green,   pct: pct(d.avgCalories, d.calorieTarget) },
      { label: "Avg Protein",    value: `${Math.round(d.avgProtein)}g`, unit: "per day",   color: C.teal,    pct: pct(d.avgProtein,  d.proteinTarget) },
      { label: "Consistency",    value: `${d.consistencyScore}%`,       unit: "this week", color: C.violet,  pct: d.consistencyScore },
      { label: "Water Avg",      value: `${d.waterAverage.toFixed(1)}`, unit: "cups/day",  color: C.cyan,    pct: Math.min(100, Math.round(d.waterAverage / 8 * 100)) },
    ];

    const cw4 = (CW - 9) / 4;
    kpis.forEach((k, i) => {
      const x = MX + i * (cw4 + 3);
      this.doc.setFillColor(...C.white);
      this.doc.roundedRect(x, y, cw4, 42, 5, 5, "F");
      this.doc.setDrawColor(...C.border);
      this.doc.setLineWidth(0.3);
      this.doc.roundedRect(x, y, cw4, 42, 5, 5, "S");

      // Top color bar
      gradientRect(this.doc, x, y, cw4, 3, k.color, k.color);

      this.doc.setTextColor(...C.subtle);
      this.doc.setFontSize(6.5);
      this.doc.setFont("helvetica", "normal");
      this.doc.text(k.label.toUpperCase(), x + cw4 / 2, y + 11, { align: "center" });

      this.doc.setTextColor(...C.ink);
      this.doc.setFontSize(14);
      this.doc.setFont("helvetica", "bold");
      this.doc.text(k.value, x + cw4 / 2, y + 24, { align: "center" });

      this.doc.setTextColor(...C.subtle);
      this.doc.setFontSize(6);
      this.doc.setFont("helvetica", "normal");
      this.doc.text(k.unit, x + cw4 / 2, y + 31, { align: "center" });

      // Mini progress bar
      progressBar(this.doc, x + 5, y + 35, cw4 - 10, 3, k.pct, k.color);
    });

    y += 50;

    // ── Score breakdown ──
    this.doc.setFillColor(...C.surface);
    this.doc.roundedRect(MX, y, CW, 72, 6, 6, "F");

    this.doc.setTextColor(...C.ink);
    this.doc.setFontSize(10);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Score Breakdown", MX + 8, y + 11);

    const score = this.overallScore(d);
    const sc = scoreColor(score);

    // Big score on left
    this.doc.setFillColor(...sc);
    this.doc.circle(MX + 22, y + 44, 18, "F");
    this.doc.setFillColor(...C.surface);
    this.doc.circle(MX + 22, y + 44, 14, "F");
    this.doc.setTextColor(...sc);
    this.doc.setFontSize(18);
    this.doc.setFont("helvetica", "bold");
    this.doc.text(`${score}`, MX + 22, y + 49, { align: "center" });

    // Score components
    const components = [
      { label: "Logging Consistency",  val: d.consistencyScore,                                    w: 0.30, color: C.violet },
      { label: "Calorie Alignment",    val: pct(d.avgCalories, d.calorieTarget),                   w: 0.25, color: C.green  },
      { label: "Protein Achievement",  val: pct(d.avgProtein,  d.proteinTarget),                   w: 0.15, color: C.teal   },
      { label: "Meal Quality",         val: d.mealQualityScore,                                    w: 0.10, color: C.amber  },
      { label: "Hydration",            val: Math.min(100, Math.round(d.waterAverage / 8 * 100)),   w: 0.10, color: C.cyan   },
      { label: "Streak Retention",     val: Math.min(100, Math.round(d.currentStreak / Math.max(d.bestStreak, 1) * 100)), w: 0.10, color: C.success },
    ];

    const bx = MX + 50;
    const bw = CW - 55;
    components.forEach((c, i) => {
      const cy2 = y + 20 + i * 9;
      this.doc.setTextColor(...C.muted);
      this.doc.setFontSize(7);
      this.doc.setFont("helvetica", "normal");
      this.doc.text(c.label, bx, cy2);
      this.doc.setTextColor(...C.ink);
      this.doc.setFont("helvetica", "bold");
      this.doc.text(`${c.val}%`, bx + bw - 2, cy2, { align: "right" });
      progressBar(this.doc, bx, cy2 + 2, bw, 3, c.val, c.color);
    });

    y += 80;

    // ── Quick insight ──
    const calDiff = d.avgCalories - d.calorieTarget;
    const insight = d.daysLogged < 3
      ? `You've logged ${d.daysLogged} day${d.daysLogged === 1 ? "" : "s"} this week. Track at least 4–5 days to unlock full insights.`
      : `${d.consistencyScore >= 70 ? "Strong" : "Moderate"} consistency at ${d.consistencyScore}%. ` +
        `Calories ${Math.abs(calDiff) < 100 ? "aligned with" : calDiff > 0 ? `${Math.round(calDiff)} kcal above` : `${Math.round(Math.abs(calDiff))} kcal below`} target. ` +
        `Protein at ${pct(d.avgProtein, d.proteinTarget)}% of goal.`;

    this.doc.setFillColor(...C.white);
    this.doc.roundedRect(MX, y, CW, 28, 5, 5, "F");
    this.doc.setFillColor(...C.green);
    this.doc.roundedRect(MX, y, 4, 28, 2, 2, "F");
    this.doc.setTextColor(...C.ink);
    this.doc.setFontSize(8.5);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Week at a Glance", MX + 10, y + 10);
    this.doc.setTextColor(...C.muted);
    this.doc.setFontSize(7.5);
    this.doc.setFont("helvetica", "normal");
    const lines = this.doc.splitTextToSize(insight, CW - 20);
    this.doc.text(lines, MX + 10, y + 19);

    y += 36;

    // ── vs Last Week ──
    this.doc.setTextColor(...C.ink);
    this.doc.setFontSize(10);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("vs Last Week", MX, y);
    y += 8;

    const vsItems = [
      { label: "Calories",    delta: d.vsLastWeek.calories,    unit: "kcal/day" },
      { label: "Weight",      delta: d.vsLastWeek.weight,      unit: "kg" },
      { label: "Consistency", delta: d.vsLastWeek.consistency, unit: "%" },
    ];
    const vw = (CW - 6) / 3;
    vsItems.forEach((v, i) => {
      const x = MX + i * (vw + 3);
      const isPos = v.delta >= 0;
      const col = v.label === "Weight"
        ? (v.delta <= 0 ? C.success : C.danger)
        : (isPos ? C.success : C.danger);
      this.doc.setFillColor(...C.white);
      this.doc.roundedRect(x, y, vw, 28, 5, 5, "F");
      this.doc.setDrawColor(...C.border);
      this.doc.setLineWidth(0.3);
      this.doc.roundedRect(x, y, vw, 28, 5, 5, "S");
      this.doc.setTextColor(...C.subtle);
      this.doc.setFontSize(6.5);
      this.doc.setFont("helvetica", "normal");
      this.doc.text(v.label.toUpperCase(), x + vw / 2, y + 9, { align: "center" });
      this.doc.setTextColor(...col);
      this.doc.setFontSize(12);
      this.doc.setFont("helvetica", "bold");
      this.doc.text(`${v.delta >= 0 ? "+" : ""}${v.delta.toFixed(1)} ${v.unit}`, x + vw / 2, y + 21, { align: "center" });
    });
  }

  // ─────────────────────────────────────────────
  //  PAGE 3 — DAILY BREAKDOWN (7-day table + bar chart)
  // ─────────────────────────────────────────────
  private dailyBreakdown(d: WeeklyReportData) {
    this.newPage("Daily Breakdown");
    let y = 24;

    this.doc.setTextColor(...C.ink);
    this.doc.setFontSize(13);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("7-Day Daily Breakdown", MX, y);
    y += 10;

    // ── Bar chart (calories per day) ──
    const chartH = 55;
    const chartW = CW;
    const days = d.dailyData.slice().reverse(); // oldest → newest
    const maxCal = Math.max(d.calorieTarget * 1.3, ...days.map(dd => dd.calories), 1);
    const barW = chartW / days.length;

    // Chart background
    this.doc.setFillColor(...C.surface);
    this.doc.roundedRect(MX, y, chartW, chartH, 5, 5, "F");

    // Target line
    const targetY = y + chartH - (d.calorieTarget / maxCal) * (chartH - 10) - 4;
    this.doc.setDrawColor(...C.warning);
    this.doc.setLineWidth(0.4);
    this.doc.setLineDashPattern([2, 2], 0);
    this.doc.line(MX + 2, targetY, MX + chartW - 2, targetY);
    this.doc.setLineDashPattern([], 0);
    this.doc.setTextColor(...C.warning);
    this.doc.setFontSize(5.5);
    this.doc.text(`Target ${d.calorieTarget}`, MX + chartW - 3, targetY - 1, { align: "right" });

    days.forEach((dd, i) => {
      const bh = dd.calories > 0 ? Math.max(2, ((dd.calories / maxCal) * (chartH - 10))) : 2;
      const bx = MX + i * barW + barW * 0.15;
      const bwi = barW * 0.7;
      const by = y + chartH - bh - 4;
      const col = dd.calories > d.calorieTarget * 1.1 ? C.warning : dd.calories > 0 ? C.green : C.border;
      this.doc.setFillColor(...col);
      this.doc.roundedRect(bx, by, bwi, bh, 1.5, 1.5, "F");
      // Day label
      this.doc.setTextColor(...C.subtle);
      this.doc.setFontSize(5.5);
      this.doc.setFont("helvetica", "normal");
      this.doc.text(format(new Date(dd.date), "EEE"), bx + bwi / 2, y + chartH - 1, { align: "center" });
    });

    y += chartH + 8;

    // ── Table ── (widths sum = 179 = CW - 3mm left pad)
    const cols = [
      { label: "Date",     w: 34 },
      { label: "Calories", w: 28 },
      { label: "Protein",  w: 22 },
      { label: "Carbs",    w: 20 },
      { label: "Fat",      w: 16 },
      { label: "Water",    w: 21 },
      { label: "Weight",   w: 22 },
      { label: "Status",   w: 16 },
    ];
    const ROW_H = 10;
    const HDR_H = 11;

    // Header row
    this.doc.setFillColor(...C.slate);
    this.doc.roundedRect(MX, y, CW, HDR_H, 3, 3, "F");
    let cx = MX + 3;
    cols.forEach(col => {
      this.doc.setTextColor(...C.white);
      this.doc.setFontSize(7);
      this.doc.setFont("helvetica", "bold");
      this.doc.text(col.label, cx, y + 7.5);
      cx += col.w;
    });
    y += HDR_H + 1;

    // Data rows
    days.forEach((dd, i) => {
      const rowBg = i % 2 === 0 ? C.white : C.surface;
      this.doc.setFillColor(...rowBg);
      this.doc.rect(MX, y, CW, ROW_H, "F");

      const calStatus = dd.calories === 0 ? "Not Logged"
        : dd.calories > d.calorieTarget * 1.1 ? "Above Target"
        : dd.calories < d.calorieTarget * 0.9 ? "Below Target"
        : "On Target";
      const statusCol = dd.calories === 0 ? C.subtle
        : dd.calories > d.calorieTarget * 1.1 ? C.warning
        : dd.calories < d.calorieTarget * 0.9 ? C.danger
        : C.success;

      const cells = [
        format(new Date(dd.date), "EEE, MMM d"),
        dd.calories > 0 ? `${dd.calories} kcal` : "—",
        dd.protein > 0 ? `${dd.protein}g` : "—",
        dd.carbs > 0 ? `${dd.carbs}g` : "—",
        dd.fat > 0 ? `${dd.fat}g` : "—",
        dd.water > 0 ? `${dd.water} cups` : "—",
        dd.weight ? `${dd.weight} kg` : "—",
        calStatus,
      ];

      cx = MX + 3;
      cells.forEach((cell, ci) => {
        const col = ci === 7 ? statusCol : C.muted;
        this.doc.setTextColor(...col);
        this.doc.setFontSize(7);
        this.doc.setFont("helvetica", ci === 7 ? "bold" : "normal");
        this.doc.text(cell, cx, y + 6.5);
        cx += cols[ci].w;
      });
      y += ROW_H;
    });

    // Row border
    this.doc.setDrawColor(...C.border);
    this.doc.setLineWidth(0.2);
    this.doc.rect(MX, y - days.length * ROW_H - HDR_H - 1, CW, days.length * ROW_H + HDR_H + 1, "S");

    y += 10;

    // ── Macro distribution ──
    this.doc.setTextColor(...C.ink);
    this.doc.setFontSize(10);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Weekly Macro Distribution", MX, y);
    y += 8;

    const macros = [
      { label: "Protein",      val: Math.round(d.avgProtein),  target: d.proteinTarget, unit: "g/day", color: C.teal   },
      { label: "Carbohydrates",val: Math.round(d.avgCarbs),    target: d.carbsTarget,   unit: "g/day", color: C.amber  },
      { label: "Fat",          val: Math.round(d.avgFat),      target: d.fatTarget,     unit: "g/day", color: C.violet },
    ];

    const mw = (CW - 6) / 3;
    macros.forEach((m, i) => {
      const x = MX + i * (mw + 3);
      const p = pct(m.val, m.target);
      this.doc.setFillColor(...C.white);
      this.doc.roundedRect(x, y, mw, 38, 5, 5, "F");
      this.doc.setDrawColor(...C.border);
      this.doc.setLineWidth(0.3);
      this.doc.roundedRect(x, y, mw, 38, 5, 5, "S");
      gradientRect(this.doc, x, y, mw, 3, m.color, m.color);

      this.doc.setTextColor(...C.subtle);
      this.doc.setFontSize(6.5);
      this.doc.setFont("helvetica", "normal");
      this.doc.text(m.label.toUpperCase(), x + mw / 2, y + 11, { align: "center" });

      this.doc.setTextColor(...C.ink);
      this.doc.setFontSize(13);
      this.doc.setFont("helvetica", "bold");
      this.doc.text(`${m.val}${m.unit.split("/")[0]}`, x + mw / 2, y + 23, { align: "center" });

      this.doc.setTextColor(...C.subtle);
      this.doc.setFontSize(6);
      this.doc.text(`Target: ${m.target}${m.unit.split("/")[0]}`, x + mw / 2, y + 30, { align: "center" });

      progressBar(this.doc, x + 5, y + 33, mw - 10, 3, p, m.color);
    });
  }

  // ─────────────────────────────────────────────
  //  PAGE 4 — HABIT INTELLIGENCE
  // ─────────────────────────────────────────────
  private habitIntelligence(d: WeeklyReportData) {
    this.newPage("Habit Intelligence");
    let y = 24;

    this.doc.setTextColor(...C.ink);
    this.doc.setFontSize(13);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Habit Intelligence", MX, y);
    y += 10;

    // ── Consistency + Streak row ──
    const hw = (CW - 4) / 2;

    // Consistency card
    this.doc.setFillColor(...C.white);
    this.doc.roundedRect(MX, y, hw, 50, 6, 6, "F");
    this.doc.setDrawColor(...C.border);
    this.doc.setLineWidth(0.3);
    this.doc.roundedRect(MX, y, hw, 50, 6, 6, "S");
    gradientRect(this.doc, MX, y, hw, 3, C.violet, C.violet);

    this.doc.setTextColor(...C.subtle);
    this.doc.setFontSize(7);
    this.doc.setFont("helvetica", "normal");
    this.doc.text("LOGGING CONSISTENCY", MX + hw / 2, y + 12, { align: "center" });

    const consCol = d.consistencyScore >= 70 ? C.success : d.consistencyScore >= 40 ? C.warning : C.danger;
    this.doc.setTextColor(...consCol);
    this.doc.setFontSize(26);
    this.doc.setFont("helvetica", "bold");
    this.doc.text(`${d.consistencyScore}%`, MX + hw / 2, y + 32, { align: "center" });

    this.doc.setTextColor(...C.subtle);
    this.doc.setFontSize(6.5);
    this.doc.setFont("helvetica", "normal");
    this.doc.text(`${d.daysLogged} of ${d.totalDays} days logged`, MX + hw / 2, y + 42, { align: "center" });
    progressBar(this.doc, MX + 8, y + 46, hw - 16, 3, d.consistencyScore, consCol);

    // Streak card
    const sx = MX + hw + 4;
    this.doc.setFillColor(...C.white);
    this.doc.roundedRect(sx, y, hw, 50, 6, 6, "F");
    this.doc.setDrawColor(...C.border);
    this.doc.setLineWidth(0.3);
    this.doc.roundedRect(sx, y, hw, 50, 6, 6, "S");
    gradientRect(this.doc, sx, y, hw, 3, C.amber, C.amber);

    this.doc.setTextColor(...C.subtle);
    this.doc.setFontSize(7);
    this.doc.setFont("helvetica", "normal");
    this.doc.text("TRACKING STREAK", sx + hw / 2, y + 12, { align: "center" });

    this.doc.setTextColor(...C.amber);
    this.doc.setFontSize(26);
    this.doc.setFont("helvetica", "bold");
    this.doc.text(`${d.currentStreak}`, sx + hw / 2, y + 32, { align: "center" });

    this.doc.setTextColor(...C.subtle);
    this.doc.setFontSize(6.5);
    this.doc.setFont("helvetica", "normal");
    this.doc.text(`days  |  Best: ${d.bestStreak} days`, sx + hw / 2, y + 42, { align: "center" });
    progressBar(this.doc, sx + 8, y + 46, hw - 16, 3, Math.min(100, Math.round(d.currentStreak / Math.max(d.bestStreak, 1) * 100)), C.amber);

    y += 58;

    // ── Habit patterns ──
    this.doc.setTextColor(...C.ink);
    this.doc.setFontSize(10);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Observed Patterns", MX, y);
    y += 8;

    const risks: { text: string; level: "ok" | "warn" | "bad" }[] = [];
    if (d.daysLogged >= 5) risks.push({ text: `Strong logging frequency: ${d.daysLogged}/7 days tracked.`, level: "ok" });
    else if (d.daysLogged >= 3) risks.push({ text: `Moderate logging: ${d.daysLogged}/7 days. Aim for 5+ days.`, level: "warn" });
    else risks.push({ text: `Low logging: only ${d.daysLogged}/7 days. Insights may be limited.`, level: "bad" });

    const vari = this.variance(d.dailyData.map(dd => dd.calories).filter(c => c > 0));
    if (vari < 10) risks.push({ text: "Calorie intake is highly consistent day-to-day.", level: "ok" });
    else if (vari < 25) risks.push({ text: "Moderate calorie variance detected. Meal planning can help.", level: "warn" });
    else risks.push({ text: "High calorie variance. Consider establishing regular meal patterns.", level: "bad" });

    const protRatio = d.avgProtein / d.proteinTarget;
    if (protRatio >= 0.9) risks.push({ text: `Excellent protein intake at ${Math.round(protRatio * 100)}% of target.`, level: "ok" });
    else if (protRatio >= 0.6) risks.push({ text: `Protein at ${Math.round(protRatio * 100)}% of target. Add protein sources.`, level: "warn" });
    else risks.push({ text: `Protein gap: only ${Math.round(protRatio * 100)}% of target. Prioritise protein-rich meals.`, level: "bad" });

    const weekendHigh = d.dailyData.filter(dd => {
      const day = new Date(dd.date).getDay();
      return (day === 0 || day === 6) && dd.calories > d.calorieTarget * 1.2;
    });
    if (weekendHigh.length > 0) risks.push({ text: "Weekend intake spike detected. Pre-plan weekend meals.", level: "warn" });
    else risks.push({ text: "No significant weekend intake deviation observed.", level: "ok" });

    risks.forEach(r => {
      const col = r.level === "ok" ? C.success : r.level === "warn" ? C.warning : C.danger;
      const bg  = r.level === "ok" ? [240, 253, 244] as [number,number,number]
                : r.level === "warn" ? [255, 251, 235] as [number,number,number]
                : [254, 242, 242] as [number,number,number];
      this.doc.setFillColor(...bg);
      this.doc.roundedRect(MX, y, CW, 12, 3, 3, "F");
      this.doc.setFillColor(...col);
      this.doc.circle(MX + 5, y + 6, 3, "F");
      this.doc.setTextColor(...C.ink);
      this.doc.setFontSize(7.5);
      this.doc.setFont("helvetica", "normal");
      this.doc.text(r.text, MX + 12, y + 7.5);
      y += 15;
    });

    y += 4;

    // ── Momentum score ──
    let momentum = 0;
    if (d.consistencyScore > 50) momentum += 2;
    if (protRatio > 0.7) momentum += 2;
    if (vari < 20) momentum += 2;
    if (d.waterAverage > 5) momentum += 2;
    if (d.currentStreak > 3) momentum += 2;
    momentum -= 5;

    const mStatus = momentum > 2 ? "Building" : momentum < -2 ? "Adjusting" : "Stable";
    const mColor  = momentum > 2 ? C.success : momentum < -2 ? C.danger : C.warning;

    this.doc.setFillColor(...C.surface);
    this.doc.roundedRect(MX, y, CW, 38, 6, 6, "F");

    this.doc.setFillColor(...mColor);
    this.doc.circle(MX + 22, y + 19, 14, "F");
    this.doc.setFillColor(...C.surface);
    this.doc.circle(MX + 22, y + 19, 10, "F");
    this.doc.setTextColor(...mColor);
    this.doc.setFontSize(11);
    this.doc.setFont("helvetica", "bold");
    this.doc.text(momentum > 0 ? `+${momentum}` : `${momentum}`, MX + 22, y + 23, { align: "center" });

    this.doc.setTextColor(...C.ink);
    this.doc.setFontSize(10);
    this.doc.setFont("helvetica", "bold");
    this.doc.text(`Momentum: ${mStatus}`, MX + 42, y + 15);
    this.doc.setTextColor(...C.muted);
    this.doc.setFontSize(7.5);
    this.doc.setFont("helvetica", "normal");
    const mInsight = momentum > 2
      ? "Your habits are trending positively. Consistency is creating compounding benefits."
      : momentum < -2
      ? "Momentum has slowed. Set daily reminders to rebuild consistency."
      : "Habits are holding steady. Small intentional improvements will build momentum.";
    const mLines = this.doc.splitTextToSize(mInsight, CW - 50);
    this.doc.text(mLines, MX + 42, y + 25);

    y += 46;

    // ── Recommendations ──
    this.doc.setTextColor(...C.ink);
    this.doc.setFontSize(10);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Personalised Recommendations", MX, y);
    y += 8;

    const recs: { title: string; desc: string }[] = [];
    if (protRatio < 0.8) recs.push({ title: "Add Protein to Every Meal", desc: "Include eggs, chicken, fish, or Greek yogurt at each meal to close the protein gap." });
    if (Math.abs(d.avgCalories - d.calorieTarget) > 200) recs.push({ title: "Plan Meals Ahead", desc: "Spend 10 min each evening planning tomorrow's meals to align intake with your target." });
    if (d.consistencyScore < 70) recs.push({ title: "Establish Logging Rituals", desc: "Link logging to existing habits: log breakfast with coffee, lunch right after eating." });
    if (recs.length < 3) recs.push({ title: "Prep Ingredients on Weekends", desc: "Prepare grilled protein, roasted vegetables, and cooked grains for quick weekday meals." });

    recs.slice(0, 3).forEach((r, i) => {
      this.doc.setFillColor(...C.white);
      this.doc.roundedRect(MX, y, CW, 22, 4, 4, "F");
      this.doc.setDrawColor(...C.border);
      this.doc.setLineWidth(0.3);
      this.doc.roundedRect(MX, y, CW, 22, 4, 4, "S");

      this.doc.setFillColor(...C.green);
      this.doc.roundedRect(MX, y, 22, 22, 4, 4, "F");
      this.doc.setTextColor(...C.white);
      this.doc.setFontSize(11);
      this.doc.setFont("helvetica", "bold");
      this.doc.text(`${i + 1}`, MX + 11, y + 14, { align: "center" });

      this.doc.setTextColor(...C.ink);
      this.doc.setFontSize(8.5);
      this.doc.setFont("helvetica", "bold");
      this.doc.text(r.title, MX + 28, y + 9);
      this.doc.setTextColor(...C.muted);
      this.doc.setFontSize(7);
      this.doc.setFont("helvetica", "normal");
      const dl = this.doc.splitTextToSize(r.desc, CW - 36);
      this.doc.text(dl, MX + 28, y + 17);
      y += 26;
    });
  }

  // ─────────────────────────────────────────────
  //  PAGE 5 — MEAL PLAN + TIMELINE + DISCLAIMER
  // ─────────────────────────────────────────────
  private mealPlanAndTimeline(d: WeeklyReportData) {
    this.newPage("Meal Plan & Timeline");
    let y = 24;

    // ── Meal plan ──
    this.doc.setTextColor(...C.ink);
    this.doc.setFontSize(13);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Next Week Meal Plan", MX, y);
    y += 8;

    if (!d.mealPlan || d.mealPlan.length === 0) {
      this.doc.setFillColor(...C.surface);
      this.doc.roundedRect(MX, y, CW, 30, 5, 5, "F");
      this.doc.setTextColor(...C.muted);
      this.doc.setFontSize(8);
      this.doc.setFont("helvetica", "normal");
      this.doc.text("No meal plan generated. Open the app to create your personalised 7-day meal plan.", MX + 8, y + 18);
      y += 38;
    } else {
      // Summary stats row
      const totals = d.mealPlan.reduce((t, day) => ({ cal: t.cal + day.dailyCalories, prot: t.prot + day.dailyProtein, price: t.price + day.dailyPrice }), { cal: 0, prot: 0, price: 0 });
      const mpStats = [
        { label: "Avg Calories",  val: `${Math.round(totals.cal / 7)} kcal/day`,   color: C.green  },
        { label: "Avg Protein",   val: `${Math.round(totals.prot / 7)}g/day`,       color: C.teal   },
        { label: "Est. Cost",     val: `QAR ${totals.price.toFixed(0)}/week`,        color: C.amber  },
      ];
      const sw = (CW - 6) / 3;
      mpStats.forEach((s, i) => {
        const x = MX + i * (sw + 3);
        this.doc.setFillColor(...C.white);
        this.doc.roundedRect(x, y, sw, 20, 4, 4, "F");
        gradientRect(this.doc, x, y, sw, 3, s.color, s.color);
        this.doc.setTextColor(...C.subtle);
        this.doc.setFontSize(6);
        this.doc.text(s.label.toUpperCase(), x + sw / 2, y + 10, { align: "center" });
        this.doc.setTextColor(...C.ink);
        this.doc.setFontSize(9);
        this.doc.setFont("helvetica", "bold");
        this.doc.text(s.val, x + sw / 2, y + 17, { align: "center" });
      });
      y += 26;

      // Day rows (compact)
      const typeColors: Record<string, [number,number,number]> = { Breakfast: C.amber, Lunch: C.success, Dinner: C.cyan, Snack: C.violet };
      d.mealPlan.slice(0, 7).forEach(day => {
        if (y > 220) { this.newPage("Meal Plan (cont.)"); y = 24; }

        // Day header
        this.doc.setFillColor(...C.slate);
        this.doc.roundedRect(MX, y, CW, 10, 3, 3, "F");
        this.doc.setTextColor(...C.white);
        this.doc.setFontSize(8);
        this.doc.setFont("helvetica", "bold");
        this.doc.text(`${day.day}  —  ${day.date}`, MX + 5, y + 7);
        this.doc.setFontSize(7);
        this.doc.text(`${day.dailyCalories} kcal  |  ${day.dailyProtein}g protein  |  QAR ${day.dailyPrice.toFixed(0)}`, W - MX - 3, y + 7, { align: "right" });
        y += 12;

        const meals = [
          { type: "Breakfast", meal: day.breakfast },
          { type: "Lunch",     meal: day.lunch     },
          { type: "Dinner",    meal: day.dinner     },
        ];
        const ROW_MEAL = 22;
        const IMG_W = 22, IMG_H = 18;
        meals.forEach(({ type, meal }) => {
          if (!meal) return;
          if (y + ROW_MEAL > 270) { this.newPage("Meal Plan (cont.)"); y = 24; }
          const tc = typeColors[type] || C.green;

          // Card background
          this.doc.setFillColor(248, 250, 252);
          this.doc.roundedRect(MX + 2, y, CW - 4, ROW_MEAL, 3, 3, "F");

          // Meal image (if available)
          let imgOffset = 0;
          if (meal.image_url) {
            try {
              this.doc.addImage(meal.image_url, "JPEG", MX + 4, y + 2, IMG_W, IMG_H, undefined, "FAST");
              imgOffset = IMG_W + 4;
            } catch { imgOffset = 0; }
          }

          // Meal type pill
          pill(this.doc, MX + 4 + imgOffset, y + 2, 22, 8, tc, type);

          // Meal name
          this.doc.setTextColor(...C.ink);
          this.doc.setFontSize(8);
          this.doc.setFont("helvetica", "bold");
          const name = meal.name.length > 34 ? meal.name.slice(0, 31) + "…" : meal.name;
          this.doc.text(name, MX + 4 + imgOffset, y + 14);

          // Nutrition info
          this.doc.setTextColor(...C.subtle);
          this.doc.setFontSize(6.5);
          this.doc.setFont("helvetica", "normal");
          const rest = meal.restaurant_name ? `${meal.restaurant_name}  |  ` : "";
          this.doc.text(`${rest}${meal.calories ?? "—"} kcal  |  ${meal.protein_g ?? "—"}g protein`, MX + 4 + imgOffset, y + 19.5);

          y += ROW_MEAL + 2;
        });
        y += 3;
      });
    }

    // ── Progress timeline ──
    if (y > 210) { this.newPage("Progress Timeline"); y = 24; }
    this.doc.setTextColor(...C.ink);
    this.doc.setFontSize(10);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Progress Timeline", MX, y);
    y += 8;

    this.doc.setFillColor(...C.surface);
    this.doc.roundedRect(MX, y, CW, 40, 6, 6, "F");

    if (d.daysLogged >= 4) {
      const calDiff = Math.abs(d.avgCalories - d.calorieTarget);
      const cons = d.consistencyScore / 100;
      const base = calDiff > 300 ? 12 : calDiff > 100 ? 8 : 4;
      const weeks = Math.round(base / Math.max(cons, 0.3));
      const speed = weeks > 12 ? "Gradual" : weeks > 6 ? "Moderate" : "Accelerated";

      this.doc.setTextColor(...C.muted);
      this.doc.setFontSize(7.5);
      this.doc.setFont("helvetica", "normal");
      this.doc.text("At your current pace, estimated time to goal alignment:", MX + 8, y + 13);

      this.doc.setTextColor(...C.green);
      this.doc.setFontSize(22);
      this.doc.setFont("helvetica", "bold");
      this.doc.text(`${weeks} weeks`, MX + 8, y + 30);

      this.doc.setTextColor(...C.subtle);
      this.doc.setFontSize(7);
      this.doc.text(`Progress rate: ${speed}  |  Goal: ${d.activeGoal || "General Health"}`, MX + 8, y + 37);
    } else {
      this.doc.setTextColor(...C.muted);
      this.doc.setFontSize(8);
      this.doc.setFont("helvetica", "normal");
      this.doc.text(`Log at least 4 days to unlock timeline projections. Currently: ${d.daysLogged}/7 days.`, MX + 8, y + 22);
    }

    y += 48;

    // ── Data completeness ──
    const dcTitle = d.daysLogged < 3 ? "Limited Dataset" : d.daysLogged < 6 ? "Moderate Dataset" : "Complete Dataset";
    const dcColor = d.daysLogged < 3 ? C.warning : d.daysLogged < 6 ? C.teal : C.success;
    const dcText  = d.daysLogged < 3
      ? "Log at least 5 days/week for comprehensive insights and personalised recommendations."
      : d.daysLogged < 6
      ? "Good data coverage. Continue improving daily tracking for the most accurate analysis."
      : "Full dataset. All analysis features and recommendations are fully activated.";

    this.doc.setFillColor(...C.white);
    this.doc.roundedRect(MX, y, CW, 22, 5, 5, "F");
    this.doc.setFillColor(...dcColor);
    this.doc.roundedRect(MX, y, 5, 22, 2, 2, "F");
    this.doc.setTextColor(...C.ink);
    this.doc.setFontSize(8.5);
    this.doc.setFont("helvetica", "bold");
    this.doc.text(dcTitle, MX + 12, y + 9);
    this.doc.setTextColor(...C.muted);
    this.doc.setFontSize(7);
    this.doc.setFont("helvetica", "normal");
    this.doc.text(dcText, MX + 12, y + 17);

    y += 30;

    // ── Disclaimer ──
    this.doc.setFillColor(...C.slate);
    this.doc.roundedRect(MX, y, CW, 26, 5, 5, "F");
    this.doc.setTextColor(...C.white);
    this.doc.setFontSize(7.5);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("About This Report", MX + 8, y + 9);
    this.doc.setFontSize(6.5);
    this.doc.setFont("helvetica", "normal");
    const disc = "Generated from self-reported tracking data for lifestyle performance optimisation. This is not a medical report and does not provide medical advice. Consult a qualified healthcare professional for clinical guidance.";
    const dLines = this.doc.splitTextToSize(disc, CW - 16);
    this.doc.text(dLines, MX + 8, y + 17);
  }

  // ─────────────────────────────────────────────
  //  PAGE — ANALYTICS
  // ─────────────────────────────────────────────
  private analyticsPage(d: WeeklyReportData) {
    this.newPage("Analytics");
    let y = 24;

    // ── Page title ──
    this.doc.setTextColor(...C.ink);
    this.doc.setFontSize(13);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Analytics", MX, y);
    this.doc.setTextColor(...C.subtle);
    this.doc.setFontSize(7.5);
    this.doc.setFont("helvetica", "normal");
    this.doc.text("Weekly water intake and macro nutrient breakdown", MX, y + 7);
    y += 18;

    const days = d.dailyData.slice(); // oldest → newest (already ordered)

    // ══════════════════════════════════════════
    //  1. WATER INTAKE BAR CHART
    // ══════════════════════════════════════════
    this.doc.setTextColor(...C.ink);
    this.doc.setFontSize(10);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Water Intake", MX, y);
    this.doc.setTextColor(...C.subtle);
    this.doc.setFontSize(7);
    this.doc.setFont("helvetica", "normal");
    this.doc.text("(glasses / day)", MX + 32, y);
    y += 6;

    const waterChartH = 48;
    const waterChartW = CW;
    const waterTarget = 8; // glasses
    const maxWater = Math.max(waterTarget * 1.3, ...days.map(dd => dd.water), 1);
    const wBarW = waterChartW / days.length;

    // Chart background
    this.doc.setFillColor(...C.surface);
    this.doc.roundedRect(MX, y, waterChartW, waterChartH, 4, 4, "F");

    // Target dashed line
    const wTargetY = y + waterChartH - (waterTarget / maxWater) * (waterChartH - 10) - 4;
    this.doc.setDrawColor(...C.cyan);
    this.doc.setLineWidth(0.4);
    this.doc.setLineDashPattern([2, 2], 0);
    this.doc.line(MX + 2, wTargetY, MX + waterChartW - 2, wTargetY);
    this.doc.setLineDashPattern([], 0);
    this.doc.setTextColor(...C.cyan);
    this.doc.setFontSize(5.5);
    this.doc.text(`Target ${waterTarget} glasses`, MX + waterChartW - 3, wTargetY - 1, { align: "right" });

    days.forEach((dd, i) => {
      const val = dd.water;
      const bh = val > 0 ? Math.max(2, (val / maxWater) * (waterChartH - 10)) : 2;
      const bx = MX + i * wBarW + wBarW * 0.2;
      const bwi = wBarW * 0.6;
      const by = y + waterChartH - bh - 4;
      const col: [number,number,number] = val >= waterTarget ? C.cyan : val > 0 ? C.teal : C.border;
      this.doc.setFillColor(...col);
      this.doc.roundedRect(bx, by, bwi, bh, 1, 1, "F");
      // Value label on top of bar
      if (val > 0) {
        this.doc.setTextColor(...C.muted);
        this.doc.setFontSize(5);
        this.doc.setFont("helvetica", "bold");
        this.doc.text(`${val}`, bx + bwi / 2, by - 1, { align: "center" });
      }
      // Day label
      this.doc.setTextColor(...C.subtle);
      this.doc.setFontSize(5.5);
      this.doc.setFont("helvetica", "normal");
      this.doc.text(format(new Date(dd.date), "EEE"), bx + bwi / 2, y + waterChartH - 1, { align: "center" });
    });

    // Legend
    y += waterChartH + 4;
    this.doc.setFillColor(...C.cyan);
    this.doc.roundedRect(MX, y, 3, 3, 0.5, 0.5, "F");
    this.doc.setTextColor(...C.subtle);
    this.doc.setFontSize(6);
    this.doc.text("Met target", MX + 5, y + 2.5);
    this.doc.setFillColor(...C.teal);
    this.doc.roundedRect(MX + 26, y, 3, 3, 0.5, 0.5, "F");
    this.doc.text("Below target", MX + 31, y + 2.5);
    y += 10;

    // ══════════════════════════════════════════
    //  2. DAILY MACROS GROUPED BAR CHART
    // ══════════════════════════════════════════
    this.doc.setTextColor(...C.ink);
    this.doc.setFontSize(10);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Daily Macros Breakdown", MX, y);
    this.doc.setTextColor(...C.subtle);
    this.doc.setFontSize(7);
    this.doc.setFont("helvetica", "normal");
    this.doc.text("(grams — protein / carbs / fat)", MX + 56, y);
    y += 6;

    const macroChartH = 52;
    const macroChartW = CW;
    const maxMacro = Math.max(
      ...days.map(dd => Math.max(dd.protein, dd.carbs, dd.fat)), 1
    );
    const groupW = macroChartW / days.length;
    const barGap = 0.8;
    const mBarW = (groupW * 0.75 - barGap * 2) / 3;

    // Chart background
    this.doc.setFillColor(...C.surface);
    this.doc.roundedRect(MX, y, macroChartW, macroChartH, 4, 4, "F");

    const macroCols: [number,number,number][] = [C.violet, C.amber, C.teal];

    days.forEach((dd, i) => {
      const gx = MX + i * groupW + groupW * 0.125;
      const macroVals = [dd.protein, dd.carbs, dd.fat];
      macroVals.forEach((val, mi) => {
        const bh = val > 0 ? Math.max(2, (val / maxMacro) * (macroChartH - 12)) : 2;
        const bx = gx + mi * (mBarW + barGap);
        const by = y + macroChartH - bh - 6;
        this.doc.setFillColor(...macroCols[mi]);
        this.doc.roundedRect(bx, by, mBarW, bh, 0.8, 0.8, "F");
      });
      // Day label
      this.doc.setTextColor(...C.subtle);
      this.doc.setFontSize(5.5);
      this.doc.setFont("helvetica", "normal");
      this.doc.text(format(new Date(dd.date), "EEE"), gx + (mBarW * 3 + barGap * 2) / 2, y + macroChartH - 1.5, { align: "center" });
    });

    // Legend
    y += macroChartH + 4;
    const macroLabels = ["Protein", "Carbs", "Fat"];
    macroLabels.forEach((lbl, i) => {
      const lx = MX + i * 28;
      this.doc.setFillColor(...macroCols[i]);
      this.doc.roundedRect(lx, y, 3, 3, 0.5, 0.5, "F");
      this.doc.setTextColor(...C.subtle);
      this.doc.setFontSize(6);
      this.doc.text(lbl, lx + 5, y + 2.5);
    });
    y += 10;

    // ══════════════════════════════════════════
    //  3. SUMMARY NUMBERS ROW
    // ══════════════════════════════════════════
    const totalWater = days.reduce((s, dd) => s + dd.water, 0);
    const avgWater = days.length > 0 ? (totalWater / days.length).toFixed(1) : "0";
    const avgProtein = days.length > 0 ? Math.round(days.reduce((s, dd) => s + dd.protein, 0) / days.length) : 0;
    const avgCarbs   = days.length > 0 ? Math.round(days.reduce((s, dd) => s + dd.carbs,   0) / days.length) : 0;
    const avgFat     = days.length > 0 ? Math.round(days.reduce((s, dd) => s + dd.fat,     0) / days.length) : 0;

    const summaryItems = [
      { label: "Avg Water/day", value: `${avgWater} glasses`, color: C.cyan },
      { label: "Avg Protein",   value: `${avgProtein}g`,      color: C.violet },
      { label: "Avg Carbs",     value: `${avgCarbs}g`,        color: C.amber },
      { label: "Avg Fat",       value: `${avgFat}g`,          color: C.teal },
    ];

    const cardW = (CW - 6) / 4;
    summaryItems.forEach((item, i) => {
      const cx = MX + i * (cardW + 2);
      this.doc.setFillColor(...C.white);
      this.doc.roundedRect(cx, y, cardW, 30, 4, 4, "F");
      this.doc.setDrawColor(...C.border);
      this.doc.setLineWidth(0.3);
      this.doc.roundedRect(cx, y, cardW, 30, 4, 4, "S");
      gradientRect(this.doc, cx, y, cardW, 2.5, item.color, item.color);
      this.doc.setTextColor(...C.subtle);
      this.doc.setFontSize(6);
      this.doc.setFont("helvetica", "normal");
      this.doc.text(item.label, cx + cardW / 2, y + 11, { align: "center" });
      this.doc.setTextColor(...C.ink);
      this.doc.setFontSize(11);
      this.doc.setFont("helvetica", "bold");
      this.doc.text(item.value, cx + cardW / 2, y + 23, { align: "center" });
    });

    y += 38;

    // ══════════════════════════════════════════
    //  4. BMI GAUGE — new page to avoid overflow
    // ══════════════════════════════════════════
    const bmi = d.trackerInsights?.bmi ?? null;
    if (bmi !== null) {
      this.newPage("Analytics — BMI");
      y = 24;

      this.doc.setTextColor(...C.ink);
      this.doc.setFontSize(13);
      this.doc.setFont("helvetica", "bold");
      this.doc.text("BMI — Body Mass Index", MX, y);
      this.doc.setTextColor(...C.subtle);
      this.doc.setFontSize(7.5);
      this.doc.setFont("helvetica", "normal");
      this.doc.text("Body Mass Index based on height and current weight", MX, y + 7);
      y += 18;

      // Semicircle gauge drawn with jsPDF arcs
      // We draw thick arc segments using many thin lines approximating arcs
      const gaugeCX = MX + CW / 2; // center X
      const gaugeCY = y + 38;      // center Y (bottom of arc area)
      const gaugeR  = 34;          // radius mm
      const strokeW = 5;           // segment thickness

      // 6 color segments across 180° (left=180° to right=0°)
      const segColors: { startDeg: number; endDeg: number; rgb: [number,number,number] }[] = [
        { startDeg: 180, endDeg: 150, rgb: [99,  102, 241] }, // indigo  (BMI <16)
        { startDeg: 150, endDeg: 120, rgb: [59,  130, 246] }, // blue    (16-18.4)
        { startDeg: 120, endDeg:  90, rgb: [34,  197,  94] }, // green   (18.5-24.9)
        { startDeg:  90, endDeg:  60, rgb: [245, 158,  11] }, // amber   (25-29.9)
        { startDeg:  60, endDeg:  30, rgb: [249, 115,  22] }, // orange  (30-34.9)
        { startDeg:  30, endDeg:   0, rgb: [239,  68,  68] }, // red     (35+)
      ];

      // Draw track (grey background)
      this.doc.setDrawColor(226, 232, 240);
      this.doc.setLineWidth(strokeW);
      for (let deg = 0; deg <= 180; deg += 2) {
        const a1 = ((180 - deg) * Math.PI) / 180;
        const a2 = ((180 - (deg + 2)) * Math.PI) / 180;
        const x1 = gaugeCX + gaugeR * Math.cos(a1);
        const y1 = gaugeCY - gaugeR * Math.sin(a1);
        const x2 = gaugeCX + gaugeR * Math.cos(a2);
        const y2 = gaugeCY - gaugeR * Math.sin(a2);
        this.doc.line(x1, y1, x2, y2);
      }

      // Draw colored segments
      segColors.forEach(seg => {
        this.doc.setDrawColor(...seg.rgb);
        this.doc.setLineWidth(strokeW);
        const fromDeg = Math.min(seg.startDeg, seg.endDeg);
        const toDeg   = Math.max(seg.startDeg, seg.endDeg);
        for (let deg = fromDeg; deg <= toDeg; deg += 2) {
          const a1 = (deg * Math.PI) / 180;
          const a2 = ((deg + 2) * Math.PI) / 180;
          const x1 = gaugeCX + gaugeR * Math.cos(a1);
          const y1 = gaugeCY - gaugeR * Math.sin(a1);
          const x2 = gaugeCX + gaugeR * Math.cos(a2);
          const y2 = gaugeCY - gaugeR * Math.sin(a2);
          this.doc.line(x1, y1, x2, y2);
        }
      });

      // Needle
      const clampedBmi = Math.max(15, Math.min(40, bmi));
      // Map BMI 15→40 to angle 180°→0°
      const needleAngleDeg = 180 - ((clampedBmi - 15) / 25) * 180;
      const needleRad = (needleAngleDeg * Math.PI) / 180;
      const needleLen = gaugeR - 2;
      const nx = gaugeCX + needleLen * Math.cos(needleRad);
      const ny = gaugeCY - needleLen * Math.sin(needleRad);
      this.doc.setDrawColor(...C.ink);
      this.doc.setLineWidth(1);
      this.doc.line(gaugeCX, gaugeCY, nx, ny);
      this.doc.setFillColor(...C.ink);
      this.doc.circle(gaugeCX, gaugeCY, 2, "F");

      // BMI value label
      this.doc.setTextColor(...C.ink);
      this.doc.setFontSize(16);
      this.doc.setFont("helvetica", "bold");
      this.doc.text(bmi.toFixed(1), gaugeCX, gaugeCY - 10, { align: "center" });
      this.doc.setTextColor(...C.subtle);
      this.doc.setFontSize(6.5);
      this.doc.setFont("helvetica", "normal");
      this.doc.text("BMI (kg/m\u00B2)", gaugeCX, gaugeCY + 7, { align: "center" });

      // Status pill
      const bmiColor: [number,number,number] = bmi < 18.5 ? [59,130,246] : bmi < 25 ? [34,197,94] : bmi < 30 ? [245,158,11] : bmi < 35 ? [249,115,22] : [239,68,68];
      const bmiLabelText = d.trackerInsights?.bmiLabel ?? (bmi < 18.5 ? "Underweight" : bmi < 25 ? "Normal" : bmi < 30 ? "Overweight" : bmi < 35 ? "Obese I" : "Obese II");
      pill(this.doc, gaugeCX - 18, gaugeCY + 10, 36, 8, bmiColor, bmiLabelText);

      // Legend starts well below the pill (pill bottom = gaugeCY + 18)
      y = gaugeCY + 28;

      // Divider
      this.doc.setDrawColor(...C.border);
      this.doc.setLineWidth(0.3);
      this.doc.line(MX, y, W - MX, y);
      y += 6;

      // BMI legend — single-column, full-width rows
      const bmiRanges = [
        { label: "Underweight II", range: "BMI < 16.0",      rgb: [99,102,241]  as [number,number,number] },
        { label: "Underweight I",  range: "BMI 16.0 – 18.4", rgb: [59,130,246]  as [number,number,number] },
        { label: "Normal",         range: "BMI 18.5 – 24.9", rgb: [34,197,94]   as [number,number,number] },
        { label: "Overweight",     range: "BMI 25.0 – 29.9", rgb: [245,158,11]  as [number,number,number] },
        { label: "Obese I",        range: "BMI 30.0 – 34.9", rgb: [249,115,22]  as [number,number,number] },
        { label: "Obese II",       range: "BMI 35.0 – 39.9", rgb: [239,68,68]   as [number,number,number] },
      ];

      bmiRanges.forEach((row, i) => {
        const ly = y + i * 9;
        // Alternating row background
        if (i % 2 === 0) {
          this.doc.setFillColor(...C.surface);
          this.doc.rect(MX, ly - 2, CW, 9, "F");
        }
        this.doc.setFillColor(...row.rgb);
        this.doc.circle(MX + 4, ly + 2.5, 2.5, "F");
        this.doc.setTextColor(...C.muted);
        this.doc.setFontSize(7.5);
        this.doc.setFont("helvetica", "bold");
        this.doc.text(row.label, MX + 10, ly + 4);
        this.doc.setTextColor(...C.subtle);
        this.doc.setFont("helvetica", "normal");
        this.doc.text(row.range, W - MX, ly + 4, { align: "right" });
      });
    }
  }

  // ─────────────────────────────────────────────
  //  GENERATE + DOWNLOAD
  // ─────────────────────────────────────────────
  generate(d: WeeklyReportData): jsPDF {
    this.page = 1;

    // Page 1 — Cover
    this.cover(d);

    // Page 2 — Executive Summary
    this.executiveSummary(d);

    // Page 3 — Daily Breakdown
    this.dailyBreakdown(d);

    // Page 4 — Habit Intelligence
    this.habitIntelligence(d);

    // Page 5 — Analytics (التحليلات)
    this.analyticsPage(d);

    // Page 6+ — Meal Plan & Timeline
    this.mealPlanAndTimeline(d);

    // Stamp footers on all inner pages (skip cover)
    this.total = this.page;
    for (let p = 2; p <= this.total; p++) {
      this.doc.setPage(p);
      this.footer();
    }

    return this.doc;
  }

  async download(data: WeeklyReportData, filename?: string) {
    await this.loadLogo();
    this.doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
    const pdf = this.generate(data);
    const fn = filename ?? `nutrio-weekly-report-${format(new Date(), "yyyy-MM-dd")}.pdf`;

    if (Capacitor.isNativePlatform()) {
      const base64 = pdf.output("datauristring").split(",")[1];
      // Write to Cache (no permissions needed on Android or iOS) then share
      const saved = await Filesystem.writeFile({
        path: fn,
        data: base64,
        directory: Directory.Cache,
      });
      await Share.share({
        title: "Nutrio Weekly Report",
        text: "Your Nutrio weekly nutrition report",
        url: saved.uri,
        dialogTitle: "Save or share your report",
      });
    } else {
      pdf.save(fn);
    }
  }

  async getBlob(data: WeeklyReportData): Promise<Blob> {
    await this.loadLogo();
    this.doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
    const pdf = this.generate(data);
    return pdf.output("blob");
  }
}

export const nutrioReportPDF = new NutrioReportPDF();
