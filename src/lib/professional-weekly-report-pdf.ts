import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

const FONT_SCALE = 1.2;

const COLORS = {
  primary: [34, 168, 88] as [number, number, number],
  primaryDark: [22, 140, 72] as [number, number, number],
  accent: [26, 178, 159] as [number, number, number],
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
  gradientStart: [34, 168, 88] as [number, number, number],
  gradientEnd: [26, 178, 159] as [number, number, number],
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

export interface MealPlanMeal {
  id: string;
  name: string;
  description: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  price: number | null;
  restaurant_name: string | null;
  meal_type: string | null;
  rating: number | null;
  image_url: string | null;
  tags: string[] | null;
  is_vegetarian: boolean | null;
  is_vegan: boolean | null;
  is_gluten_free: boolean | null;
}

export interface MealPlanDay {
  day: string;
  date: string;
  breakfast: MealPlanMeal | null;
  lunch: MealPlanMeal | null;
  dinner: MealPlanMeal | null;
  snack: MealPlanMeal | null;
  dailyCalories: number;
  dailyProtein: number;
  dailyPrice: number;
}

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
  mealPlan?: MealPlanDay[];
  mealImages?: Map<string, string>; // Map of meal ID to base64 image
}

export class ProfessionalWeeklyReportPDF {
  private doc: jsPDF;
  private pageNumber = 1;
  private totalPages = 0;
  private logoBase64: string | null = null;

  constructor() {
    this.doc = new jsPDF({
      unit: "mm",
      format: "a4",
      compress: true,
    });
  }

  private setFontSize(size: number) {
    this.doc.setFontSize(Math.round(size * FONT_SCALE * 10) / 10);
  }

  private async loadLogo(): Promise<void> {
    try {
      const response = await fetch('/logo.png');
      if (!response.ok) return;
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          this.logoBase64 = reader.result as string;
          resolve();
        };
        reader.onerror = () => resolve();
        reader.readAsDataURL(blob);
      });
    } catch {
      // Logo not available — will use text fallback
    }
  }

  generate(data: WeeklyReportData): jsPDF {
    this.pageNumber = 1;
    this.addCoverPage(data);
    this.addPerformanceScore(data);
    this.addWeeklySnapshot(data);
    this.addMacroStability(data);
    this.addMomentumScore(data);
    this.addHabitRiskDetection(data);
    this.addCalorieOverview(data);
    this.addMacroDistribution(data);
    this.addHydrationConsistency(data);
    this.addMealPlanningRecommendations(data);
    this.addMealPlan(data);
    this.addTrendAnalysis(data);
    this.addPredictiveTimeline(data);
    this.addDataAvailabilityStatus(data);
    this.addDisclaimer(data);

    this.totalPages = this.pageNumber;

    // Second pass: stamp footers on every page (skip cover = page 1)
    for (let p = 2; p <= this.totalPages; p++) {
      this.doc.setPage(p);
      this.stampFooter(p);
    }
    
    return this.doc;
  }

  private addCoverPage(data: WeeklyReportData) {
    // Dark background
    this.doc.setFillColor(...COLORS.slateDark);
    this.doc.rect(0, 0, PAGE_WIDTH, 297, "F");

    // Top accent bar
    this.drawGradientBar(0, 0, PAGE_WIDTH, 4, COLORS.gradientStart, COLORS.gradientEnd);

    // Logo
    const logoY = 40;
    if (this.logoBase64) {
      try {
        const raw = this.logoBase64.split(',')[1] || this.logoBase64;
        this.doc.addImage(raw, 'PNG', PAGE_WIDTH / 2 - 18, logoY, 36, 36, undefined, 'FAST');
      } catch {
        this.drawTextLogo(PAGE_WIDTH / 2, logoY + 18, 18, true);
      }
    } else {
      this.drawTextLogo(PAGE_WIDTH / 2, logoY + 18, 18, true);
    }

    // Brand name
    this.doc.setTextColor(255, 255, 255);
    this.setFontSize(14);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("NUTRIO FUEL", PAGE_WIDTH / 2, logoY + 48, { align: "center" });

    // Title block
    this.doc.setTextColor(255, 255, 255);
    this.setFontSize(22);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("NUTRITION PERFORMANCE", PAGE_WIDTH / 2, 115, { align: "center" });
    this.doc.text("& HABIT INTELLIGENCE", PAGE_WIDTH / 2, 126, { align: "center" });

    this.setFontSize(10);
    this.doc.setFont("helvetica", "normal");
    this.doc.setTextColor(...COLORS.emerald);
    this.doc.text("Weekly Report", PAGE_WIDTH / 2, 138, { align: "center" });

    // Thin divider
    this.drawGradientBar(PAGE_WIDTH / 2 - 30, 145, 60, 1.5, COLORS.gradientStart, COLORS.gradientEnd);

    // Date range
    const dateRange = `${format(new Date(data.weekStart), "MMM d")} - ${format(new Date(data.weekEnd), "MMM d, yyyy")}`;
    this.doc.setTextColor(255, 255, 255);
    this.setFontSize(11);
    this.doc.setFont("helvetica", "bold");
    this.doc.text(dateRange, PAGE_WIDTH / 2, 158, { align: "center" });

    // User info card
    this.doc.setFillColor(40, 52, 72);
    this.doc.roundedRect(MARGIN + 15, 172, CONTENT_WIDTH - 30, 50, 6, 6, "F");

    this.doc.setTextColor(...COLORS.textMuted);
    this.setFontSize(8);
    this.doc.setFont("helvetica", "normal");
    this.doc.text("PREPARED FOR", PAGE_WIDTH / 2, 187, { align: "center" });

    this.doc.setTextColor(255, 255, 255);
    this.setFontSize(15);
    this.doc.setFont("helvetica", "bold");
    this.doc.text(data.userName.toUpperCase(), PAGE_WIDTH / 2, 202, { align: "center" });

    this.setFontSize(8);
    this.doc.setFont("helvetica", "normal");
    this.doc.setTextColor(...COLORS.textMuted);
    this.doc.text(data.userEmail, PAGE_WIDTH / 2, 213, { align: "center" });

    // Overall Score
    const overallScore = this.calculateOverallScore(data);
    const scoreLabel = overallScore >= 80 ? "Excellent" : overallScore >= 60 ? "Good" : overallScore >= 40 ? "Fair" : "Developing";

    this.doc.setFillColor(...COLORS.primary);
    this.doc.circle(PAGE_WIDTH / 2, 253, 22, "F");
    this.doc.setFillColor(...COLORS.primaryDark);
    this.doc.circle(PAGE_WIDTH / 2, 253, 18, "F");

    this.doc.setTextColor(255, 255, 255);
    this.setFontSize(26);
    this.doc.setFont("helvetica", "bold");
    this.doc.text(`${overallScore}`, PAGE_WIDTH / 2, 259, { align: "center" });

    this.setFontSize(7);
    this.doc.setFont("helvetica", "normal");
    this.doc.setTextColor(...COLORS.emerald);
    this.doc.text(scoreLabel.toUpperCase(), PAGE_WIDTH / 2, 268, { align: "center" });

    // Generated date
    this.doc.setTextColor(...COLORS.textMuted);
    this.setFontSize(7);
    this.doc.text(`Generated ${format(new Date(), "MMMM d, yyyy 'at' h:mm a")}`, PAGE_WIDTH / 2, 284, { align: "center" });

    // Bottom accent bar
    this.drawGradientBar(0, 293, PAGE_WIDTH, 4, COLORS.gradientStart, COLORS.gradientEnd);
  }

  private drawTextLogo(cx: number, cy: number, r: number, onDark: boolean) {
    this.doc.setFillColor(...COLORS.primary);
    this.doc.circle(cx, cy, r, "F");
    this.doc.setTextColor(255, 255, 255);
    this.setFontSize(r * 1.4);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("N", cx, cy + r * 0.35, { align: "center" });
  }

  private addPerformanceScore(data: WeeklyReportData) {
    this.doc.addPage();
    this.pageNumber++;
    this.addSectionHeader("1. OVERALL PERFORMANCE SCORE");

    let y = 45;

    const overallScore = this.calculateOverallScore(data);
    const scoreLabel = overallScore >= 80 ? "Excellent" : overallScore >= 60 ? "Good" : overallScore >= 40 ? "Fair" : "Developing";

    // Score display
    this.doc.setFillColor(...COLORS.card);
    this.doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 50, 8, 8, "F");

    this.doc.setFillColor(...COLORS.primary);
    this.doc.circle(MARGIN + 40, y + 25, 18, "F");

    this.doc.setTextColor(255, 255, 255);
    this.setFontSize(20);
    this.doc.setFont("helvetica", "bold");
    this.doc.text(`${overallScore}`, MARGIN + 40, y + 30, { align: "center" });

    this.doc.setTextColor(...COLORS.textPrimary);
    this.setFontSize(14);
    this.doc.setFont("helvetica", "bold");
    this.doc.text(`${overallScore} / 100`, MARGIN + 70, y + 22);

    this.doc.setTextColor(...COLORS.textSecondary);
    this.setFontSize(8);
    this.doc.setFont("helvetica", "normal");
    this.doc.text(`Performance Rating: ${scoreLabel}`, MARGIN + 70, y + 32);

    y += 60;

    // Score Breakdown
    this.doc.setTextColor(...COLORS.textPrimary);
    this.setFontSize(11);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Score Composition", MARGIN, y);

    y += 10;

    const scores = [
      { label: "Logging Consistency", value: 30, pct: data.consistencyScore },
      { label: "Calorie Alignment", value: 25, pct: Math.min(100, Math.round((data.avgCalories / data.calorieTarget) * 100)) },
      { label: "Protein Alignment", value: 15, pct: Math.min(100, Math.round((data.avgProtein / data.proteinTarget) * 100)) },
      { label: "Macro Balance", value: 10, pct: data.mealQualityScore },
      { label: "Hydration", value: 10, pct: Math.min(100, Math.round((data.waterAverage / 8) * 100)) },
      { label: "Stability & Momentum", value: 10, pct: Math.min(100, (data.currentStreak / Math.max(data.bestStreak, 1)) * 100) },
    ];

    scores.forEach((score, idx) => {
      const sy = y + idx * 12;
      
      this.doc.setTextColor(...COLORS.textSecondary);
      this.setFontSize(8);
      this.doc.setFont("helvetica", "normal");
      this.doc.text(`${score.label} (${score.value}%)`, MARGIN, sy);

      // Progress bar
      this.doc.setFillColor(...COLORS.border);
      this.doc.roundedRect(MARGIN + 80, sy - 4, 60, 6, 3, 3, "F");
      
      const barColor = score.pct >= 70 ? COLORS.success : score.pct >= 40 ? COLORS.warning : COLORS.primary;
      this.doc.setFillColor(...barColor);
      this.doc.roundedRect(MARGIN + 80, sy - 4, 60 * (score.pct / 100), 6, 3, 3, "F");

      this.doc.setTextColor(...COLORS.textPrimary);
      this.setFontSize(8);
      this.doc.setFont("helvetica", "bold");
      this.doc.text(`${score.pct}%`, MARGIN + 145, sy);
    });

    y += 90;

    this.doc.setTextColor(...COLORS.textSecondary);
    this.setFontSize(8);
    this.doc.setFont("helvetica", "italic");
    this.doc.text("Your performance score reflects the consistency of your tracking habits and alignment with nutritional targets.", MARGIN, y);
  }

  private addWeeklySnapshot(data: WeeklyReportData) {
    let y = 200;

    this.doc.addPage();
    this.pageNumber++;
    y = 45;

    this.addSectionHeader("2. WEEKLY SNAPSHOT");

    // Executive Summary
    this.doc.setTextColor(...COLORS.textSecondary);
    this.setFontSize(8);
    this.doc.setFont("helvetica", "normal");
    this.doc.text("A summary of your key nutrition metrics for the week.", MARGIN, y);
    y += 12;

    // Metrics grid
    const metrics = [
      { label: "Days Logged", value: `${data.daysLogged} / 7`, subtext: "tracking consistency" },
      { label: "Avg Daily Calories", value: `${Math.round(data.avgCalories)} kcal`, subtext: `target: ${data.calorieTarget}` },
      { label: "Avg Protein", value: `${Math.round(data.avgProtein)} g`, subtext: `target: ${data.proteinTarget}g` },
      { label: "Hydration Days", value: `${data.dailyData.filter(d => d.water > 0).length} / 7`, subtext: "days with water logs" },
    ];

    metrics.forEach((metric, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const x = MARGIN + col * (CONTENT_WIDTH / 2 + 5);
      const my = y + row * 35;

      this.doc.setFillColor(...COLORS.card);
      this.doc.roundedRect(x, my, CONTENT_WIDTH / 2 - 5, 30, 6, 6, "F");

      this.doc.setTextColor(...COLORS.textMuted);
      this.setFontSize(7);
      this.doc.setFont("helvetica", "normal");
      this.doc.text(metric.label, x + 8, my + 9);

      this.doc.setTextColor(...COLORS.textPrimary);
      this.setFontSize(12);
      this.doc.setFont("helvetica", "bold");
      this.doc.text(metric.value, x + 8, my + 20);

      this.doc.setTextColor(...COLORS.textMuted);
      this.setFontSize(6);
      this.doc.text(metric.subtext, x + 8, my + 27);
    });

    y += 85;

    // Quick Insight
    this.doc.setFillColor(...COLORS.background);
    this.doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 45, 6, 6, "F");

    this.doc.setFillColor(...COLORS.primary);
    this.doc.roundedRect(MARGIN, y, 4, 45, 2, 2, "F");

    this.doc.setTextColor(...COLORS.textPrimary);
    this.setFontSize(10);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Weekly Insight", MARGIN + 10, y + 12);

    const insight = this.generateQuickInsight(data);
    this.doc.setTextColor(...COLORS.textSecondary);
    this.setFontSize(8);
    this.doc.setFont("helvetica", "normal");
    const insightLines = this.doc.splitTextToSize(insight, CONTENT_WIDTH - 24);
    this.doc.text(insightLines, MARGIN + 10, y + 22);
  }

  private addMacroStability(data: WeeklyReportData) {
    let y = 290;

    this.doc.addPage();
    this.pageNumber++;
    y = 45;

    this.addSectionHeader("3. MACRO STABILITY INDEX");

    // Executive Summary
    this.doc.setTextColor(...COLORS.textSecondary);
    this.setFontSize(8);
    this.doc.setFont("helvetica", "normal");
    this.doc.text("Measures how consistent your daily calorie intake was throughout the week.", MARGIN, y);
    y += 15;

    // Calculate variance
    const calorieVariance = this.calculateVariance(data.dailyData.map(d => d.calories).filter(c => c > 0));
    const stabilityLevel = calorieVariance < 10 ? "High" : calorieVariance < 20 ? "Moderate" : "Variable";

    // Stability Score Card
    this.doc.setFillColor(...COLORS.card);
    this.doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 45, 8, 8, "F");

    const stabilityColor = stabilityLevel === "High" ? COLORS.success : stabilityLevel === "Moderate" ? COLORS.warning : COLORS.primary;
    this.doc.setFillColor(...stabilityColor);
    this.doc.circle(MARGIN + 25, y + 22, 15, "F");

    this.doc.setTextColor(255, 255, 255);
    this.setFontSize(10);
    this.doc.setFont("helvetica", "bold");
    this.doc.text(stabilityLevel, MARGIN + 25, y + 26, { align: "center" });

    this.doc.setTextColor(...COLORS.textPrimary);
    this.setFontSize(12);
    this.doc.setFont("helvetica", "bold");
    this.doc.text(`Stability Level: ${stabilityLevel}`, MARGIN + 50, y + 18);

    this.doc.setTextColor(...COLORS.textSecondary);
    this.setFontSize(8);
    this.doc.setFont("helvetica", "normal");
    this.doc.text(`Calorie variance: ${Math.round(calorieVariance)}%`, MARGIN + 50, y + 28);

    y += 55;

    // Stability Classification
    this.doc.setTextColor(...COLORS.textPrimary);
    this.setFontSize(10);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Stability Benchmarks", MARGIN, y);

    y += 10;

    const classifications = [
      { range: "< 10% variance", level: "High Stability", desc: "Consistent daily intake", color: COLORS.success },
      { range: "10-20% variance", level: "Moderate", desc: "Some daily variation", color: COLORS.warning },
      { range: "> 20% variance", level: "Variable", desc: "Significant fluctuation", color: COLORS.primary },
    ];

    classifications.forEach((cls, idx) => {
      const cy = y + idx * 14;
      
      this.doc.setFillColor(...cls.color);
      this.doc.circle(MARGIN + 5, cy - 2, 4, "F");

      this.doc.setTextColor(...COLORS.textPrimary);
      this.setFontSize(8);
      this.doc.setFont("helvetica", "bold");
      this.doc.text(`${cls.range}: ${cls.level}`, MARGIN + 15, cy);

      this.doc.setTextColor(...COLORS.textSecondary);
      this.setFontSize(7);
      this.doc.setFont("helvetica", "normal");
      this.doc.text(cls.desc, MARGIN + 15, cy + 5);
    });

    y += 55;

    // Insight
    this.doc.setFillColor(...COLORS.background);
    this.doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 40, 6, 6, "F");

    this.doc.setTextColor(...COLORS.textPrimary);
    this.setFontSize(9);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("What This Means", MARGIN + 10, y + 12);

    this.doc.setTextColor(...COLORS.textSecondary);
    this.setFontSize(8);
    this.doc.setFont("helvetica", "normal");
    
    const stabilityInsight = stabilityLevel === "High" 
      ? "Your intake remained consistent day-to-day, indicating a structured routine. This stability supports steady progress toward your goals."
      : stabilityLevel === "Moderate"
      ? "Your intake varied moderately across the week. Adding more consistency to meal timing and portions could enhance your results."
      : "Your intake fluctuated significantly between days. Consider establishing regular meal patterns to create more predictable energy levels.";
    
    const lines = this.doc.splitTextToSize(stabilityInsight, CONTENT_WIDTH - 24);
    this.doc.text(lines, MARGIN + 10, y + 22);
  }

  private addMomentumScore(data: WeeklyReportData) {
    this.doc.addPage();
    this.pageNumber++;
    let y = 45;

    this.addSectionHeader("4. WEEKLY MOMENTUM SCORE");

    // Executive Summary
    this.doc.setTextColor(...COLORS.textSecondary);
    this.setFontSize(8);
    this.doc.setFont("helvetica", "normal");
    this.doc.text("Tracks the direction of your habits based on recent performance trends.", MARGIN, y);
    y += 15;

    // Calculate momentum
    const momentum = this.calculateMomentum(data);
    const momentumStatus = momentum > 2 ? "Building" : momentum < -2 ? "Adjusting" : "Stable";
    const momentumColor = momentum > 2 ? COLORS.success : momentum < -2 ? COLORS.rose : COLORS.warning;

    // Momentum Card
    this.doc.setFillColor(...COLORS.card);
    this.doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 50, 8, 8, "F");

    this.doc.setFillColor(...momentumColor);
    this.doc.circle(MARGIN + 25, y + 25, 15, "F");

    this.doc.setTextColor(255, 255, 255);
    this.setFontSize(12);
    this.doc.setFont("helvetica", "bold");
    this.doc.text(momentum > 0 ? `+${momentum}` : `${momentum}`, MARGIN + 25, y + 30, { align: "center" });

    this.doc.setTextColor(...COLORS.textPrimary);
    this.setFontSize(11);
    this.doc.setFont("helvetica", "bold");
    this.doc.text(`Momentum Score: ${momentum}`, MARGIN + 50, y + 18);

    this.doc.setTextColor(...momentumColor);
    this.setFontSize(9);
    this.doc.text(`Status: ${momentumStatus}`, MARGIN + 50, y + 30);

    y += 60;

    // Contributing factors - dynamic based on momentum direction
    this.doc.setTextColor(...COLORS.textPrimary);
    this.setFontSize(9);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Contributing Factors:", MARGIN, y);

    y += 10;

    const factors = momentum > 2 
      ? [
          "Strong logging consistency maintained",
          "Protein targets approached or achieved", 
          "Reduced intake variance observed",
          "Hydration habits above baseline",
          "Active tracking streak in progress"
        ]
      : momentum < -2
      ? [
          "Logging frequency below optimal levels",
          "Protein intake below target range",
          "Higher day-to-day intake variance",
          "Hydration tracking gaps detected",
          "Recent break in tracking streak"
        ]
      : [
          "Consistency levels holding steady",
          "Some metrics improving, others stable",
          "Baseline habits maintained",
          "Room for incremental improvements",
          "Foundation established for growth"
        ];

    factors.forEach((factor, idx) => {
      this.doc.setTextColor(...COLORS.textSecondary);
      this.setFontSize(7);
      this.doc.text(`- ${factor}`, MARGIN + 5, y + idx * 8);
    });

    y += 50;

    // Momentum insight
    this.doc.setFillColor(...COLORS.background);
    this.doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 35, 6, 6, "F");

    this.doc.setTextColor(...COLORS.textPrimary);
    this.setFontSize(9);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Momentum Analysis", MARGIN + 10, y + 12);

    const momentumInsight = momentum > 2 
      ? "Your habits are trending positively. The consistency you're building creates compounding benefits for long-term success."
      : momentum < -2
      ? "Your tracking momentum has slowed. This is a natural part of habit formation. Consider setting daily reminders to rebuild consistency."
      : "Your habits are holding steady. This stability provides a solid foundation. Small, intentional improvements can build momentum from here.";

    this.doc.setTextColor(...COLORS.textSecondary);
    this.setFontSize(8);
    const insightLines = this.doc.splitTextToSize(momentumInsight, CONTENT_WIDTH - 24);
    this.doc.text(insightLines, MARGIN + 10, y + 22);
  }

  private addHabitRiskDetection(data: WeeklyReportData) {
    let y = 290;

    this.doc.addPage();
    this.pageNumber++;
    y = 45;

    this.addSectionHeader("5. HABIT PATTERN ANALYSIS");

    // Executive Summary
    this.doc.setTextColor(...COLORS.textSecondary);
    this.setFontSize(8);
    this.doc.setFont("helvetica", "normal");
    this.doc.text("Identifies behavioral patterns that may impact your progress toward nutrition goals.", MARGIN, y);
    y += 15;

    // Detect risks
    const risks = this.detectHabitRisks(data);
    const riskLevel = risks.length === 0 ? "Low" : risks.length <= 2 ? "Moderate" : "High";
    const riskColor = risks.length === 0 ? COLORS.success : risks.length <= 2 ? COLORS.warning : COLORS.primary;

    // Risk Level Card
    this.doc.setFillColor(...COLORS.card);
    this.doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 40, 8, 8, "F");

    this.doc.setFillColor(...riskColor);
    this.doc.roundedRect(MARGIN, y, 80, 40, 8, 8, "F");

    this.doc.setTextColor(255, 255, 255);
    this.setFontSize(10);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Pattern Level:", MARGIN + 10, y + 15);

    this.setFontSize(14);
    this.doc.text(riskLevel, MARGIN + 10, y + 30);

    this.doc.setTextColor(...COLORS.textSecondary);
    this.setFontSize(7);
    this.doc.setFont("helvetica", "normal");
    this.doc.text("System monitors:", MARGIN + 90, y + 12);

    const detections = [
      "Logging frequency (< 5 days/week)",
      "Daily intake variance (> 25%)",
      "Protein gaps (< 50% of target)",
      "Weekend pattern deviations",
      "Consecutive missed log days",
    ];

    detections.forEach((det, idx) => {
      this.doc.text(`- ${det}`, MARGIN + 90, y + 22 + idx * 5);
    });

    y += 50;

    // Risk output
    if (risks.length > 0) {
      this.doc.setFillColor(...COLORS.background);
      this.doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 25 + risks.length * 10, 6, 6, "F");

      this.doc.setFillColor(...COLORS.primary);
      this.doc.roundedRect(MARGIN, y, 4, 25 + risks.length * 10, 2, 2, "F");

      this.doc.setTextColor(...COLORS.textPrimary);
      this.setFontSize(9);
      this.doc.setFont("helvetica", "bold");
      this.doc.text("Observed Patterns:", MARGIN + 10, y + 12);

      risks.forEach((risk, idx) => {
        this.doc.setTextColor(...COLORS.textSecondary);
        this.setFontSize(8);
        this.doc.text(`- ${risk}`, MARGIN + 10, y + 22 + idx * 10);
      });

      y += 35 + risks.length * 10;
    }

    this.doc.setTextColor(...COLORS.textMuted);
    this.setFontSize(7);
    this.doc.setFont("helvetica", "italic");
    this.doc.text("This analysis focuses on tracking and intake patterns for lifestyle optimization.", MARGIN, y);
  }

  private addCalorieOverview(data: WeeklyReportData) {
    this.doc.addPage();
    this.pageNumber++;
    let y = 45;

    this.addSectionHeader("6. CALORIE ALIGNMENT OVERVIEW");

    // Executive Summary
    this.doc.setTextColor(...COLORS.textSecondary);
    this.setFontSize(8);
    this.doc.setFont("helvetica", "normal");
    this.doc.text("Compares your actual intake against your personalized calorie target.", MARGIN, y);
    y += 15;

    // Calorie stats
    const calorieDiff = data.avgCalories - data.calorieTarget;
    const alignment = Math.abs(calorieDiff) < 100 ? "Aligned" : calorieDiff > 0 ? "Above Target" : "Below Target";
    const variance = this.calculateVariance(data.dailyData.map(d => d.calories).filter(c => c > 0));
    const stability = variance < 10 ? "High" : variance < 20 ? "Moderate" : "Variable";

    // Stats card
    this.doc.setFillColor(...COLORS.card);
    this.doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 65, 8, 8, "F");

    const stats = [
      { label: "Your Target:", value: `${data.calorieTarget.toLocaleString()} kcal/day` },
      { label: "Weekly Average:", value: `${Math.round(data.avgCalories).toLocaleString()} kcal/day` },
      { label: "Difference:", value: `${calorieDiff > 0 ? '+' : ''}${Math.round(calorieDiff).toLocaleString()} kcal/day` },
    ];

    stats.forEach((stat, idx) => {
      const sy = y + 15 + idx * 16;
      
      this.doc.setTextColor(...COLORS.textMuted);
      this.setFontSize(8);
      this.doc.text(stat.label, MARGIN + 10, sy);

      this.doc.setTextColor(...COLORS.textPrimary);
      this.setFontSize(10);
      this.doc.setFont("helvetica", "bold");
      this.doc.text(stat.value, MARGIN + 60, sy);
    });

    // Alignment badge
    const alignColor = alignment === "Aligned" ? COLORS.success : alignment === "Below Target" ? COLORS.warning : COLORS.primary;
    this.doc.setFillColor(...alignColor);
    this.doc.roundedRect(MARGIN + 110, y + 10, 75, 22, 11, 11, "F");

    this.doc.setTextColor(255, 255, 255);
    this.setFontSize(9);
    this.doc.setFont("helvetica", "bold");
    this.doc.text(alignment, MARGIN + 147.5, y + 24, { align: "center" });

    // Additional metrics
    this.doc.setTextColor(...COLORS.textSecondary);
    this.setFontSize(8);
    this.doc.setFont("helvetica", "normal");
    this.doc.text(`Daily Consistency: ${stability}`, MARGIN + 10, y + 58);

    y += 80;

    // Caution note for very low intake
    if (data.avgCalories < 1200 && data.daysLogged >= 3) {
      this.doc.setFillColor(...COLORS.background);
      this.doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 35, 6, 6, "F");

      this.doc.setFillColor(...COLORS.warning);
      this.doc.roundedRect(MARGIN, y, 4, 35, 2, 2, "F");

      this.doc.setTextColor(...COLORS.textPrimary);
      this.setFontSize(9);
      this.doc.setFont("helvetica", "bold");
      this.doc.text("Intake Observation", MARGIN + 10, y + 12);

      this.doc.setTextColor(...COLORS.textSecondary);
      this.setFontSize(7);
      this.doc.setFont("helvetica", "normal");
      const cautionLines = this.doc.splitTextToSize(
        "Your recorded intake is below typical ranges. Ensure you're logging all meals and snacks. If this reflects actual consumption, consider consulting a nutrition professional to support your goals safely.",
        CONTENT_WIDTH - 24
      );
      this.doc.text(cautionLines, MARGIN + 10, y + 22);
    }
  }

  private addMacroDistribution(data: WeeklyReportData) {
    this.doc.addPage();
    this.pageNumber++;
    let y = 45;

    this.addSectionHeader("7. MACRONUTRIENT DISTRIBUTION");

    // Executive Summary
    this.doc.setTextColor(...COLORS.textSecondary);
    this.setFontSize(8);
    this.doc.setFont("helvetica", "normal");
    this.doc.text("Breakdown of your protein, carbohydrate, and fat intake compared to targets.", MARGIN, y);
    y += 15;

    // Table
    const totalMacros = data.avgProtein * 4 + data.avgCarbs * 4 + data.avgFat * 9;
    const proteinPct = totalMacros > 0 ? Math.round((data.avgProtein * 4 / totalMacros) * 100) : 0;
    const carbsPct = totalMacros > 0 ? Math.round((data.avgCarbs * 4 / totalMacros) * 100) : 0;
    const fatPct = totalMacros > 0 ? 100 - proteinPct - carbsPct : 0;

    autoTable(this.doc, {
      startY: y,
      head: [["Macronutrient", "Actual (Daily Avg)", "Your Target", "Progress"]],
      body: [
        ["Protein", `${Math.round(data.avgProtein)}g`, `${data.proteinTarget}g`, `${Math.round((data.avgProtein / data.proteinTarget) * 100)}%`],
        ["Carbohydrates", `${Math.round(data.avgCarbs)}g`, `${data.carbsTarget}g`, `${Math.round((data.avgCarbs / data.carbsTarget) * 100)}%`],
        ["Fat", `${Math.round(data.avgFat)}g`, `${data.fatTarget}g`, `${Math.round((data.avgFat / data.fatTarget) * 100)}%`],
      ],
      headStyles: {
        fillColor: COLORS.slate,
        textColor: COLORS.white,
        fontStyle: "bold",
        fontSize: 9,
      },
      bodyStyles: {
        fontSize: 9,
        textColor: COLORS.textPrimary,
      },
      alternateRowStyles: {
        fillColor: COLORS.background,
      },
      margin: { left: MARGIN, right: MARGIN },
    });

    y += 60;

    // Macro Balance (%)
    this.doc.setTextColor(...COLORS.textPrimary);
    this.setFontSize(10);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Your Calorie Distribution:", MARGIN, y);

    y += 12;

    const macros = [
      { label: "Protein", pct: proteinPct, color: COLORS.primary, desc: "4 calories per gram" },
      { label: "Carbohydrates", pct: carbsPct, color: COLORS.accent, desc: "4 calories per gram" },
      { label: "Fat", pct: fatPct, color: COLORS.violet, desc: "9 calories per gram" },
    ];

    macros.forEach((macro, idx) => {
      const my = y + idx * 14;
      
      this.doc.setFillColor(...macro.color);
      this.doc.circle(MARGIN + 5, my - 2, 4, "F");

      this.doc.setTextColor(...COLORS.textPrimary);
      this.setFontSize(8);
      this.doc.setFont("helvetica", "bold");
      this.doc.text(`${macro.label}: ${macro.pct}%`, MARGIN + 15, my);

      this.doc.setTextColor(...COLORS.textSecondary);
      this.setFontSize(7);
      this.doc.setFont("helvetica", "normal");
      this.doc.text(macro.desc, MARGIN + 15, my + 5);
    });

    y += 55;

    // Insight
    this.doc.setFillColor(...COLORS.background);
    this.doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 30, 6, 6, "F");

    this.doc.setTextColor(...COLORS.textSecondary);
    this.setFontSize(8);
    this.doc.setFont("helvetica", "normal");
    const macroInsight = `Your macronutrient distribution shows ${proteinPct}% from protein, ${carbsPct}% from carbohydrates, and ${fatPct}% from fat. Protein alignment is ${(data.avgProtein / data.proteinTarget * 100) >= 90 ? 'strong' : 'an area for improvement'}.`;
    const lines = this.doc.splitTextToSize(macroInsight, CONTENT_WIDTH - 20);
    this.doc.text(lines, MARGIN + 10, y + 12);
  }

  private addHydrationConsistency(data: WeeklyReportData) {
    this.doc.addPage();
    this.pageNumber++;
    let y = 45;

    this.addSectionHeader("8. HYDRATION TRACKING");

    // Executive Summary
    this.doc.setTextColor(...COLORS.textSecondary);
    this.setFontSize(8);
    this.doc.setFont("helvetica", "normal");
    this.doc.text("Tracks your daily water intake logging and average consumption.", MARGIN, y);
    y += 15;

    const daysTracked = data.dailyData.filter(d => d.water > 0).length;
    const avgWater = data.waterAverage;
    const targetWater = 8;
    const stability = avgWater >= 6 ? "High" : avgWater >= 4 ? "Moderate" : "Developing";

    // Stats cards
    this.doc.setFillColor(...COLORS.card);
    this.doc.roundedRect(MARGIN, y, CONTENT_WIDTH / 3 - 5, 42, 6, 6, "F");
    this.doc.roundedRect(MARGIN + CONTENT_WIDTH / 3, y, CONTENT_WIDTH / 3 - 5, 42, 6, 6, "F");
    this.doc.roundedRect(MARGIN + (CONTENT_WIDTH / 3) * 2, y, CONTENT_WIDTH / 3 - 5, 42, 6, 6, "F");

    // Days tracked
    this.doc.setTextColor(...COLORS.textMuted);
    this.setFontSize(7);
    this.doc.text("Days Logged", MARGIN + 10, y + 10);
    this.doc.setTextColor(...COLORS.textPrimary);
    this.setFontSize(14);
    this.doc.setFont("helvetica", "bold");
    this.doc.text(`${daysTracked} / 7`, MARGIN + 10, y + 25);
    this.doc.setTextColor(...COLORS.textMuted);
    this.setFontSize(6);
    this.doc.text("out of 7 days", MARGIN + 10, y + 33);

    // Average intake
    this.doc.setTextColor(...COLORS.textMuted);
    this.setFontSize(7);
    this.doc.text("Daily Average", MARGIN + CONTENT_WIDTH / 3 + 10, y + 10);
    this.doc.setTextColor(...COLORS.textPrimary);
    this.setFontSize(14);
    this.doc.setFont("helvetica", "bold");
    this.doc.text(`${avgWater.toFixed(1)}`, MARGIN + CONTENT_WIDTH / 3 + 10, y + 25);
    this.doc.setTextColor(...COLORS.textMuted);
    this.setFontSize(6);
    this.doc.text("glasses per day", MARGIN + CONTENT_WIDTH / 3 + 10, y + 33);

    // Target
    this.doc.setTextColor(...COLORS.textMuted);
    this.setFontSize(7);
    this.doc.text("Daily Target", MARGIN + (CONTENT_WIDTH / 3) * 2 + 10, y + 10);
    this.doc.setTextColor(...COLORS.textPrimary);
    this.setFontSize(14);
    this.doc.setFont("helvetica", "bold");
    this.doc.text(`${targetWater}`, MARGIN + (CONTENT_WIDTH / 3) * 2 + 10, y + 25);
    this.doc.setTextColor(...COLORS.textMuted);
    this.setFontSize(6);
    this.doc.text("glasses per day", MARGIN + (CONTENT_WIDTH / 3) * 2 + 10, y + 33);

    y += 55;

    // Insight
    this.doc.setFillColor(...COLORS.background);
    this.doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 35, 6, 6, "F");

    this.doc.setTextColor(...COLORS.textPrimary);
    this.setFontSize(9);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Hydration Insight", MARGIN + 10, y + 12);

    const hydrationInsight = avgWater >= 6
      ? `You're averaging ${avgWater.toFixed(1)} glasses per day with ${stability.toLowerCase()} consistency. Good hydration supports energy levels and overall wellness.`
      : avgWater >= 4
      ? `You're averaging ${avgWater.toFixed(1)} glasses per day. There's room to increase toward the 8-glass target for optimal hydration.`
      : `Hydration tracking shows ${avgWater.toFixed(1)} glasses per day average. Consider setting reminders to build this healthy habit.`;

    this.doc.setTextColor(...COLORS.textSecondary);
    this.setFontSize(8);
    this.doc.setFont("helvetica", "normal");
    const lines = this.doc.splitTextToSize(hydrationInsight, CONTENT_WIDTH - 24);
    this.doc.text(lines, MARGIN + 10, y + 22);
  }

  private addMealPlanningRecommendations(data: WeeklyReportData) {
    let y = 280;

    this.doc.addPage();
    this.pageNumber++;
    y = 45;

    this.addSectionHeader("9. PERSONALIZED RECOMMENDATIONS");

    // Executive Summary
    this.doc.setTextColor(...COLORS.textSecondary);
    this.setFontSize(8);
    this.doc.setFont("helvetica", "normal");
    this.doc.text("Actionable guidance based on your specific nutrition patterns.", MARGIN, y);
    y += 15;

    const recommendations = this.generateMealRecommendations(data);

    recommendations.forEach((rec, idx) => {
      const ry = y + idx * 40;
      
      this.doc.setFillColor(...COLORS.card);
      this.doc.roundedRect(MARGIN, ry, CONTENT_WIDTH, 35, 6, 6, "F");

      this.doc.setFillColor(...COLORS.primary);
      this.doc.roundedRect(MARGIN, ry, 25, 35, 6, 6, "F");

      this.doc.setTextColor(255, 255, 255);
      this.setFontSize(10);
      this.doc.setFont("helvetica", "bold");
      this.doc.text(`${idx + 1}`, MARGIN + 12.5, ry + 22, { align: "center" });

      this.doc.setTextColor(...COLORS.textPrimary);
      this.setFontSize(9);
      this.doc.setFont("helvetica", "bold");
      this.doc.text(rec.title, MARGIN + 32, ry + 14);

      this.doc.setTextColor(...COLORS.textSecondary);
      this.setFontSize(7);
      this.doc.setFont("helvetica", "normal");
      const descLines = this.doc.splitTextToSize(rec.description, CONTENT_WIDTH - 50);
      this.doc.text(descLines, MARGIN + 32, ry + 24);
    });

    y += recommendations.length * 40 + 10;

    this.doc.setTextColor(...COLORS.textMuted);
    this.setFontSize(7);
    this.doc.setFont("helvetica", "italic");
    this.doc.text("Recommendations are generated from your personal data patterns to support your lifestyle goals.", MARGIN, y);
  }

  private addMealPlan(data: WeeklyReportData) {
    this.doc.addPage();
    this.pageNumber++;
    let y = 45;

    this.addSectionHeader("10. NEXT WEEK MEAL PLAN");

    // Executive Summary
    this.doc.setTextColor(...COLORS.textSecondary);
    this.setFontSize(8);
    this.doc.setFont("helvetica", "normal");
    this.doc.text("AI-generated meal suggestions for next week based on your nutrition targets and preferences.", MARGIN, y);
    y += 15;

    // Check if meal plan exists
    if (!data.mealPlan || data.mealPlan.length === 0) {
      this.doc.setFillColor(...COLORS.background);
      this.doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 50, 6, 6, "F");
      
      this.doc.setTextColor(...COLORS.textPrimary);
      this.setFontSize(10);
      this.doc.setFont("helvetica", "bold");
      this.doc.text("Generate Your Personalized Meal Plan", MARGIN + 10, y + 15);
      
      this.doc.setTextColor(...COLORS.textSecondary);
      this.setFontSize(8);
      const infoLines = this.doc.splitTextToSize(
        "Our AI analyzes your nutrition targets, dietary preferences, and favorite restaurants to create a personalized 7-day meal plan. Each suggestion is carefully selected to help you meet your goals while enjoying delicious meals from our partner restaurants.",
        CONTENT_WIDTH - 24
      );
      this.doc.text(infoLines, MARGIN + 10, y + 28);
      
      this.doc.setTextColor(...COLORS.primary);
      this.setFontSize(8);
      this.doc.text("Visit the app to generate your custom meal plan.", MARGIN + 10, y + 48);
      return;
    }

    // Calculate next week dates
    const today = new Date();
    const nextWeekStart = new Date(today);
    nextWeekStart.setDate(today.getDate() + (7 - today.getDay()));
    const nextWeekEnd = new Date(nextWeekStart);
    nextWeekEnd.setDate(nextWeekStart.getDate() + 6);

    // Week range display
    this.doc.setFillColor(...COLORS.primary);
    this.doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 25, 6, 6, "F");
    
    this.doc.setTextColor(255, 255, 255);
    this.setFontSize(10);
    this.doc.setFont("helvetica", "bold");
    this.doc.text(
      `Week of ${format(nextWeekStart, "MMM d")} - ${format(nextWeekEnd, "MMM d, yyyy")}`,
      PAGE_WIDTH / 2,
      y + 16,
      { align: "center" }
    );

    y += 35;

    // Calculate weekly totals
    const weekTotals = data.mealPlan.reduce((totals, day) => ({
      calories: totals.calories + day.dailyCalories,
      protein: totals.protein + day.dailyProtein,
      price: totals.price + day.dailyPrice
    }), { calories: 0, protein: 0, price: 0 });

    const avgCalories = Math.round(weekTotals.calories / 7);
    const avgProtein = Math.round(weekTotals.protein / 7);
    const avgCarbs = Math.round(data.mealPlan.reduce((sum, day) => sum + (day.breakfast?.carbs_g || 0) + (day.lunch?.carbs_g || 0) + (day.dinner?.carbs_g || 0), 0) / 7);

    // Enhanced Stats cards - 4 columns
    const statsY = y;
    const cardWidth = (CONTENT_WIDTH - 15) / 4;
    
    const stats = [
      { label: "Avg Calories", value: `${avgCalories}`, unit: "kcal/day", color: COLORS.primary, icon: "KCAL" },
      { label: "Avg Protein", value: `${avgProtein}g`, unit: "per day", color: COLORS.accent, icon: "PROT" },
      { label: "Avg Carbs", value: `${avgCarbs}g`, unit: "per day", color: COLORS.warning, icon: "CARB" },
      { label: "Est. Weekly Cost", value: `QAR ${weekTotals.price.toFixed(0)}`, unit: "total", color: COLORS.success, icon: "COST" },
    ];

    stats.forEach((stat, idx) => {
      const x = MARGIN + idx * (cardWidth + 5);
      this.doc.setFillColor(...COLORS.card);
      this.doc.roundedRect(x, statsY, cardWidth, 45, 6, 6, "F");

      this.doc.setFillColor(...stat.color);
      this.doc.circle(x + 12, statsY + 14, 6, "F");
      
      this.doc.setTextColor(255, 255, 255);
      this.setFontSize(6);
      this.doc.text(stat.icon, x + 8, statsY + 16);
      
      this.doc.setTextColor(...COLORS.textMuted);
      this.setFontSize(6);
      this.doc.text(stat.label, x + 22, statsY + 10);
      
      this.doc.setTextColor(...COLORS.textPrimary);
      this.setFontSize(10);
      this.doc.setFont("helvetica", "bold");
      this.doc.text(stat.value, x + 22, statsY + 24);
      
      this.doc.setTextColor(...COLORS.textMuted);
      this.setFontSize(6);
      this.doc.text(stat.unit, x + 22, statsY + 32);
    });

    y += 55;

    // AI Recommendation Note
    this.doc.setFillColor(...COLORS.background);
    this.doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 30, 6, 6, "F");
    
    this.doc.setFillColor(...COLORS.primary);
    this.doc.roundedRect(MARGIN, y, 4, 30, 2, 2, "F");
    
    this.doc.setTextColor(...COLORS.textPrimary);
    this.setFontSize(9);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("AI-Powered Recommendations", MARGIN + 10, y + 12);
    
    this.doc.setTextColor(...COLORS.textSecondary);
    this.setFontSize(7);
    this.doc.setFont("helvetica", "normal");
    const recLines = this.doc.splitTextToSize(
      `These meals are selected based on your target of ${data.calorieTarget} kcal/day and ${data.proteinTarget}g protein. Each meal is chosen from highly-rated partner restaurants to support your nutrition goals.`,
      CONTENT_WIDTH - 24
    );
    this.doc.text(recLines, MARGIN + 10, y + 22);

    y += 40;

    // Meal plan by day - Detailed view
    this.doc.setTextColor(...COLORS.textPrimary);
    this.setFontSize(10);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Your 7-Day Meal Schedule:", MARGIN, y);
    
    y += 12;

    // Process each day
    data.mealPlan.forEach((day, dayIndex) => {
      // Check if we need a new page
      if (y > 230) {
        this.doc.addPage();
        this.pageNumber++;
        y = 45;
        this.addSectionHeader(dayIndex < 4 ? "10. NEXT WEEK MEAL PLAN (CONT.)" : "10. NEXT WEEK MEAL PLAN (DAYS 5-7)");
        y += 15;
      }

      // Day header
      this.doc.setFillColor(...COLORS.slate);
      this.doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 18, 4, 4, "F");
      
      this.doc.setTextColor(255, 255, 255);
      this.setFontSize(10);
      this.doc.setFont("helvetica", "bold");
      this.doc.text(`${day.day} - ${day.date}`, MARGIN + 8, y + 12);
      
      // Daily totals
      this.setFontSize(8);
      this.doc.text(`${day.dailyCalories} kcal | ${day.dailyProtein}g protein | QAR ${day.dailyPrice.toFixed(0)}`, PAGE_WIDTH - MARGIN - 8, y + 12, { align: "right" });
      
      y += 22;

      // Meals for this day
      const meals = [
        { type: "Breakfast", meal: day.breakfast, icon: "B" },
        { type: "Lunch", meal: day.lunch, icon: "L" },
        { type: "Dinner", meal: day.dinner, icon: "D" }
      ];

      meals.forEach(({ type, meal, icon }) => {
        if (!meal) return;

        // Page break if meal card won't fit (card = 55mm + 5mm spacing)
        if (y + 60 > 275) {
          this.doc.addPage();
          this.pageNumber++;
          y = 25;
          this.addSectionHeader("10. NEXT WEEK MEAL PLAN (CONT.)");
          y = 45;
        }

        // Meal type colors for visual distinction
        const typeColors = {
          "Breakfast": [251, 191, 36] as [number, number, number], // Amber
          "Lunch": [52, 211, 153] as [number, number, number],     // Emerald
          "Dinner": [6, 182, 212] as [number, number, number]      // Cyan
        };
        const typeColor = typeColors[type as keyof typeof typeColors] || COLORS.primary;

        // Meal card - taller to accommodate image
        this.doc.setFillColor(...COLORS.card);
        this.doc.roundedRect(MARGIN + 5, y, CONTENT_WIDTH - 10, 55, 4, 4, "F");
        
        // Image box on the left (32x32mm)
        const imgX = MARGIN + 10;
        const imgY = y + 5;
        const imgSize = 32;
        
        // Try to load actual meal image
        let mealImageBase64 =
          data.mealImages?.get(meal.id) ||
          (typeof meal.image_url === "string" && meal.image_url.startsWith("data:image/")
            ? meal.image_url
            : null);

        let imageRendered = false;
        if (mealImageBase64) {
          try {
            // Strip data URL prefix — jsPDF works better with raw base64
            let rawBase64 = mealImageBase64;
            if (rawBase64.startsWith('data:')) {
              rawBase64 = rawBase64.split(',')[1] || rawBase64;
            }
            this.doc.addImage(
              rawBase64,
              'JPEG',
              imgX,
              imgY,
              imgSize,
              imgSize,
              undefined,
              'FAST'
            );
            imageRendered = true;
          } catch (e) {
            console.warn(`[PDF] addImage failed for ${meal.name}:`, e);
          }
        }
        if (!imageRendered) {
          this.renderMealPlaceholder(imgX, imgY, imgSize, typeColor, icon);
        }
        
        // Meal type label above name with color
        this.doc.setTextColor(...typeColor);
        this.setFontSize(6);
        this.doc.setFont("helvetica", "bold");
        this.doc.text(type.toUpperCase(), MARGIN + 48, y + 10);
        
        // Meal name
        this.doc.setTextColor(...COLORS.textPrimary);
        this.setFontSize(9);
        this.doc.setFont("helvetica", "bold");
        const name = meal.name.length > 30 ? meal.name.substring(0, 27) + "..." : meal.name;
        this.doc.text(name, MARGIN + 48, y + 20);
        
        // Restaurant
        this.doc.setTextColor(...COLORS.textSecondary);
        this.setFontSize(7);
        const restaurant = (meal.restaurant_name || "Partner Restaurant").length > 25 ? 
          (meal.restaurant_name || "Partner Restaurant").substring(0, 22) + "..." : 
          (meal.restaurant_name || "Partner Restaurant");
        this.doc.text(restaurant, MARGIN + 48, y + 30);
        
        // Macros
        const macrosText = `${meal.calories || 0} kcal | P:${meal.protein_g || 0}g C:${meal.carbs_g || 0}g F:${meal.fat_g || 0}g`;
        this.doc.setTextColor(...COLORS.textMuted);
        this.setFontSize(6);
        this.doc.text(macrosText, MARGIN + 48, y + 38);
        
        // Rating on the right side
        const rightX = PAGE_WIDTH - MARGIN - 45;
        
        // Rating
        if (meal.rating) {
          this.doc.setFillColor(...COLORS.warning);
          this.doc.roundedRect(rightX, y + 8, 40, 18, 9, 9, "F");
          this.doc.setTextColor(255, 255, 255);
          this.setFontSize(10);
          this.doc.setFont("helvetica", "bold");
          this.doc.text(`* ${meal.rating.toFixed(1)}`, rightX + 20, y + 20, { align: "center" });
        }
        
        // Dietary tags below rating
        if (meal.is_vegetarian || meal.is_vegan || meal.is_gluten_free) {
          const tags = [];
          if (meal.is_vegan) tags.push("Vegan");
          else if (meal.is_vegetarian) tags.push("Vegetarian");
          if (meal.is_gluten_free) tags.push("GF");
          
          this.doc.setFillColor(...COLORS.accent);
          this.doc.roundedRect(rightX, y + 30, 40, 14, 7, 7, "F");
          this.doc.setTextColor(255, 255, 255);
          this.setFontSize(6);
          this.doc.text(tags.join(" | "), rightX + 20, y + 40, { align: "center" });
        }

        y += 60;
      });

      y += 8; // Space between days
    });

    // Footer note
    y += 10;
    this.doc.setTextColor(...COLORS.textMuted);
    this.setFontSize(7);
    this.doc.setFont("helvetica", "italic");
    const footerLines = this.doc.splitTextToSize(
      "Meal plan curated from highly-rated partner restaurants. All prices and availability subject to change. Images and detailed descriptions available in the Nutrio app.",
      CONTENT_WIDTH
    );
    this.doc.text(footerLines, MARGIN, y);
  }

  private renderMealPlaceholder(
    x: number,
    y: number,
    size: number,
    color: [number, number, number],
    icon: string
  ) {
    // Gradient-like background using multiple rectangles
    // Base color
    this.doc.setFillColor(...color);
    this.doc.roundedRect(x, y, size, size, 3, 3, "F");

    // Lighter overlay for gradient effect (top half)
    const lighterColor = color.map(c => Math.min(255, c + 40)) as [number, number, number];
    this.doc.setFillColor(...lighterColor);
    this.doc.roundedRect(x, y, size, size / 2, 3, 3, "F");

    // White circle overlay for icon
    this.doc.setFillColor(255, 255, 255);
    this.doc.circle(x + size / 2, y + size / 2, 10, "F");

    // Icon text
    this.doc.setTextColor(...color);
    this.setFontSize(12);
    this.doc.setFont("helvetica", "bold");
    this.doc.text(icon, x + size / 2, y + size / 2 + 4, { align: "center" });

    // Add "No Image" text below icon
    this.doc.setTextColor(255, 255, 255);
    this.setFontSize(5);
    this.doc.setFont("helvetica", "normal");
    this.doc.text("No Image", x + size / 2, y + size - 4, { align: "center" });
  }

  private addTrendAnalysis(data: WeeklyReportData) {
    this.doc.addPage();
    this.pageNumber++;
    let y = 45;

    this.addSectionHeader("11. PERFORMANCE TRENDS");

    // Executive Summary
    this.doc.setTextColor(...COLORS.textSecondary);
    this.setFontSize(8);
    this.doc.setFont("helvetica", "normal");
    this.doc.text("Directional analysis of your key nutrition metrics.", MARGIN, y);
    y += 15;

    if (data.daysLogged < 4) {
      this.doc.setFillColor(...COLORS.background);
      this.doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 40, 6, 6, "F");

      this.doc.setFillColor(...COLORS.warning);
      this.doc.roundedRect(MARGIN, y, 4, 40, 2, 2, "F");

      this.doc.setTextColor(...COLORS.textPrimary);
      this.setFontSize(9);
      this.doc.setFont("helvetica", "bold");
      this.doc.text("Insufficient Data", MARGIN + 10, y + 12);

      this.doc.setTextColor(...COLORS.textSecondary);
      this.setFontSize(8);
      this.doc.text("Trend analysis requires at least 4 days of consistent tracking.", MARGIN + 10, y + 25);
      this.doc.text("Continue logging your meals to unlock trend insights.", MARGIN + 10, y + 33);
      return;
    }

    // Trends
    const trends = [
      { label: "Calorie Intake", trend: data.avgCalories > data.calorieTarget ? "Above Target" : data.avgCalories < data.calorieTarget * 0.9 ? "Below Target" : "On Target", color: data.avgCalories > data.calorieTarget ? COLORS.primary : data.avgCalories < data.calorieTarget * 0.9 ? COLORS.warning : COLORS.success },
      { label: "Protein Intake", trend: (data.avgProtein / data.proteinTarget) >= 0.9 ? "Meeting Target" : "Below Target", color: (data.avgProtein / data.proteinTarget) >= 0.9 ? COLORS.success : COLORS.warning },
      { label: "Logging Consistency", trend: data.consistencyScore >= 70 ? "Strong" : data.consistencyScore >= 40 ? "Moderate" : "Needs Attention", color: data.consistencyScore >= 70 ? COLORS.success : data.consistencyScore >= 40 ? COLORS.warning : COLORS.primary },
      { label: "Intake Stability", trend: this.calculateVariance(data.dailyData.map(d => d.calories).filter(c => c > 0)) < 15 ? "Consistent" : "Variable", color: this.calculateVariance(data.dailyData.map(d => d.calories).filter(c => c > 0)) < 15 ? COLORS.success : COLORS.warning },
    ];

    trends.forEach((trend, idx) => {
      const ty = y + idx * 18;
      
      this.doc.setFillColor(...trend.color);
      this.doc.circle(MARGIN + 5, ty - 2, 5, "F");

      this.doc.setTextColor(...COLORS.textPrimary);
      this.setFontSize(9);
      this.doc.setFont("helvetica", "bold");
      this.doc.text(trend.label, MARGIN + 15, ty);

      this.doc.setTextColor(...trend.color);
      this.doc.setFont("helvetica", "bold");
      this.doc.text(trend.trend, MARGIN + 75, ty);
    });

    y += 90;

    // Trend summary
    this.doc.setFillColor(...COLORS.background);
    this.doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 35, 6, 6, "F");

    this.doc.setTextColor(...COLORS.textPrimary);
    this.setFontSize(9);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Trend Summary", MARGIN + 10, y + 12);

    const positiveTrends = trends.filter(t => t.color === COLORS.success).length;
    const trendText = positiveTrends >= 3
      ? `${positiveTrends} of 4 metrics are trending positively. You're building strong habits that support your goals.`
      : positiveTrends >= 2
      ? `2 of 4 metrics are on track. Focus on the areas flagged for improvement to build more consistency.`
      : `Most metrics need attention. Small, daily improvements will create meaningful progress over time.`;

    this.doc.setTextColor(...COLORS.textSecondary);
    this.setFontSize(8);
    this.doc.setFont("helvetica", "normal");
    const lines = this.doc.splitTextToSize(trendText, CONTENT_WIDTH - 24);
    this.doc.text(lines, MARGIN + 10, y + 22);
  }

  private addPredictiveTimeline(data: WeeklyReportData) {
    this.doc.addPage();
    this.pageNumber++;
    let y = 45;

    this.addSectionHeader("12. PROGRESS TIMELINE");

    // Executive Summary
    this.doc.setTextColor(...COLORS.textSecondary);
    this.setFontSize(8);
    this.doc.setFont("helvetica", "normal");
    this.doc.text("Estimated timeline to goal alignment based on current patterns.", MARGIN, y);
    y += 15;

    // Based on section
    this.doc.setTextColor(...COLORS.textPrimary);
    this.setFontSize(9);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Current Metrics:", MARGIN, y);

    y += 10;

    const factors = [
      `Average intake: ${Math.round(data.avgCalories).toLocaleString()} kcal/day`,
      `Selected goal: ${data.activeGoal || 'General Health'}`,
      `Tracking consistency: ${data.consistencyScore}%`,
    ];

    factors.forEach((factor, idx) => {
      this.doc.setTextColor(...COLORS.textSecondary);
      this.setFontSize(8);
      this.doc.text(`- ${factor}`, MARGIN + 5, y + idx * 8);
    });

    y += 40;

    // Estimated Timeline
    this.doc.setFillColor(...COLORS.card);
    this.doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 55, 8, 8, "F");

    this.doc.setTextColor(...COLORS.textPrimary);
    this.setFontSize(11);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Projected Timeline", MARGIN + 10, y + 15);

    if (data.daysLogged >= 4) {
      const weeks = this.calculateTimeline(data);
      const speed = weeks > 12 ? "Gradual" : weeks > 6 ? "Moderate" : "Accelerated";
      
      this.doc.setTextColor(...COLORS.textSecondary);
      this.setFontSize(8);
      this.doc.text("At your current pace:", MARGIN + 10, y + 28);

      this.doc.setTextColor(...COLORS.textPrimary);
      this.setFontSize(14);
      this.doc.setFont("helvetica", "bold");
      this.doc.text(`${weeks} weeks`, MARGIN + 10, y + 42);

      this.doc.setTextColor(...COLORS.textSecondary);
      this.setFontSize(8);
      this.doc.text(`Progress rate: ${speed}`, MARGIN + 10, y + 50);

      // Note about consistency impact
      if (data.consistencyScore < 60) {
        this.doc.setTextColor(...COLORS.warning);
        this.setFontSize(7);
        this.doc.text("* Improving tracking consistency could accelerate this timeline.", MARGIN + 10, y + 58);
      }
    } else {
      this.doc.setFillColor(...COLORS.warning);
      this.doc.roundedRect(MARGIN + 10, y + 20, 4, 20, 2, 2, "F");

      this.doc.setTextColor(...COLORS.textPrimary);
      this.setFontSize(9);
      this.doc.text("More Data Needed", MARGIN + 20, y + 28);

      this.doc.setTextColor(...COLORS.textSecondary);
      this.setFontSize(7);
      this.doc.text("Timeline projections require at least 4 days of tracking data.", MARGIN + 20, y + 36);
      this.doc.text(`You've logged ${data.daysLogged} days so far. Keep tracking to see projections.`, MARGIN + 20, y + 44);
    }
  }

  private addDataAvailabilityStatus(data: WeeklyReportData) {
    this.doc.addPage();
    this.pageNumber++;
    let y = 45;

    this.addSectionHeader("13. DATA COMPLETENESS");

    // Executive Summary
    this.doc.setTextColor(...COLORS.textSecondary);
    this.setFontSize(8);
    this.doc.setFont("helvetica", "normal");
    this.doc.text("Indicates how much tracking data was available for this analysis.", MARGIN, y);
    y += 15;

    this.doc.setFillColor(...COLORS.card);
    this.doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 55, 8, 8, "F");

    let statusText = "";
    let statusColor = COLORS.textSecondary;
    let statusTitle = "";

    if (data.daysLogged < 3) {
      statusTitle = "Limited Dataset";
      statusText = "This report contains preliminary insights based on limited tracking data. For a comprehensive analysis that unlocks personalized recommendations and predictive features, aim to log at least 5 days per week.";
      statusColor = COLORS.warning;
    } else if (data.daysLogged < 6) {
      statusTitle = "Moderate Dataset";
      statusText = "This report provides meaningful insights based on your logged data. For the most accurate analysis and trend detection, continue improving your daily tracking consistency.";
      statusColor = COLORS.accent;
    } else {
      statusTitle = "Complete Dataset";
      statusText = "This report is based on comprehensive tracking data from the week. All analysis features and recommendations are fully activated.";
      statusColor = COLORS.success;
    }

    this.doc.setFillColor(...statusColor);
    this.doc.roundedRect(MARGIN, y, 5, 55, 2, 2, "F");

    this.doc.setTextColor(...COLORS.textPrimary);
    this.setFontSize(10);
    this.doc.setFont("helvetica", "bold");
    this.doc.text(statusTitle, MARGIN + 12, y + 15);

    this.doc.setTextColor(...COLORS.textSecondary);
    this.setFontSize(8);
    this.doc.setFont("helvetica", "normal");
    const lines = this.doc.splitTextToSize(statusText, CONTENT_WIDTH - 28);
    this.doc.text(lines, MARGIN + 12, y + 28);

    // Days logged indicator
    this.doc.setTextColor(...COLORS.textMuted);
    this.setFontSize(7);
    this.doc.text(`Days logged this week: ${data.daysLogged} of 7`, MARGIN + 12, y + 50);
  }

  private addDisclaimer(_data: WeeklyReportData) {
    this.doc.addPage();
    this.pageNumber++;
    let y = 45;

    this.addSectionHeader("14. ABOUT THIS REPORT");

    // Executive Summary
    this.doc.setTextColor(...COLORS.textSecondary);
    this.setFontSize(8);
    this.doc.setFont("helvetica", "normal");
    this.doc.text("Important information about the data and purpose of this report.", MARGIN, y);
    y += 15;

    this.doc.setFillColor(...COLORS.slate);
    this.doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 50, 6, 6, "F");

    this.doc.setTextColor(255, 255, 255);
    this.setFontSize(8);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Purpose & Limitations", MARGIN + 10, y + 12);

    this.doc.setTextColor(255, 255, 255);
    this.setFontSize(7);
    this.doc.setFont("helvetica", "normal");
    
    const disclaimerParagraphs = [
      "This report is generated from your self-reported nutrition tracking data. It is designed for lifestyle performance optimization and habit awareness.",
      "This is not a medical report. It does not provide medical advice, diagnosis, or clinical evaluation. Always consult qualified healthcare professionals for medical guidance."
    ];
    
    this.doc.text(disclaimerParagraphs[0], MARGIN + 10, y + 24, { maxWidth: CONTENT_WIDTH - 20 });
    this.doc.text(disclaimerParagraphs[1], MARGIN + 10, y + 38, { maxWidth: CONTENT_WIDTH - 20 });
  }

  // Helper methods

  private addSectionHeader(title: string) {
    // Header bar with logo + brand + section title
    this.doc.setFillColor(...COLORS.background);
    this.doc.rect(0, 0, PAGE_WIDTH, 18, "F");

    // Small logo circle in header
    if (this.logoBase64) {
      try {
        const raw = this.logoBase64.split(',')[1] || this.logoBase64;
        this.doc.addImage(raw, 'PNG', MARGIN, 3, 12, 12, undefined, 'FAST');
      } catch {
        this.drawTextLogo(MARGIN + 6, 9, 5, false);
      }
    } else {
      this.drawTextLogo(MARGIN + 6, 9, 5, false);
    }

    this.doc.setTextColor(...COLORS.primaryDark);
    this.setFontSize(8);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("NUTRIO FUEL", MARGIN + 15, 11);

    // Top accent line
    this.drawGradientBar(0, 18, PAGE_WIDTH, 1, COLORS.gradientStart, COLORS.gradientEnd);

    // Section title
    this.doc.setTextColor(...COLORS.textPrimary);
    this.setFontSize(12);
    this.doc.setFont("helvetica", "bold");
    this.doc.text(title, MARGIN, 30);

    this.doc.setDrawColor(...COLORS.primary);
    this.doc.setLineWidth(0.8);
    this.doc.line(MARGIN, 33, MARGIN + 40, 33);
  }

  private stampFooter(pageNum: number) {
    const y = 287;

    this.doc.setDrawColor(...COLORS.border);
    this.doc.setLineWidth(0.3);
    this.doc.line(MARGIN, y - 4, PAGE_WIDTH - MARGIN, y - 4);

    this.doc.setTextColor(...COLORS.textMuted);
    this.setFontSize(6.5);
    this.doc.setFont("helvetica", "normal");
    this.doc.text("Nutrio Fuel  |  Nutrition Intelligence Report", MARGIN, y);
    this.doc.text(`${pageNum} / ${this.totalPages}`, PAGE_WIDTH - MARGIN, y, { align: "right" });

    // Bottom accent line
    this.drawGradientBar(0, 293, PAGE_WIDTH, 1, COLORS.gradientStart, COLORS.gradientEnd);
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
      data.consistencyScore * 0.30,
      Math.min(100, Math.round((data.avgCalories / data.calorieTarget) * 100)) * 0.25,
      Math.min(100, Math.round((data.avgProtein / data.proteinTarget) * 100)) * 0.15,
      data.mealQualityScore * 0.10,
      Math.min(100, Math.round((data.waterAverage / 8) * 100)) * 0.10,
      Math.min(100, (data.currentStreak / Math.max(data.bestStreak, 1)) * 100) * 0.10,
    ];
    return Math.round(scores.reduce((a, b) => a + b, 0));
  }

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / squaredDiffs.length;
    return Math.sqrt(avgSquaredDiff) / mean * 100;
  }

  private calculateMomentum(data: WeeklyReportData): number {
    let momentum = 0;
    if (data.consistencyScore > 50) momentum += 2;
    if ((data.avgProtein / data.proteinTarget) > 0.7) momentum += 2;
    if (this.calculateVariance(data.dailyData.map(d => d.calories).filter(c => c > 0)) < 20) momentum += 2;
    if (data.waterAverage > 5) momentum += 2;
    if (data.currentStreak > 3) momentum += 2;
    return momentum - 5;
  }

  private detectHabitRisks(data: WeeklyReportData): string[] {
    const risks: string[] = [];
    
    if (data.daysLogged <= 3) risks.push("Limited tracking: Only " + data.daysLogged + " days logged. Aim for 5+ days for meaningful insights.");
    if (this.calculateVariance(data.dailyData.map(d => d.calories).filter(c => c > 0)) > 25) risks.push("Variable intake: Daily calories fluctuate significantly. Meal planning may help.");
    if ((data.avgProtein / data.proteinTarget) < 0.5) risks.push("Protein gap: Intake at " + Math.round((data.avgProtein / data.proteinTarget) * 100) + "% of target. Consider protein-rich additions.");
    
    const weekendDays = data.dailyData.filter(d => {
      const day = new Date(d.date).getDay();
      return (day === 0 || day === 6) && d.calories > data.calorieTarget * 1.3;
    });
    if (weekendDays.length > 0) risks.push("Weekend pattern: Higher intake detected on weekends. Consider pre-planning.");
    
    return risks;
  }

  private calculateTimeline(data: WeeklyReportData): number {
    const calorieDiff = Math.abs(data.avgCalories - data.calorieTarget);
    const consistency = data.consistencyScore / 100;
    const baseWeeks = calorieDiff > 300 ? 12 : calorieDiff > 100 ? 8 : 4;
    return Math.round(baseWeeks / Math.max(consistency, 0.3));
  }

  private generateQuickInsight(data: WeeklyReportData): string {
    if (data.daysLogged < 3) {
      return "Welcome to your nutrition tracking journey. You've logged " + data.daysLogged + " day" + (data.daysLogged === 1 ? "" : "s") + " this week. To unlock personalized insights and recommendations, aim to track at least 4-5 days consistently.";
    }
    
    const parts: string[] = [];
    
    if (data.consistencyScore >= 80) {
      parts.push(`Strong week: ${data.consistencyScore}% logging consistency demonstrates committed tracking habits.`);
    } else if (data.consistencyScore >= 50) {
      parts.push(`Good progress: You maintained tracking for ${data.daysLogged} days this week.`);
    } else {
      parts.push(`This week you logged ${data.daysLogged} days. Increasing consistency will provide more accurate insights.`);
    }
    
    const calorieDiff = data.avgCalories - data.calorieTarget;
    const calorieAlignment = Math.abs(calorieDiff) / data.calorieTarget;
    if (calorieAlignment < 0.05) {
      parts.push(`Your calorie intake aligned closely with your target.`);
    } else if (calorieDiff > 0) {
      parts.push(`Your intake averaged ${Math.round(calorieDiff)} calories above target.`);
    } else {
      parts.push(`Your intake averaged ${Math.round(Math.abs(calorieDiff))} calories below target.`);
    }
    
    const proteinRatio = data.avgProtein / data.proteinTarget;
    if (proteinRatio >= 0.9) {
      parts.push(`Excellent protein intake at ${Math.round(proteinRatio * 100)}% of your goal.`);
    } else if (proteinRatio < 0.6) {
      parts.push(`Protein intake at ${Math.round(proteinRatio * 100)}% of target. Consider adding protein sources to meals.`);
    }
    
    return parts.join(" ");
  }

  private generateMealRecommendations(data: WeeklyReportData): Array<{ title: string; description: string }> {
    const recs: Array<{ title: string; description: string }> = [];
    
    const proteinRatio = data.avgProtein / data.proteinTarget;
    if (proteinRatio < 0.8) {
      recs.push({
        title: "Add Protein to Every Meal",
        description: "Include a protein source at each meal: eggs at breakfast, chicken or fish at lunch and dinner, Greek yogurt or nuts as snacks."
      });
    }
    
    const calorieDiff = data.avgCalories - data.calorieTarget;
    if (Math.abs(calorieDiff) > 200) {
      recs.push({
        title: "Plan Meals Ahead",
        description: "Spend 10 minutes each evening planning tomorrow's meals. This reduces impulsive choices and helps align intake with your targets."
      });
    }
    
    if (data.consistencyScore < 70) {
      recs.push({
        title: "Establish Logging Rituals",
        description: "Link logging to existing habits: log breakfast while having coffee, lunch right after eating, dinner during evening wind-down."
      });
    }
    
    if (recs.length < 3) {
      recs.push({
        title: "Prep Components on Weekends",
        description: "Prepare versatile ingredients on weekends: grilled chicken, roasted vegetables, cooked grains. Mix and match during the week for quick, balanced meals."
      });
    }
    
    return recs.slice(0, 3);
  }

  async download(data: WeeklyReportData, filename?: string) {
    await this.loadLogo();
    this.doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
    const pdf = this.generate(data);
    const defaultFilename = `nutrio-nutrition-report-${format(new Date(), "yyyy-MM-dd")}.pdf`;
    pdf.save(filename || defaultFilename);
  }

  async getBlob(data: WeeklyReportData): Promise<Blob> {
    await this.loadLogo();
    this.doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
    const pdf = this.generate(data);
    return pdf.output("blob");
  }
}

export const professionalWeeklyReportPDF = new ProfessionalWeeklyReportPDF();
