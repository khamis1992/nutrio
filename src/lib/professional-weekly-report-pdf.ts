import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

const COLORS = {
  primary: [16, 185, 129] as [number, number, number],
  primaryDark: [5, 150, 105] as [number, number, number],
  accent: [6, 182, 212] as [number, number, number],
  warning: [245, 158, 11] as [number, number, number],
  danger: [239, 68, 68] as [number, number, number],
  success: [34, 197, 94] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  black: [0, 0, 0] as [number, number, number],
  background: [248, 250, 252] as [number, number, number],
  card: [255, 255, 255] as [number, number, number],
  border: [226, 232, 240] as [number, number, number],
  textPrimary: [15, 23, 42] as [number, number, number],
  textSecondary: [71, 85, 105] as [number, number, number],
  textMuted: [148, 163, 184] as [number, number, number],
  gradientStart: [16, 185, 129] as [number, number, number],
  gradientEnd: [6, 182, 212] as [number, number, number],
  slate: [30, 41, 59] as [number, number, number],
  slateDark: [15, 23, 42] as [number, number, number],
  violet: [139, 92, 246] as [number, number, number],
  rose: [244, 63, 94] as [number, number, number],
  amber: [251, 191, 36] as [number, number, number],
  emerald: [52, 211, 153] as [number, number, number],
};

const MARGIN = 15;
const PAGE_WIDTH = 210;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

export interface WeeklyReportData {
  userName: string;
  userEmail: string;
  reportDate: string;
  weekStart: string;
  weekEnd: string;
  currentWeight: number | null;
  weightChange: number | null;
  weightGoal: number | null;
  weightProgress: number;
  avgCalories: number;
  calorieTarget: number;
  calorieProgress: number;
  avgProtein: number;
  proteinTarget: number;
  avgCarbs: number;
  carbsTarget: number;
  avgFat: number;
  fatTarget: number;
  dailyData: Array<{
    date: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    weight: number | null;
    water: number;
  }>;
  consistencyScore: number;
  daysLogged: number;
  totalDays: number;
  mealQualityScore: number;
  waterAverage: number;
  currentStreak: number;
  bestStreak: number;
  activeGoal: string | null;
  goalProgress: number;
  milestonesAchieved: number;
  totalMilestones: number;
  insights: string[];
  recommendations: string[];
  vsLastWeek: {
    calories: number;
    weight: number;
    consistency: number;
  };
}

export class ProfessionalWeeklyReportPDF {
  private doc: jsPDF;
  private pageNumber = 1;
  private totalPages = 6;

  constructor() {
    this.doc = new jsPDF({
      unit: "mm",
      format: "a4",
      compress: true,
    });
  }

  generate(data: WeeklyReportData): jsPDF {
    this.addCoverPage(data);
    this.addExecutiveSummary(data);
    this.addAnthropometricAnalysis(data);
    this.addMetabolicAssessment(data);
    this.addMacronutrientEvaluation(data);
    this.addClinicalRecommendations(data);
    return this.doc;
  }

  private addCoverPage(data: WeeklyReportData) {
    this.doc.setFillColor(...COLORS.slateDark);
    this.doc.rect(0, 0, PAGE_WIDTH, 297, "F");

    this.drawGradientBar(0, 0, PAGE_WIDTH, 8, COLORS.gradientStart, COLORS.gradientEnd);

    this.doc.setFillColor(255, 255, 255);
    this.doc.roundedRect(PAGE_WIDTH / 2 - 25, 35, 50, 50, 8, 8, "F");
    
    this.doc.setFillColor(...COLORS.primary);
    this.doc.roundedRect(PAGE_WIDTH / 2 - 20, 40, 40, 40, 6, 6, "F");
    
    this.doc.setTextColor(255, 255, 255);
    this.doc.setFontSize(24);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("N", PAGE_WIDTH / 2, 67, { align: "center" });

    this.doc.setTextColor(255, 255, 255);
    this.doc.setFontSize(28);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("NUTRIO FUEL", PAGE_WIDTH / 2, 105, { align: "center" });

    this.doc.setFontSize(12);
    this.doc.setFont("helvetica", "normal");
    this.doc.setTextColor(...COLORS.textMuted);
    this.doc.text("Personalized Nutrition Report", PAGE_WIDTH / 2, 115, { align: "center" });

    this.doc.setDrawColor(...COLORS.primary);
    this.doc.setLineWidth(0.5);
    this.doc.line(PAGE_WIDTH / 2 - 30, 125, PAGE_WIDTH / 2 + 30, 125);

    const dateRange = `${format(new Date(data.weekStart), "MMMM d")} - ${format(new Date(data.weekEnd), "MMMM d, yyyy")}`;
    this.doc.setTextColor(255, 255, 255);
    this.doc.setFontSize(14);
    this.doc.setFont("helvetica", "bold");
    this.doc.text(dateRange, PAGE_WIDTH / 2, 145, { align: "center" });

    this.doc.setFillColor(255, 255, 255, 0.1);
    this.doc.roundedRect(MARGIN + 10, 160, CONTENT_WIDTH - 20, 60, 8, 8, "F");

    this.doc.setTextColor(255, 255, 255);
    this.doc.setFontSize(10);
    this.doc.setFont("helvetica", "normal");
    this.doc.text("PREPARED FOR", PAGE_WIDTH / 2, 175, { align: "center" });

    this.doc.setFontSize(18);
    this.doc.setFont("helvetica", "bold");
    this.doc.text(data.userName.toUpperCase(), PAGE_WIDTH / 2, 190, { align: "center" });

    this.doc.setFontSize(9);
    this.doc.setFont("helvetica", "normal");
    this.doc.setTextColor(...COLORS.textMuted);
    this.doc.text(data.userEmail, PAGE_WIDTH / 2, 200, { align: "center" });

    const overallScore = this.calculateOverallScore(data);
    this.doc.setFillColor(...COLORS.primary);
    this.doc.circle(PAGE_WIDTH / 2, 240, 25, "F");
    
    this.doc.setTextColor(255, 255, 255);
    this.doc.setFontSize(24);
    this.doc.setFont("helvetica", "bold");
    this.doc.text(`${overallScore}`, PAGE_WIDTH / 2, 244, { align: "center" });
    
    this.doc.setFontSize(8);
    this.doc.setFont("helvetica", "normal");
    this.doc.text("OVERALL SCORE", PAGE_WIDTH / 2, 252, { align: "center" });

    this.doc.setTextColor(...COLORS.textMuted);
    this.doc.setFontSize(8);
    this.doc.text(`Report Generated: ${format(new Date(), "MMMM d, yyyy 'at' h:mm a")}`, PAGE_WIDTH / 2, 285, { align: "center" });

    this.drawGradientBar(0, 289, PAGE_WIDTH, 8, COLORS.gradientStart, COLORS.gradientEnd);

    this.doc.addPage();
    this.pageNumber++;
  }

  private addExecutiveSummary(data: WeeklyReportData) {
    this.addProfessionalHeader("Executive Summary", data);

    let y = 45;

    this.doc.setFillColor(...COLORS.background);
    this.doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 55, 6, 6, "F");

    this.doc.setFillColor(...COLORS.primary);
    this.doc.roundedRect(MARGIN, y, 5, 55, 2, 2, "F");

    this.doc.setTextColor(...COLORS.textPrimary);
    this.doc.setFontSize(11);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("WEEKLY OVERVIEW", MARGIN + 12, y + 12);

    const summaryText = this.generatePersonalizedSummary(data);
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(9);
    this.doc.setTextColor(...COLORS.textSecondary);
    const lines = this.doc.splitTextToSize(summaryText, CONTENT_WIDTH - 24);
    this.doc.text(lines, MARGIN + 12, y + 24);

    y += 65;

    const metrics = [
      { label: "Calories", value: Math.round(data.avgCalories), target: data.calorieTarget, unit: "kcal", color: COLORS.warning },
      { label: "Protein", value: Math.round(data.avgProtein), target: data.proteinTarget, unit: "g", color: COLORS.primary },
      { label: "Carbs", value: Math.round(data.avgCarbs), target: data.carbsTarget, unit: "g", color: COLORS.accent },
      { label: "Fat", value: Math.round(data.avgFat), target: data.fatTarget, unit: "g", color: COLORS.violet },
    ];

    const cardWidth = (CONTENT_WIDTH - 15) / 4;
    metrics.forEach((metric) => {
      const x = MARGIN + metrics.indexOf(metric) * (cardWidth + 5);
      const progress = Math.min(100, Math.round((metric.value / metric.target) * 100));

      this.doc.setFillColor(...COLORS.card);
      this.doc.roundedRect(x, y, cardWidth, 50, 6, 6, "F");

      this.doc.setFillColor(...metric.color);
      this.doc.circle(x + cardWidth / 2, y + 18, 12, "F");

      this.doc.setTextColor(255, 255, 255);
      this.doc.setFontSize(10);
      this.doc.setFont("helvetica", "bold");
      this.doc.text(`${progress}%`, x + cardWidth / 2, y + 21, { align: "center" });

      this.doc.setTextColor(...COLORS.textPrimary);
      this.doc.setFontSize(12);
      this.doc.setFont("helvetica", "bold");
      this.doc.text(`${metric.value}`, x + cardWidth / 2, y + 36, { align: "center" });

      this.doc.setTextColor(...COLORS.textMuted);
      this.doc.setFontSize(7);
      this.doc.setFont("helvetica", "normal");
      this.doc.text(metric.label, x + cardWidth / 2, y + 44, { align: "center" });
    });

    y += 60;

    if (data.currentWeight) {
      this.doc.setFillColor(...COLORS.card);
      this.doc.roundedRect(MARGIN, y, CONTENT_WIDTH / 2 - 5, 45, 6, 6, "F");

      this.doc.setFillColor(...COLORS.slate);
      this.doc.roundedRect(MARGIN, y, 45, 45, 6, 6, "F");

      this.doc.setTextColor(255, 255, 255);
      this.doc.setFontSize(18);
      this.doc.setFont("helvetica", "bold");
      this.doc.text(`${data.currentWeight}`, MARGIN + 22.5, y + 25, { align: "center" });
      this.doc.setFontSize(8);
      this.doc.setFont("helvetica", "normal");
      this.doc.text("kg", MARGIN + 22.5, y + 34, { align: "center" });

      this.doc.setTextColor(...COLORS.textPrimary);
      this.doc.setFontSize(9);
      this.doc.setFont("helvetica", "bold");
      this.doc.text("Current Weight", MARGIN + 52, y + 15);

      if (data.weightGoal) {
        this.doc.setTextColor(...COLORS.textSecondary);
        this.doc.setFontSize(8);
        this.doc.setFont("helvetica", "normal");
        this.doc.text(`Goal: ${data.weightGoal} kg`, MARGIN + 52, y + 24);

        const progress = Math.min(100, Math.max(0, data.weightProgress));
        this.doc.setFillColor(...COLORS.border);
        this.doc.roundedRect(MARGIN + 52, y + 28, CONTENT_WIDTH / 2 - 62, 6, 3, 3, "F");
        this.doc.setFillColor(...COLORS.primary);
        this.doc.roundedRect(MARGIN + 52, y + 28, (CONTENT_WIDTH / 2 - 62) * (progress / 100), 6, 3, 3, "F");
      }

      if (data.weightChange !== null) {
        const isLoss = data.weightChange < 0;
        this.doc.setTextColor(...(isLoss ? COLORS.success : COLORS.warning));
        this.doc.setFontSize(9);
        this.doc.setFont("helvetica", "bold");
        const sign = data.weightChange > 0 ? "+" : "";
        this.doc.text(`${sign}${data.weightChange.toFixed(1)} kg this week`, MARGIN + 52, y + 40);
      }

      this.doc.setFillColor(...COLORS.card);
      this.doc.roundedRect(MARGIN + CONTENT_WIDTH / 2 + 5, y, CONTENT_WIDTH / 2 - 5, 45, 6, 6, "F");

      const streaks = [
        { label: "Current Streak", value: data.currentStreak },
        { label: "Best Streak", value: data.bestStreak },
      ];

      streaks.forEach((streak, idx) => {
        const sy = y + 8 + idx * 18;
        this.doc.setTextColor(...COLORS.textPrimary);
        this.doc.setFontSize(16);
        this.doc.setFont("helvetica", "bold");
        this.doc.text(`${streak.value}`, MARGIN + CONTENT_WIDTH / 2 + 15, sy + 8);
        this.doc.setTextColor(...COLORS.textSecondary);
        this.doc.setFontSize(7);
        this.doc.setFont("helvetica", "normal");
        this.doc.text(`${streak.label} (days)`, MARGIN + CONTENT_WIDTH / 2 + 35, sy + 8);
      });

      y += 55;
    }

    this.addDailyDataTable(data, y);

    this.addProfessionalFooter();
    this.doc.addPage();
    this.pageNumber++;
  }

  private addNutritionAnalysis(data: WeeklyReportData) {
    this.addProfessionalHeader("Nutrition Analysis", data);

    let y = 45;

    this.doc.setTextColor(...COLORS.textPrimary);
    this.doc.setFontSize(12);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Macro Distribution", MARGIN, y);

    y += 8;

    const totalMacros = data.avgProtein * 4 + data.avgCarbs * 4 + data.avgFat * 9;
    const proteinPct = Math.round((data.avgProtein * 4 / totalMacros) * 100);
    const carbsPct = Math.round((data.avgCarbs * 4 / totalMacros) * 100);
    const fatPct = 100 - proteinPct - carbsPct;

    this.doc.setFillColor(...COLORS.card);
    this.doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 50, 6, 6, "F");

    const barY = y + 15;
    const barHeight = 20;
    const barStartX = MARGIN + 10;
    const barWidth = CONTENT_WIDTH - 20;

    this.doc.setFillColor(...COLORS.primary);
    this.doc.roundedRect(barStartX, barY, barWidth * (proteinPct / 100), barHeight, 3, 3, "F");
    
    this.doc.setFillColor(...COLORS.accent);
    this.doc.rect(barStartX + barWidth * (proteinPct / 100), barY, barWidth * (carbsPct / 100), barHeight, "F");
    
    this.doc.setFillColor(...COLORS.violet);
    this.doc.roundedRect(barStartX + barWidth * ((proteinPct + carbsPct) / 100), barY, barWidth * (fatPct / 100), barHeight, 3, 3, "F");

    const macros = [
      { name: "Protein", pct: proteinPct, grams: Math.round(data.avgProtein), color: COLORS.primary },
      { name: "Carbs", pct: carbsPct, grams: Math.round(data.avgCarbs), color: COLORS.accent },
      { name: "Fat", pct: fatPct, grams: Math.round(data.avgFat), color: COLORS.violet },
    ];

    macros.forEach((macro) => {
      const mx = MARGIN + 15 + macros.indexOf(macro) * 60;
      this.doc.setFillColor(...macro.color);
      this.doc.circle(mx, y + 42, 3, "F");
      this.doc.setTextColor(...COLORS.textSecondary);
      this.doc.setFontSize(7);
      this.doc.setFont("helvetica", "normal");
      this.doc.text(`${macro.name}: ${macro.pct}% (${macro.grams}g)`, mx + 6, y + 43);
    });

    y += 60;

    this.doc.setTextColor(...COLORS.textPrimary);
    this.doc.setFontSize(12);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Performance Scores", MARGIN, y);

    y += 8;

    const scores = [
      { name: "Consistency", score: data.consistencyScore, color: COLORS.primary },
      { name: "Meal Quality", score: data.mealQualityScore, color: COLORS.amber },
      { name: "Hydration", score: Math.round((data.waterAverage / 8) * 100), color: COLORS.accent },
      { name: "Goal Progress", score: data.goalProgress, color: COLORS.emerald },
    ];

    const scoreWidth = (CONTENT_WIDTH - 15) / 4;
    scores.forEach((score) => {
      const idx = scores.indexOf(score);
      const sx = MARGIN + idx * (scoreWidth + 5);
      const displayScore = Math.min(100, Math.max(0, score.score));

      this.doc.setFillColor(...COLORS.card);
      this.doc.roundedRect(sx, y, scoreWidth, 55, 6, 6, "F");

      this.doc.setFillColor(...score.color);
      this.doc.circle(sx + scoreWidth / 2, y + 22, 15, "F");

      this.doc.setTextColor(255, 255, 255);
      this.doc.setFontSize(14);
      this.doc.setFont("helvetica", "bold");
      this.doc.text(`${displayScore}`, sx + scoreWidth / 2, y + 25, { align: "center" });

      this.doc.setTextColor(...COLORS.textSecondary);
      this.doc.setFontSize(7);
      this.doc.setFont("helvetica", "normal");
      this.doc.text(score.name, sx + scoreWidth / 2, y + 45, { align: "center" });

      const label = displayScore >= 80 ? "Excellent" : displayScore >= 60 ? "Good" : displayScore >= 40 ? "Fair" : "Needs Work";
      this.doc.setTextColor(...score.color);
      this.doc.setFontSize(6);
      this.doc.text(label, sx + scoreWidth / 2, y + 52, { align: "center" });
    });

    y += 65;

    this.doc.setTextColor(...COLORS.textPrimary);
    this.doc.setFontSize(12);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Week-over-Week Comparison", MARGIN, y);

    y += 5;

    autoTable(this.doc, {
      startY: y,
      head: [["Metric", "This Week", "Previous Week", "Change", "Status"]],
      body: [
        [
          "Average Calories",
          `${Math.round(data.avgCalories)} kcal`,
          `${Math.round(data.avgCalories - data.vsLastWeek.calories)} kcal`,
          `${data.vsLastWeek.calories > 0 ? "+" : ""}${Math.round(data.vsLastWeek.calories)} kcal`,
          this.getTrendLabel(data.vsLastWeek.calories, "calories", data.activeGoal),
        ],
        [
          "Weight",
          data.currentWeight ? `${data.currentWeight.toFixed(1)} kg` : "-",
          "-",
          data.weightChange ? `${data.weightChange > 0 ? "+" : ""}${data.weightChange.toFixed(1)} kg` : "-",
          this.getWeightTrendLabel(data.weightChange, data.activeGoal),
        ],
        [
          "Consistency",
          `${data.consistencyScore}%`,
          `${Math.max(0, data.consistencyScore - data.vsLastWeek.consistency)}%`,
          `${data.vsLastWeek.consistency > 0 ? "+" : ""}${data.vsLastWeek.consistency}%`,
          data.vsLastWeek.consistency > 0 ? "Improving" : data.vsLastWeek.consistency < 0 ? "Declining" : "Stable",
        ],
        [
          "Days Logged",
          `${data.daysLogged}/${data.totalDays}`,
          "-",
          "-",
          data.daysLogged >= 5 ? "Good" : data.daysLogged >= 3 ? "Fair" : "Needs Attention",
        ],
      ],
      headStyles: {
        fillColor: COLORS.slate,
        textColor: COLORS.white,
        fontStyle: "bold",
        fontSize: 8,
        cellPadding: { top: 6, bottom: 6, left: 6, right: 6 },
      },
      bodyStyles: {
        fontSize: 8,
        cellPadding: { top: 5, bottom: 5, left: 6, right: 6 },
        textColor: COLORS.textPrimary,
      },
      alternateRowStyles: {
        fillColor: COLORS.background,
      },
      columnStyles: {
        0: { fontStyle: "bold", textColor: COLORS.textSecondary },
        4: { fontStyle: "bold" },
      },
      margin: { left: MARGIN, right: MARGIN },
      tableLineColor: COLORS.border,
      tableLineWidth: 0.5,
    });

    this.addProfessionalFooter();
    this.doc.addPage();
    this.pageNumber++;
  }

  private addRecommendations(data: WeeklyReportData) {
    this.addProfessionalHeader("Insights & Recommendations", data);

    let y = 45;

    this.doc.setTextColor(...COLORS.textPrimary);
    this.doc.setFontSize(12);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Key Insights", MARGIN, y);

    y += 8;

    const insights = this.generateSmartInsights(data);
    insights.forEach((insight) => {
      // Check if we need a new page
      if (y > 230) {
        this.addProfessionalFooter();
        this.doc.addPage();
        this.pageNumber++;
        y = 45;
      }
      
      this.doc.setFillColor(...COLORS.card);
      this.doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 18, 4, 4, "F");

      this.doc.setFillColor(...(insight.type === "success" ? COLORS.success : insight.type === "warning" ? COLORS.warning : COLORS.accent));
      this.doc.circle(MARGIN + 10, y + 9, 5, "F");

      this.doc.setTextColor(255, 255, 255);
      this.doc.setFontSize(8);
      this.doc.setFont("helvetica", "bold");
      this.doc.text(insight.type === "success" ? "+" : insight.type === "warning" ? "!" : "i", MARGIN + 10, y + 11, { align: "center" });

      this.doc.setTextColor(...COLORS.textPrimary);
      this.doc.setFontSize(8);
      this.doc.setFont("helvetica", "normal");
      this.doc.text(insight.text, MARGIN + 20, y + 11);

      y += 22;
    });

    y += 5;

    this.doc.setTextColor(...COLORS.textPrimary);
    this.doc.setFontSize(12);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Personalized Recommendations", MARGIN, y);

    y += 8;

    const recommendations = this.generatePersonalizedRecommendations(data);
    recommendations.forEach((rec, idx) => {
      // Check if we need a new page
      if (y > 220) {
        this.addProfessionalFooter();
        this.doc.addPage();
        this.pageNumber++;
        y = 45;
      }
      
      this.doc.setFillColor(...COLORS.card);
      this.doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 28, 6, 6, "F");

      this.doc.setFillColor(...COLORS.primary);
      this.doc.roundedRect(MARGIN, y, 25, 28, 6, 6, "F");

      this.doc.setTextColor(255, 255, 255);
      this.doc.setFontSize(12);
      this.doc.setFont("helvetica", "bold");
      this.doc.text(`${idx + 1}`, MARGIN + 12.5, y + 18, { align: "center" });

      this.doc.setTextColor(...COLORS.textPrimary);
      this.doc.setFontSize(9);
      this.doc.setFont("helvetica", "bold");
      this.doc.text(rec.title, MARGIN + 30, y + 12);

      this.doc.setTextColor(...COLORS.textSecondary);
      this.doc.setFontSize(7);
      this.doc.setFont("helvetica", "normal");
      const recLines = this.doc.splitTextToSize(rec.description, CONTENT_WIDTH - 45);
      this.doc.text(recLines, MARGIN + 30, y + 20);

      y += 32;
    });

    y += 10;

    this.doc.setFillColor(...COLORS.background);
    this.doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 45, 6, 6, "F");

    this.doc.setFillColor(...COLORS.primary);
    this.doc.roundedRect(MARGIN, y, 4, 45, 2, 2, "F");

    this.doc.setTextColor(...COLORS.textPrimary);
    this.doc.setFontSize(10);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Next Steps", MARGIN + 12, y + 12);

    const nextSteps = [
      "Continue logging your meals daily for accurate tracking",
      "Focus on hitting your protein target to support your goals",
      "Stay hydrated - aim for 8 glasses of water daily",
    ];

    this.doc.setFontSize(8);
    this.doc.setFont("helvetica", "normal");
    this.doc.setTextColor(...COLORS.textSecondary);
    nextSteps.forEach((step, idx) => {
      this.doc.text(`* ${step}`, MARGIN + 12, y + 22 + idx * 7);
    });

    y += 55;

    // Check if we need a new page before the final section
    // Branding box is 35mm + need 10mm margin before footer at 278
    if (y > 230) {
      this.addProfessionalFooter();
      this.doc.addPage();
      this.pageNumber++;
      y = 45;
    }

    this.doc.setDrawColor(...COLORS.primary);
    this.doc.setLineWidth(0.5);
    this.doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);

    y += 8;

    this.doc.setFillColor(...COLORS.slate);
    this.doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 35, 6, 6, "F");

    this.doc.setTextColor(255, 255, 255);
    this.doc.setFontSize(9);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("NUTRIO FUEL", MARGIN + 10, y + 12);

    this.doc.setFontSize(7);
    this.doc.setFont("helvetica", "normal");
    this.doc.setTextColor(...COLORS.textMuted);
    this.doc.text("Your personalized nutrition companion", MARGIN + 10, y + 20);

    this.doc.setTextColor(255, 255, 255);
    this.doc.setFontSize(7);
    this.doc.text("This report was generated based on your nutrition data.", MARGIN + 10, y + 28);
    this.doc.text("For personalized advice, please consult a registered dietitian.", MARGIN + 10, y + 33);

    this.addProfessionalFooter();
  }

  private addAnthropometricAnalysis(data: WeeklyReportData) {
    this.addProfessionalHeader("Anthropometric & Weight Analysis", data);

    let y = 45;

    this.doc.setFillColor(...COLORS.background);
    this.doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 60, 6, 6, "F");

    this.doc.setFillColor(...COLORS.primary);
    this.doc.roundedRect(MARGIN, y, 5, 60, 2, 2, "F");

    this.doc.setTextColor(...COLORS.textPrimary);
    this.doc.setFontSize(11);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("BODY COMPOSITION & WEIGHT RISK ANALYSIS", MARGIN + 12, y + 12);

    let analysisText = "";
    if (data.currentWeight) {
      analysisText = "Current weight: " + data.currentWeight.toFixed(1) + " kg. ";
      if (data.weightChange !== null) {
        const changeDirection = data.weightChange < 0 ? "decrease" : "increase";
        analysisText += "Weekly " + changeDirection + " of " + Math.abs(data.weightChange).toFixed(1) + " kg. ";
      }
      if (data.weightGoal) {
        analysisText += "Progress toward goal: " + Math.round(data.weightProgress) + "%. ";
      }
    } else {
      analysisText = "Weight data insufficient. Regular tracking (2-3x weekly, same conditions) recommended for accurate assessment.";
    }

    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(9);
    this.doc.setTextColor(...COLORS.textSecondary);
    const analysisLines = this.doc.splitTextToSize(analysisText, CONTENT_WIDTH - 24);
    this.doc.text(analysisLines, MARGIN + 12, y + 22);

    y += 70;

    const weightMetrics = [
      { label: "Current Weight", value: data.currentWeight ? data.currentWeight.toFixed(1) + " kg" : "N/A", subtext: data.weightGoal ? "Goal: " + data.weightGoal + " kg" : "No goal set" },
      { label: "Weekly Change", value: data.weightChange !== null ? (data.weightChange > 0 ? "+" : "") + data.weightChange.toFixed(1) + " kg" : "N/A", subtext: this.getWeightChangeStatus(data.weightChange, data.activeGoal) },
      { label: "Progress", value: Math.round(data.weightProgress) + "%", subtext: data.weightProgress >= 50 ? "On track" : "Early stages" },
    ];

    const metricWidth = (CONTENT_WIDTH - 10) / 3;
    weightMetrics.forEach((metric) => {
      const idx = weightMetrics.indexOf(metric);
      const x = MARGIN + idx * (metricWidth + 5);

      this.doc.setFillColor(...COLORS.card);
      this.doc.roundedRect(x, y, metricWidth, 45, 6, 6, "F");

      this.doc.setTextColor(...COLORS.textMuted);
      this.doc.setFontSize(7);
      this.doc.setFont("helvetica", "normal");
      this.doc.text(metric.label, x + 8, y + 12);

      this.doc.setTextColor(...COLORS.textPrimary);
      this.doc.setFontSize(12);
      this.doc.setFont("helvetica", "bold");
      this.doc.text(metric.value, x + 8, y + 26);

      this.doc.setTextColor(...COLORS.textMuted);
      this.doc.setFontSize(6);
      this.doc.text(metric.subtext, x + 8, y + 38);
    });

    y += 55;

    this.doc.setTextColor(...COLORS.textPrimary);
    this.doc.setFontSize(11);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("CLINICAL WEIGHT COMMENTARY", MARGIN, y);

    y += 8;

    this.doc.setFillColor(...COLORS.card);
    this.doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 45, 6, 6, "F");

    let commentary = "Clinical Commentary: ";
    if (data.weightChange !== null) {
      if (Math.abs(data.weightChange) > 1.0) {
        commentary += "The " + Math.abs(data.weightChange).toFixed(1) + " kg weekly change is relatively rapid. ";
        commentary += data.weightChange < 0 
          ? "Aggressive weight loss may increase risk of lean mass loss and metabolic adaptation. Consider moderate caloric adjustment."
          : "Rapid weight gain may indicate excessive caloric surplus or fluid retention.";
      } else if (Math.abs(data.weightChange) > 0.5) {
        commentary += "The " + Math.abs(data.weightChange).toFixed(1) + " kg change represents moderate progress. This rate is generally sustainable.";
      } else {
        commentary += "Minimal weight change detected. This may indicate metabolic adaptation or body recomposition.";
      }
    } else {
      commentary += "Insufficient data to determine weight trend.";
    }

    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(8);
    this.doc.setTextColor(...COLORS.textSecondary);
    const commentaryLines = this.doc.splitTextToSize(commentary, CONTENT_WIDTH - 20);
    this.doc.text(commentaryLines, MARGIN + 10, y + 12);

    this.addProfessionalFooter();
    this.doc.addPage();
    this.pageNumber++;
  }

  private addMetabolicAssessment(data: WeeklyReportData) {
    this.addProfessionalHeader("Caloric & Metabolic Assessment", data);

    let y = 45;

    this.doc.setFillColor(...COLORS.background);
    this.doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 55, 6, 6, "F");

    this.doc.setFillColor(...COLORS.primary);
    this.doc.roundedRect(MARGIN, y, 5, 55, 2, 2, "F");

    this.doc.setTextColor(...COLORS.textPrimary);
    this.doc.setFontSize(11);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("METABOLIC HEALTH RISK COMMENTARY", MARGIN + 12, y + 12);

    const calorieDeficit = data.calorieTarget - data.avgCalories;
    const deficitPct = (calorieDeficit / data.calorieTarget) * 100;

    let metabolicText = "";
    if (Math.abs(deficitPct) <= 10) {
      metabolicText = "Average intake of " + Math.round(data.avgCalories) + " kcal is within 10% of target, indicating appropriate energy availability for metabolic function.";
    } else if (deficitPct > 10 && deficitPct <= 25) {
      metabolicText = "Current intake represents a moderate deficit. This level supports weight loss while generally maintaining metabolic function.";
    } else if (deficitPct > 25) {
      metabolicText = "Significant caloric deficit detected. Chronic underfeeding below energy availability thresholds may trigger metabolic adaptation.";
    } else {
      metabolicText = "Caloric intake exceeds target. Depending on activity level, this surplus may support muscle gain or contribute to adipose tissue accretion.";
    }

    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(9);
    this.doc.setTextColor(...COLORS.textSecondary);
    const metabolicLines = this.doc.splitTextToSize(metabolicText, CONTENT_WIDTH - 24);
    this.doc.text(metabolicLines, MARGIN + 12, y + 22);

    y += 65;

    autoTable(this.doc, {
      startY: y,
      head: [["Metric", "Target", "Actual", "Status"]],
      body: [
        ["Daily Calories", data.calorieTarget + " kcal", Math.round(data.avgCalories) + " kcal", this.getMetabolicStatus(data.avgCalories, data.calorieTarget)],
        ["Energy Availability", "Adequate", data.avgCalories < data.calorieTarget * 0.8 ? "Low" : "Adequate", data.avgCalories < data.calorieTarget * 0.8 ? "Risk of adaptation" : "Optimal"],
        ["Consistency", ">=80%", data.consistencyScore + "%", data.consistencyScore >= 80 ? "Excellent" : data.consistencyScore >= 60 ? "Moderate" : "Needs work"],
      ],
      headStyles: {
        fillColor: COLORS.slate,
        textColor: COLORS.white,
        fontStyle: "bold",
        fontSize: 8,
        cellPadding: { top: 6, bottom: 6, left: 6, right: 6 },
      },
      bodyStyles: {
        fontSize: 8,
        cellPadding: { top: 5, bottom: 5, left: 6, right: 6 },
        textColor: COLORS.textPrimary,
      },
      alternateRowStyles: {
        fillColor: COLORS.background,
      },
      margin: { left: MARGIN, right: MARGIN },
      tableLineColor: COLORS.border,
      tableLineWidth: 0.5,
    });

    this.addProfessionalFooter();
    this.doc.addPage();
    this.pageNumber++;
  }

  private addMacronutrientEvaluation(data: WeeklyReportData) {
    this.addProfessionalHeader("Macronutrient Evaluation", data);

    let y = 45;

    const totalMacros = data.avgProtein * 4 + data.avgCarbs * 4 + data.avgFat * 9;
    const proteinPct = totalMacros > 0 ? Math.round((data.avgProtein * 4 / totalMacros) * 100) : 0;
    const carbsPct = totalMacros > 0 ? Math.round((data.avgCarbs * 4 / totalMacros) * 100) : 0;
    const fatPct = totalMacros > 0 ? 100 - proteinPct - carbsPct : 0;

    this.doc.setFillColor(...COLORS.background);
    this.doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 50, 6, 6, "F");

    this.doc.setFillColor(...COLORS.primary);
    this.doc.roundedRect(MARGIN, y, 5, 50, 2, 2, "F");

    this.doc.setTextColor(...COLORS.textPrimary);
    this.doc.setFontSize(11);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("MACRO RATIO EVALUATION", MARGIN + 12, y + 12);

    let macroText = "Macronutrient distribution shows protein at " + proteinPct + "%, carbohydrates at " + carbsPct + "%, and fats at " + fatPct + "% of total caloric intake. ";
    if (proteinPct >= 25) {
      macroText += "Protein percentage is optimal for satiety signaling and lean mass preservation.";
    } else if (proteinPct >= 20) {
      macroText += "Protein intake is moderate. Consider prioritizing protein at each meal.";
    } else {
      macroText += "Protein percentage is suboptimal. Increased protein prioritization is recommended.";
    }

    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(9);
    this.doc.setTextColor(...COLORS.textSecondary);
    const macroLines = this.doc.splitTextToSize(macroText, CONTENT_WIDTH - 24);
    this.doc.text(macroLines, MARGIN + 12, y + 22);

    y += 60;

    const macros = [
      { name: "Protein", pct: proteinPct, grams: Math.round(data.avgProtein), target: data.proteinTarget, color: COLORS.primary },
      { name: "Carbs", pct: carbsPct, grams: Math.round(data.avgCarbs), target: data.carbsTarget, color: COLORS.accent },
      { name: "Fat", pct: fatPct, grams: Math.round(data.avgFat), target: data.fatTarget, color: COLORS.violet },
    ];

    const macroWidth = (CONTENT_WIDTH - 10) / 3;
    macros.forEach((macro) => {
      const idx = macros.indexOf(macro);
      const x = MARGIN + idx * (macroWidth + 5);

      this.doc.setFillColor(...COLORS.card);
      this.doc.roundedRect(x, y, macroWidth, 55, 6, 6, "F");

      this.doc.setFillColor(...macro.color);
      this.doc.circle(x + macroWidth / 2, y + 20, 15, "F");

      this.doc.setTextColor(255, 255, 255);
      this.doc.setFontSize(11);
      this.doc.setFont("helvetica", "bold");
      this.doc.text(macro.pct + "%", x + macroWidth / 2, y + 23, { align: "center" });

      this.doc.setTextColor(...COLORS.textPrimary);
      this.doc.setFontSize(9);
      this.doc.setFont("helvetica", "bold");
      this.doc.text(macro.name, x + 8, y + 42);

      this.doc.setTextColor(...COLORS.textSecondary);
      this.doc.setFontSize(7);
      this.doc.setFont("helvetica", "normal");
      this.doc.text(macro.grams + "g / " + macro.target + "g", x + 8, y + 50);
    });

    y += 65;

    this.doc.setTextColor(...COLORS.textPrimary);
    this.doc.setFontSize(11);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("PROTEIN SUFFICIENCY RISK ASSESSMENT", MARGIN, y);

    y += 8;

    this.doc.setFillColor(...COLORS.card);
    this.doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 35, 6, 6, "F");

    const ratio = data.avgProtein / data.proteinTarget;
    let proteinAssessment = "";
    
    if (ratio >= 1.0) {
      proteinAssessment = "PROTEIN STATUS: OPTIMAL. Current intake meets or exceeds target. This level supports muscle protein synthesis, recovery, and metabolic function.";
    } else if (ratio >= 0.8) {
      proteinAssessment = "PROTEIN STATUS: ADEQUATE. Intake at " + Math.round(ratio * 100) + "% of target. While sufficient for basic needs, optimization toward 100% would enhance recovery.";
    } else if (ratio >= 0.6) {
      proteinAssessment = "PROTEIN STATUS: INSUFFICIENT. Intake at " + Math.round(ratio * 100) + "% of target presents moderate risk for compromised recovery. Implement protein-rich foods at each meal.";
    } else {
      proteinAssessment = "PROTEIN STATUS: DEFICIENT. Intake at " + Math.round(ratio * 100) + "% of target poses significant risk for lean mass loss. Immediate intervention required.";
    }

    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(8);
    this.doc.setTextColor(...COLORS.textSecondary);
    const proteinLines = this.doc.splitTextToSize(proteinAssessment, CONTENT_WIDTH - 20);
    this.doc.text(proteinLines, MARGIN + 10, y + 12);

    this.addProfessionalFooter();
    this.doc.addPage();
    this.pageNumber++;
  }

  private addClinicalRecommendations(data: WeeklyReportData) {
    this.addProfessionalHeader("Clinical Recommendations & Action Plan", data);

    let y = 45;

    this.doc.setTextColor(...COLORS.textPrimary);
    this.doc.setFontSize(11);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("STRATEGIC 4-WEEK INTERVENTION PLAN", MARGIN, y);

    y += 8;

    const weeks = [
      { week: "WEEK 1", focus: "Foundation & Consistency", actions: ["Establish daily logging routine", "Meet minimum protein threshold", "Hydration baseline: 8 glasses daily", "Identify adherence barriers"] },
      { week: "WEEK 2", focus: "Macronutrient Optimization", actions: ["Achieve target protein intake", "Balance carbohydrate timing", "Implement structured refeeding", "Monitor satiety signaling"] },
      { week: "WEEK 3", focus: "Metabolic Support", actions: ["Optimize meal timing", "Ensure adequate energy availability", "Focus on nutrient-dense foods", "Monitor glycemic regulation"] },
      { week: "WEEK 4", focus: "Sustainability", actions: ["Solidify adherence patterns", "Implement meal prepping", "Evaluate progress", "Develop maintenance protocols"] },
    ];

    weeks.forEach((week) => {
      if (y > 220) {
        this.addProfessionalFooter();
        this.doc.addPage();
        this.pageNumber++;
        y = 45;
      }

      this.doc.setFillColor(...COLORS.card);
      this.doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 50, 6, 6, "F");

      this.doc.setFillColor(...COLORS.primary);
      this.doc.roundedRect(MARGIN, y, 30, 50, 6, 6, "F");

      this.doc.setTextColor(255, 255, 255);
      this.doc.setFontSize(9);
      this.doc.setFont("helvetica", "bold");
      this.doc.text(week.week, MARGIN + 15, y + 15, { align: "center" });

      this.doc.setTextColor(...COLORS.textPrimary);
      this.doc.setFontSize(9);
      this.doc.setFont("helvetica", "bold");
      this.doc.text(week.focus, MARGIN + 38, y + 12);

      this.doc.setTextColor(...COLORS.textSecondary);
      this.doc.setFontSize(7);
      this.doc.setFont("helvetica", "normal");
      week.actions.forEach((action, idx) => {
        this.doc.text("- " + action, MARGIN + 38, y + 24 + idx * 7);
      });

      y += 55;
    });

    if (y > 200) {
      this.addProfessionalFooter();
      this.doc.addPage();
      this.pageNumber++;
      y = 45;
    }

    this.doc.setTextColor(...COLORS.textPrimary);
    this.doc.setFontSize(11);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("PROFESSIONAL DISCLAIMER", MARGIN, y);

    y += 8;

    this.doc.setFillColor(...COLORS.slate);
    this.doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 45, 6, 6, "F");

    this.doc.setTextColor(255, 255, 255);
    this.doc.setFontSize(7);
    this.doc.setFont("helvetica", "normal");
    const disclaimerText = "This report is generated for educational purposes based on self-reported dietary data. It does not constitute medical advice. Before implementing significant dietary changes, particularly if you have existing medical conditions, consult with a licensed healthcare provider or registered dietitian. Nutrio Fuel is not liable for health outcomes resulting from recommendations without appropriate medical supervision.";
    const disclaimerLines = this.doc.splitTextToSize(disclaimerText, CONTENT_WIDTH - 20);
    this.doc.text(disclaimerLines, MARGIN + 10, y + 12);

    this.addProfessionalFooter();
  }

  private getWeightChangeStatus(change: number | null, goal: string | null): string {
    if (change === null) return "Insufficient data";
    if (goal === "weight_loss") return change < 0 ? "Progress toward goal" : change > 0 ? "Monitor closely" : "Stable";
    if (goal === "muscle_gain") return change > 0 ? "Progress toward goal" : change < 0 ? "Monitor closely" : "Stable";
    return "Monitor trend";
  }

  private getMetabolicStatus(actual: number, target: number): string {
    const variance = ((actual - target) / target) * 100;
    if (Math.abs(variance) <= 10) return "Optimal";
    if (variance < -20) return "Low energy";
    if (variance < -10) return "Moderate deficit";
    if (variance > 20) return "Surplus";
    if (variance > 10) return "Moderate surplus";
    return "Monitor";
  }

  private addProfessionalHeader(title: string, data: WeeklyReportData) {
    this.doc.setFillColor(...COLORS.slateDark);
    this.doc.rect(0, 0, PAGE_WIDTH, 30, "F");

    this.drawGradientBar(0, 0, PAGE_WIDTH, 4, COLORS.gradientStart, COLORS.gradientEnd);

    this.doc.setTextColor(255, 255, 255);
    this.doc.setFontSize(16);
    this.doc.setFont("helvetica", "bold");
    this.doc.text(title.toUpperCase(), MARGIN, 18);

    this.doc.setFontSize(8);
    this.doc.setFont("helvetica", "normal");
    this.doc.setTextColor(...COLORS.textMuted);
    const dateRange = `${format(new Date(data.weekStart), "MMM d")} - ${format(new Date(data.weekEnd), "MMM d, yyyy")}`;
    this.doc.text(dateRange, PAGE_WIDTH - MARGIN, 14, { align: "right" });
    this.doc.text(data.userName, PAGE_WIDTH - MARGIN, 22, { align: "right" });
  }

  private addProfessionalFooter() {
    const y = 270; // Moved up to prevent overlap with content

    this.doc.setDrawColor(...COLORS.border);
    this.doc.setLineWidth(0.3);
    this.doc.line(MARGIN, y - 3, PAGE_WIDTH - MARGIN, y - 3);

    this.doc.setTextColor(...COLORS.textMuted);
    this.doc.setFontSize(7);
    this.doc.setFont("helvetica", "normal");
    this.doc.text("Nutrio Fuel - Professional Nutrition Report", MARGIN, y);
    this.doc.text(`Page ${this.pageNumber} of ${this.totalPages}`, PAGE_WIDTH - MARGIN, y, { align: "right" });
  }

  private addDailyDataTable(data: WeeklyReportData, startY: number) {
    let y = startY;

    this.doc.setTextColor(...COLORS.textPrimary);
    this.doc.setFontSize(12);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Daily Log", MARGIN, y);

    y += 5;

    autoTable(this.doc, {
      startY: y,
      head: [["Date", "Calories", "Protein", "Carbs", "Fat", "Water", "Status"]],
      body: data.dailyData.map((day) => {
        const status = this.getDayStatus(day, data.calorieTarget);
        return [
          format(new Date(day.date), "EEE, MMM d"),
          day.calories > 0 ? `${Math.round(day.calories)}` : "-",
          day.protein > 0 ? `${Math.round(day.protein)}g` : "-",
          day.carbs > 0 ? `${Math.round(day.carbs)}g` : "-",
          day.fat > 0 ? `${Math.round(day.fat)}g` : "-",
          day.water > 0 ? `${day.water}` : "-",
          status,
        ];
      }),
      headStyles: {
        fillColor: COLORS.slate,
        textColor: COLORS.white,
        fontStyle: "bold",
        fontSize: 7,
        cellPadding: { top: 5, bottom: 5, left: 4, right: 4 },
      },
      bodyStyles: {
        fontSize: 7,
        cellPadding: { top: 4, bottom: 4, left: 4, right: 4 },
        textColor: COLORS.textPrimary,
      },
      alternateRowStyles: {
        fillColor: COLORS.background,
      },
      columnStyles: {
        0: { cellWidth: 35 },
        6: { fontStyle: "bold" },
      },
      margin: { left: MARGIN, right: MARGIN },
      tableLineColor: COLORS.border,
      tableLineWidth: 0.3,
    });
  }

  private drawGradientBar(x: number, y: number, width: number, height: number, start: [number, number, number], end: [number, number, number]) {
    const steps = 20;
    const stepWidth = width / steps;
    for (let i = 0; i < steps; i++) {
      const ratio = i / steps;
      const r = Math.round(start[0] + (end[0] - start[0]) * ratio);
      const g = Math.round(start[1] + (end[1] - start[1]) * ratio);
      const b = Math.round(start[2] + (end[2] - start[2]) * ratio);
      this.doc.setFillColor(r, g, b);
      this.doc.rect(x + i * stepWidth, y, stepWidth + 0.5, height, "F");
    }
  }

  private calculateOverallScore(data: WeeklyReportData): number {
    const scores = [
      data.consistencyScore * 0.25,
      Math.min(100, (data.avgCalories / data.calorieTarget) * 100) * 0.2,
      Math.min(100, (data.avgProtein / data.proteinTarget) * 100) * 0.15,
      data.mealQualityScore * 0.2,
      Math.min(100, (data.waterAverage / 8) * 100) * 0.1,
      Math.min(100, (data.currentStreak / Math.max(data.bestStreak, 1)) * 100) * 0.1,
    ];
    return Math.round(scores.reduce((a, b) => a + b, 0));
  }

  private generatePersonalizedSummary(data: WeeklyReportData): string {
    const parts: string[] = [];

    parts.push(`Over the past week, you logged your nutrition ${data.daysLogged} out of ${data.totalDays} days, achieving a ${data.consistencyScore}% consistency score.`);

    if (data.currentWeight && data.weightChange !== null) {
      const changeText = data.weightChange < 0
        ? `lost ${Math.abs(data.weightChange).toFixed(1)} kg`
        : data.weightChange > 0
          ? `gained ${data.weightChange.toFixed(1)} kg`
          : `maintained your weight`;
      parts.push(`You ${changeText}, and your current weight is ${data.currentWeight.toFixed(1)} kg.`);
    }

    const calorieDiff = data.avgCalories - data.calorieTarget;
    if (Math.abs(calorieDiff) < 100) {
      parts.push(`Your average calorie intake of ${Math.round(data.avgCalories)} kcal was right on target.`);
    } else if (calorieDiff > 0) {
      parts.push(`Your average calorie intake of ${Math.round(data.avgCalories)} kcal was ${Math.round(calorieDiff)} kcal above your target.`);
    } else {
      parts.push(`Your average calorie intake of ${Math.round(data.avgCalories)} kcal was ${Math.round(Math.abs(calorieDiff))} kcal below your target.`);
    }

    return parts.join(" ");
  }

  private generateSmartInsights(data: WeeklyReportData): Array<{ type: "success" | "warning" | "info"; text: string }> {
    const insights: Array<{ type: "success" | "warning" | "info"; text: string }> = [];

    if (data.consistencyScore >= 80) {
      insights.push({ type: "success", text: `Excellent consistency! You logged ${data.consistencyScore}% of your meals this week.` });
    } else if (data.consistencyScore < 50) {
      insights.push({ type: "warning", text: `Your logging consistency is at ${data.consistencyScore}%. Try to log meals more regularly.` });
    }

    if (data.currentStreak >= 5) {
      insights.push({ type: "success", text: `Amazing! You're on a ${data.currentStreak}-day logging streak!` });
    }

    if (data.mealQualityScore >= 80) {
      insights.push({ type: "success", text: `Great meal quality this week with a score of ${data.mealQualityScore}/100!` });
    } else if (data.mealQualityScore < 50) {
      insights.push({ type: "warning", text: `Meal quality score is ${data.mealQualityScore}/100. Focus on nutrient-dense foods.` });
    }

    if (data.waterAverage < 5) {
      insights.push({ type: "warning", text: `Hydration is low at ${Math.round(data.waterAverage)} glasses/day. Aim for 8 glasses.` });
    } else if (data.waterAverage >= 7) {
      insights.push({ type: "success", text: `Great hydration! Averaging ${Math.round(data.waterAverage)} glasses per day.` });
    }

    if (insights.length === 0) {
      insights.push({ type: "info", text: "Keep up the good work! Continue logging to unlock more insights." });
    }

    return insights.slice(0, 4);
  }

  private generatePersonalizedRecommendations(data: WeeklyReportData): Array<{ title: string; description: string }> {
    const recommendations: Array<{ title: string; description: string }> = [];

    const proteinDiff = data.proteinTarget - data.avgProtein;
    if (proteinDiff > 20) {
      recommendations.push({
        title: "Increase Protein Intake",
        description: `You're averaging ${Math.round(data.avgProtein)}g protein vs. your ${data.proteinTarget}g target. Add lean proteins like chicken, fish, or legumes to your meals.`,
      });
    }

    if (data.waterAverage < 6) {
      recommendations.push({
        title: "Boost Hydration",
        description: "Aim for 8 glasses of water daily. Try setting reminders or keep a water bottle nearby throughout the day.",
      });
    }

    if (data.consistencyScore < 70) {
      recommendations.push({
        title: "Improve Logging Consistency",
        description: "Consistent tracking leads to better results. Try logging meals right after eating or set daily reminders.",
      });
    }

    if (data.activeGoal === "weight_loss" && (!data.weightChange || data.weightChange >= 0)) {
      recommendations.push({
        title: "Focus on Caloric Deficit",
        description: `For weight loss, maintain a moderate caloric deficit. Your target is ${data.calorieTarget} kcal - try to stay within 10% of this.`,
      });
    }

    if (data.activeGoal === "muscle_gain") {
      recommendations.push({
        title: "Support Muscle Growth",
        description: "Ensure adequate protein (1.6-2.2g/kg body weight) and consider spreading intake across 4-5 meals for optimal absorption.",
      });
    }

    recommendations.push({
      title: "Prioritize Whole Foods",
      description: "Focus on minimally processed foods rich in nutrients. Include a variety of colorful vegetables and fruits in your diet.",
    });

    return recommendations.slice(0, 4);
  }

  private getDayStatus(day: WeeklyReportData["dailyData"][0], target: number): string {
    if (day.calories === 0) return "Not Logged";
    if (day.calories >= target * 0.9 && day.calories <= target * 1.1) return "On Target";
    if (day.calories < target * 0.9) return "Below";
    return "Above";
  }

  private getTrendLabel(change: number, type: string, goal: string | null): string {
    if (type === "calories") {
      if (goal === "weight_loss") {
        return change < 0 ? "Better" : change > 200 ? "High" : "Stable";
      }
      if (goal === "muscle_gain") {
        return change > 0 ? "Good" : change < -200 ? "Low" : "Stable";
      }
    }
    return change > 0 ? "Higher" : change < 0 ? "Lower" : "Stable";
  }

  private getWeightTrendLabel(change: number | null, goal: string | null): string {
    if (change === null) return "-";
    if (goal === "weight_loss") {
      return change < 0 ? "On Track" : change > 0 ? "Monitor" : "Stable";
    }
    if (goal === "muscle_gain") {
      return change > 0 ? "Progress" : change < -0.5 ? "Check" : "Stable";
    }
    return change !== 0 ? (change > 0 ? "Gaining" : "Losing") : "Stable";
  }

  download(data: WeeklyReportData, filename?: string) {
    const pdf = this.generate(data);
    const defaultFilename = `nutrio-nutrition-report-${format(new Date(), "yyyy-MM-dd")}.pdf`;
    pdf.save(filename || defaultFilename);
  }

  getBlob(data: WeeklyReportData): Blob {
    const pdf = this.generate(data);
    return pdf.output("blob");
  }
}

export const professionalWeeklyReportPDF = new ProfessionalWeeklyReportPDF();
