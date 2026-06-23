import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

// ═══════════════════════════════════════════════════
//  WARM & ORGANIC DESIGN SYSTEM — Nutrio Wellness Report
//  Aesthetic: personal wellness journal with earth tones,
//  sage greens, rounded cards, and soft organic touches.
// ═══════════════════════════════════════════════════

/* ─── Color Palette ─── */
const C = {
  // Base
  cream:      [252, 250, 245] as [number, number, number],
  paper:      [255, 253, 250] as [number, number, number],
  warmWhite:  [255, 255, 252] as [number, number, number],

  // Greens (Nutrio brand anchor)
  sage:       [122, 163, 117] as [number, number, number],
  sageDeep:   [82,  121, 79]  as [number, number, number],
  sageLight:  [180, 210, 176] as [number, number, number],
  olive:      [133, 147, 102] as [number, number, number],
  mint:       [200, 227, 196] as [number, number, number],

  // Warm earth tones
  terracotta: [198, 120, 86]  as [number, number, number],
  clay:       [180, 108, 76]  as [number, number, number],
  honey:      [212, 175, 55]  as [number, number, number],
  amber:      [230, 162, 60]  as [number, number, number],

  // Brown text palette
  espresso:   [58,  45,  35]  as [number, number, number],
  mocha:      [102, 82,  64]  as [number, number, number],
  latte:      [160, 140, 118] as [number, number, number],

  // Semantic
  success:    [122, 163, 117] as [number, number, number],
  warning:    [212, 175, 55]  as [number, number, number],
  caution:    [230, 162, 60]  as [number, number, number],
  soft:       [198, 120, 86]  as [number, number, number],
} as const;

/* ─── Layout Constants ─── */
const MARGIN = 18;
const PAGE_W = 210;
const CONTENT_W = PAGE_W - MARGIN * 2;
const CARD_RADIUS = 6;

/* ─── Typography Scale ─── */
const T = {
  hero:    28,
  h1:      22,
  h2:      16,
  h3:      13,
  body:    9.5,
  small:   8,
  tiny:    7,
  micro:   6,
} as const;

// ═══════════════════════════════════════════════════
//  DATA INTERFACES (preserved from original)
// ═══════════════════════════════════════════════════

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
  mealImages?: Map<string, string>;
  trackerInsights?: {
    dailySteps: Array<{ date: string; steps: number }>;
    dailyWater: Array<{ date: string; waterMl: number }>;
    weightHistory: Array<{ date: string; weight_kg: number | null }>;
    bmi: number | null;
    bmiLabel: string | null;
    heightCm: number | null;
    stepGoal: number;
    waterTargetMl: number;
  };
  healthReadiness?: {
    readinessScore: number | null;
    bodyLoad: number;
    avgReadiness: number | null;
    highLoadDays: number;
    sleepMinutes: number | null;
    recoveryPlan: string;
    foodTip: string;
  };
}

// ═══════════════════════════════════════════════════
//  PDF GENERATOR CLASS
// ═══════════════════════════════════════════════════

export class ProfessionalWeeklyReportPDF {
  private doc: jsPDF;
  private pageNumber = 1;
  private totalPages = 0;
  private logoBase64: string | null = null;

  constructor() {
    this.doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  }

  // ─── Logo Loading ───
  private async loadLogo(): Promise<void> {
    try {
      const response = await fetch("/logo.png");
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
      // Logo not available
    }
  }

  // ═══════════════════════════════════════════════════
  //  DESIGN PRIMITIVES — reusable visual helpers
  // ═══════════════════════════════════════════════════

  /** Draw a warm card: rounded rect with soft border + optional left accent bar */
  private card(x: number, y: number, w: number, h: number, accent?: [number, number, number]) {
    // Card body
    this.doc.setFillColor(...C.paper);
    this.doc.setDrawColor(...C.latte);
    this.doc.setLineWidth(0.3);
    this.doc.roundedRect(x, y, w, h, CARD_RADIUS, CARD_RADIUS, "FD");

    // Colored left accent bar
    if (accent) {
      this.doc.setFillColor(...accent);
      this.doc.roundedRect(x, y + 4, 3.5, h - 8, 2, 2, "F");
    }
  }

  /** Draw a section header with number badge + title */
  private sectionHeader(number: string, title: string, y: number) {
    // Number badge in sage circle
    this.doc.setFillColor(...C.sage);
    this.doc.circle(MARGIN + 9, y + 6, 9, "F");
    this.doc.setTextColor(...C.cream);
    this.doc.setFontSize(10);
    this.doc.setFont("helvetica", "bold");
    this.doc.text(number, MARGIN + 9, y + 10, { align: "center" });

    // Title
    this.doc.setTextColor(...C.espresso);
    this.doc.setFontSize(T.h2);
    this.doc.setFont("helvetica", "bold");
    this.doc.text(title, MARGIN + 22, y + 10);

    // Soft underline in mint
    this.doc.setDrawColor(...C.mint);
    this.doc.setLineWidth(1.2);
    this.doc.line(MARGIN + 22, y + 14, MARGIN + 22 + 50, y + 14);
  }

  /** Draw a progress ring (donut chart) */
  private progressRing(cx: number, cy: number, r: number, pct: number, color: [number, number, number]) {
    const strokeW = 4;
    const trackR = r - strokeW / 2;

    // Track
    this.doc.setDrawColor(...C.mint);
    this.doc.setLineWidth(strokeW);
    this.doc.circle(cx, cy, trackR, "S");

    // Filled arc — approximate with many small segments
    this.doc.setDrawColor(...color);
    this.doc.setLineWidth(strokeW);
    const segments = 36;
    const arcPct = Math.min(1, Math.max(0, pct / 100));
    const startAngle = -90;
    for (let i = 0; i < segments * arcPct; i++) {
      const a1 = (startAngle + (i / segments) * 360) * Math.PI / 180;
      const a2 = (startAngle + ((i + 1) / segments) * 360) * Math.PI / 180;
      const x1 = cx + trackR * Math.cos(a1);
      const y1 = cy + trackR * Math.sin(a1);
      const x2 = cx + trackR * Math.cos(a2);
      const y2 = cy + trackR * Math.sin(a2);
      this.doc.line(x1, y1, x2, y2);
    }
  }

  /** Draw a horizontal progress bar */
  private progressBar(x: number, y: number, w: number, h: number, pct: number, color: [number, number, number]) {
    const p = Math.min(100, Math.max(0, pct));
    // Track
    this.doc.setFillColor(...C.mint);
    this.doc.roundedRect(x, y, w, h, h / 2, h / 2, "F");
    // Fill
    if (p > 0) {
      this.doc.setFillColor(...color);
      this.doc.roundedRect(x, y, w * (p / 100), h, h / 2, h / 2, "F");
    }
  }

  /** Draw a vertical mini bar for chart use */
  private miniBar(x: number, baseY: number, val: number, max: number, h: number, w: number, color: [number, number, number]) {
    const barH = max > 0 ? (val / max) * h : 0;
    const y = baseY - barH;
    this.doc.setFillColor(...color);
    this.doc.roundedRect(x, y, w, barH, 1.5, 1.5, "F");
  }

  /** Draw a stat badge (small colored pill) */
  private statBadge(x: number, y: number, label: string, color: [number, number, number]) {
    this.doc.setFillColor(...color);
    this.doc.roundedRect(x, y, 36, 14, 7, 7, "F");
    this.doc.setTextColor(...C.cream);
    this.doc.setFontSize(T.tiny);
    this.doc.setFont("helvetica", "bold");
    this.doc.text(label, x + 18, y + 10, { align: "center" });
  }

  private insightBox(x: number, y: number, w: number, title: string, body: string, accent: [number, number, number]) {
    this.doc.setFontSize(T.small);
    this.doc.setFont("helvetica", "normal");
    const bodyLines = this.doc.splitTextToSize(body, w - 24);
    const bodyH = Math.max(12, bodyLines.length * 8 + 4);
    const cardH = 18 + bodyH;
    this.card(x, y, w, cardH, accent);
    this.doc.setTextColor(...C.espresso);
    this.doc.setFontSize(T.body);
    this.doc.setFont("helvetica", "bold");
    this.doc.text(title, x + 12, y + 10);
    this.doc.setTextColor(...C.mocha);
    this.doc.setFontSize(T.small);
    this.doc.setFont("helvetica", "normal");
    this.doc.text(bodyLines, x + 12, y + 20);
    return cardH;
  }

  /** Draw a decorative leaf dot cluster */
  private leafCluster(x: number, y: number) {
    const dots = [
      [0, 0, C.sageDeep],
      [4, -2, C.sage],
      [7, 1, C.mint],
      [3, 5, C.sageLight],
    ];
    for (const [dx, dy, c] of dots) {
      this.doc.setFillColor(...c);
      this.doc.circle(x + dx, y + dy, 1.8, "F");
    }
  }

  /** Stamp footer on each page */
  private stampFooter(pageNum: number) {
    const y = 288;
    this.doc.setDrawColor(...C.mint);
    this.doc.setLineWidth(0.4);
    this.doc.line(MARGIN, y - 4, PAGE_W - MARGIN, y - 4);

    this.doc.setTextColor(...C.latte);
    this.doc.setFontSize(T.micro);
    this.doc.setFont("helvetica", "normal");
    this.doc.text("Nutrio  ·  Wellness Report", MARGIN, y);
    this.doc.text(`${pageNum} / ${this.totalPages}`, PAGE_W - MARGIN, y, { align: "right" });

    this.leafCluster(PAGE_W / 2, y);
  }

  // ═══════════════════════════════════════════════════
  //  MAIN GENERATION FLOW
  // ═══════════════════════════════════════════════════

  generate(data: WeeklyReportData): jsPDF {
    this.pageNumber = 1;

    this.addCoverPage(data);
    this.addWellnessScore(data);
    this.addWeeklySnapshot(data);
    this.addEatingRhythm(data);
    this.addMomentum(data);
    this.addHabitCheckin(data);
    this.addCalorieAlignment(data);
    this.addMacroBalance(data);
    this.addHydration(data);
    this.addPersonalizedTips(data);
    this.addMealPlan(data);
    this.addTrends(data);
    this.addLookingAhead(data);
    this.addDataNotes(data);

    this.totalPages = this.pageNumber;

    // Stamp footers on every page except cover
    for (let p = 2; p <= this.totalPages; p++) {
      this.doc.setPage(p);
      this.stampFooter(p);
    }

    return this.doc;
  }

  // ═══════════════════════════════════════════════════
  //  COVER PAGE
  // ═══════════════════════════════════════════════════

  private addCoverPage(data: WeeklyReportData) {
    // Full-bleed warm cream background
    this.doc.setFillColor(...C.cream);
    this.doc.rect(0, 0, PAGE_W, 297, "F");

    // Top organic accent — layered green bands
    this.doc.setFillColor(...C.sageDeep);
    this.doc.rect(0, 0, PAGE_W, 60, "F");
    this.doc.setFillColor(...C.sage);
    this.doc.rect(0, 60, PAGE_W, 80, "F");
    this.doc.setFillColor(...C.sageLight);
    this.doc.rect(0, 140, PAGE_W, 65, "F");

    // Decorative dot pattern overlay on green area
    for (let i = 0; i < 15; i++) {
      const dx = 20 + (i * 40) % 180;
      const dy = 15 + Math.floor(i / 5) * 35;
      this.leafCluster(dx, dy);
    }

    // Logo area
    const logoY = 28;
    if (this.logoBase64) {
      try {
        const raw = this.logoBase64.split(",")[1] || this.logoBase64;
        this.doc.addImage(raw, "PNG", PAGE_W / 2 - 20, logoY, 40, 40, undefined, "FAST");
      } catch {
        this.drawTextLogo(PAGE_W / 2, logoY + 20, 22);
      }
    } else {
      this.drawTextLogo(PAGE_W / 2, logoY + 20, 22);
    }

    this.doc.setTextColor(...C.cream);
    this.doc.setFontSize(14);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Nutrio", PAGE_W / 2, logoY + 42, { align: "center" });

    this.doc.setFontSize(T.hero);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Your Wellness", PAGE_W / 2, 110, { align: "center" });
    this.doc.text("Journal", PAGE_W / 2, 125, { align: "center" });

    const score = this.calcOverallScore(data);
    const scoreCY = 148.5;
    this.doc.setFillColor(...C.terracotta);
    this.doc.circle(PAGE_W / 2, scoreCY, 28, "F");
    this.doc.setFillColor(...C.clay);
    this.doc.circle(PAGE_W / 2, scoreCY, 23, "F");
    this.doc.setTextColor(...C.cream);
    this.doc.setFontSize(24);
    this.doc.setFont("helvetica", "bold");
    this.doc.text(`${score}`, PAGE_W / 2, scoreCY + 8, { align: "center" });

    const label = score >= 80 ? "Excellent" : score >= 60 ? "Good" : score >= 40 ? "Steady" : "Beginning";
    this.doc.setFontSize(T.tiny);
    this.doc.setTextColor(...C.cream);
    this.doc.text(label.toUpperCase(), PAGE_W / 2, scoreCY + 18, { align: "center" });

    this.doc.setFontSize(T.body);
    this.doc.setFont("helvetica", "normal");
    this.doc.setTextColor(...C.cream);
    this.doc.text("Weekly Nutrition Report", PAGE_W / 2, 185, { align: "center" });

    // Date range on card
    const dateRange = `${format(new Date(data.weekStart), "MMM d")} – ${format(new Date(data.weekEnd), "MMM d, yyyy")}`;
    this.doc.setFillColor(255, 255, 255, 0.25);
    this.doc.roundedRect(PAGE_W / 2 - 55, 194, 110, 18, 9, 9, "F");
    this.doc.setTextColor(...C.cream);
    this.doc.setFontSize(T.small);
    this.doc.setFont("helvetica", "bold");
    this.doc.text(dateRange, PAGE_W / 2, 206, { align: "center" });

    // User card on cream area
    this.card(PAGE_W / 2 - 60, 228, 120, 40, C.sage);
    this.doc.setTextColor(...C.espresso);
    this.doc.setFontSize(T.h3);
    this.doc.setFont("helvetica", "bold");
    this.doc.text(data.userName, PAGE_W / 2, 252, { align: "center" });
    this.doc.setTextColor(...C.mocha);
    this.doc.setFontSize(T.tiny);
    this.doc.setFont("helvetica", "normal");
    this.doc.text(data.userEmail, PAGE_W / 2, 262, { align: "center" });

    // Generated date
    this.doc.setTextColor(...C.latte);
    this.doc.setFontSize(T.micro);
    this.doc.text(`Generated ${format(new Date(), "MMMM d, yyyy")}`, PAGE_W / 2, 290, { align: "center" });
  }

  private drawTextLogo(cx: number, cy: number, r: number) {
    this.doc.setFillColor(...C.cream);
    this.doc.circle(cx, cy, r, "F");
    this.doc.setTextColor(...C.sageDeep);
    this.doc.setFontSize(r * 1.2);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("N", cx, cy + r * 0.35, { align: "center" });
  }

  // ═══════════════════════════════════════════════════
  //  1. WELLNESS SCORE
  // ═══════════════════════════════════════════════════

  private addWellnessScore(data: WeeklyReportData) {
    this.doc.addPage();
    this.pageNumber++;
    let y = 30;

    this.sectionHeader("1", "Wellness Score", y);
    y += 25;

    const score = this.calcOverallScore(data);
    const label = score >= 80 ? "Thriving" : score >= 60 ? "Balanced" : score >= 40 ? "Building" : "Starting";

    // Score display card
    this.card(MARGIN, y, CONTENT_W, 52, C.sage);

    // Score ring
    this.progressRing(MARGIN + 35, y + 26, 20, score, C.sage);
    this.doc.setTextColor(...C.espresso);
    this.doc.setFontSize(20);
    this.doc.setFont("helvetica", "bold");
    this.doc.text(`${score}`, MARGIN + 35, y + 30, { align: "center" });

    this.doc.setTextColor(...C.espresso);
    this.doc.setFontSize(T.h3);
    this.doc.setFont("helvetica", "bold");
    this.doc.text(`Wellness Score: ${score}/100`, MARGIN + 55, y + 18);

    this.statBadge(MARGIN + 55, y + 23, label, C.sage);

    this.doc.setTextColor(...C.mocha);
    this.doc.setFontSize(T.small);
    this.doc.setFont("helvetica", "normal");
    this.doc.text("Your overall wellness combines tracking consistency,", MARGIN + 55, y + 42);
    this.doc.text("nutrition alignment, and healthy habits.", MARGIN + 55, y + 50);

    y += 62;

    // Score breakdown
    this.doc.setTextColor(...C.espresso);
    this.doc.setFontSize(T.body);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("What makes up your score", MARGIN, y);
    y += 10;

    const breakdown = [
      { label: "Tracking consistency",  pct: data.consistencyScore, color: C.sage },
      { label: "Calorie alignment",     pct: Math.min(100, Math.round((data.avgCalories / data.calorieTarget) * 100)), color: C.olive },
      { label: "Protein target",        pct: Math.min(100, Math.round((data.avgProtein / data.proteinTarget) * 100)), color: C.sage },
      { label: "Meal quality",          pct: data.mealQualityScore, color: C.terracotta },
      { label: "Hydration",             pct: Math.min(100, Math.round((data.waterAverage / 8) * 100)), color: C.honey },
      { label: "Streak momentum",       pct: Math.min(100, (data.currentStreak / Math.max(data.bestStreak, 1)) * 100), color: C.amber },
    ];

    for (const item of breakdown) {
      this.doc.setTextColor(...C.mocha);
      this.doc.setFontSize(T.small);
      this.doc.setFont("helvetica", "normal");
      this.doc.text(item.label, MARGIN + 5, y + 5);

      this.progressBar(MARGIN + 80, y, 65, 6, item.pct, item.color);

      this.doc.setTextColor(...C.espresso);
      this.doc.setFontSize(T.tiny);
      this.doc.setFont("helvetica", "bold");
      this.doc.text(`${item.pct}%`, MARGIN + 150, y + 5);

      y += 14;
    }
  }

  // ═══════════════════════════════════════════════════
  //  2. WEEKLY SNAPSHOT
  // ═══════════════════════════════════════════════════

  private addWeeklySnapshot(data: WeeklyReportData) {
    this.doc.addPage();
    this.pageNumber++;
    let y = 30;

    this.sectionHeader("2", "Weekly Snapshot", y);
    y += 25;

    this.doc.setTextColor(...C.mocha);
    this.doc.setFontSize(T.small);
    this.doc.setFont("helvetica", "normal");
    this.doc.text("Your week in numbers.", MARGIN, y);
    y += 12;

    // 2×2 metric grid
    const metrics = [
      { label: "Days Tracked",   value: `${data.daysLogged} / 7`,      sub: "meals logged",    color: C.sage, icon: "✿" },
      { label: "Avg Calories",   value: `${Math.round(data.avgCalories)}`, sub: `target ${data.calorieTarget} kcal`, color: C.terracotta, icon: "◆" },
      { label: "Avg Protein",    value: `${Math.round(data.avgProtein)}g`, sub: `target ${data.proteinTarget}g`, color: C.olive, icon: "●" },
      { label: "Water Days",     value: `${data.dailyData.filter(d => d.water > 0).length} / 7`, sub: "hydration tracked", color: C.honey, icon: "♦" },
    ];

    const cardW = (CONTENT_W - 10) / 2;
    for (let i = 0; i < metrics.length; i++) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const cx = MARGIN + col * (cardW + 10);
      const cy = y + row * 38;

      this.card(cx, cy, cardW, 32, metrics[i].color);

      this.doc.setTextColor(...C.mocha);
      this.doc.setFontSize(T.tiny);
      this.doc.setFont("helvetica", "normal");
      this.doc.text(metrics[i].label, cx + 12, cy + 9);

      this.doc.setTextColor(...C.espresso);
      this.doc.setFontSize(T.h3);
      this.doc.setFont("helvetica", "bold");
      this.doc.text(metrics[i].value, cx + 12, cy + 21);

      this.doc.setTextColor(...C.latte);
      this.doc.setFontSize(T.micro);
      this.doc.text(metrics[i].sub, cx + 12, cy + 29);
    }

    y += 82;

    // Quick insight
    const insight = this.generateQuickInsight(data);
    this.insightBox(MARGIN, y, CONTENT_W, "This week's reflection", insight, C.sage);
  }

  // ═══════════════════════════════════════════════════
  //  3. EATING RHYTHM
  // ═══════════════════════════════════════════════════

  private addEatingRhythm(data: WeeklyReportData) {
    this.doc.addPage();
    this.pageNumber++;
    let y = 30;

    this.sectionHeader("3", "Eating Rhythm", y);
    y += 25;

    this.doc.setTextColor(...C.mocha);
    this.doc.setFontSize(T.small);
    this.doc.setFont("helvetica", "normal");
    this.doc.text("How steady was your daily intake this week?", MARGIN, y);
    y += 15;

    const variance = this.calcVariance(data.dailyData.map(d => d.calories).filter(c => c > 0));
    const level = variance < 10 ? "Steady" : variance < 20 ? "Gentle waves" : "Rolling hills";
    const rhythmColor = variance < 10 ? C.sage : variance < 20 ? C.amber : C.terracotta;

    // Rhythm card
    this.card(MARGIN, y, CONTENT_W, 48, rhythmColor);

    this.doc.setFillColor(...rhythmColor);
    this.doc.circle(MARGIN + 30, y + 24, 16, "F");
    this.doc.setTextColor(...C.cream);
    this.doc.setFontSize(11);
    this.doc.setFont("helvetica", "bold");
    this.doc.text(level, MARGIN + 30, y + 29, { align: "center" });

    this.doc.setTextColor(...C.espresso);
    this.doc.setFontSize(T.h3);
    this.doc.setFont("helvetica", "bold");
    this.doc.text(`Eating Rhythm: ${level}`, MARGIN + 55, y + 16);

    this.doc.setTextColor(...C.mocha);
    this.doc.setFontSize(T.small);
    this.doc.setFont("helvetica", "normal");
    this.doc.text(`Daily calorie variance: ${Math.round(variance)}%`, MARGIN + 55, y + 28);

    y += 58;

    // Daily calorie mini chart
    this.doc.setTextColor(...C.espresso);
    this.doc.setFontSize(T.body);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Your daily calorie rhythm", MARGIN, y);
    y += 12;

    const loggedDays = data.dailyData.filter(d => d.calories > 0);
    const maxCal = Math.max(...loggedDays.map(d => d.calories), data.calorieTarget, 1);
    const chartH = 50;
    const barW = Math.min(16, (CONTENT_W - 10) / loggedDays.length - 4);
    const barGap = (CONTENT_W - loggedDays.length * barW) / (loggedDays.length + 1);

    // Target line
    const targetY = y + chartH - (data.calorieTarget / maxCal) * chartH;
    this.doc.setDrawColor(...C.terracotta);
    this.doc.setLineDashPattern([3, 3], 0);
    this.doc.line(MARGIN, targetY, MARGIN + CONTENT_W, targetY);
    this.doc.setLineDashPattern([], 0);
    this.doc.setTextColor(...C.terracotta);
    this.doc.setFontSize(T.micro);
    this.doc.text("target", MARGIN + CONTENT_W - 16, targetY - 2);

    loggedDays.forEach((d, i) => {
      const bx = MARGIN + barGap + i * (barW + barGap);
      const barColor = d.calories >= data.calorieTarget * 0.9 && d.calories <= data.calorieTarget * 1.1
        ? C.sage : d.calories > data.calorieTarget ? C.amber : C.terracotta;
      this.miniBar(bx, y + chartH, d.calories, maxCal, chartH, barW, barColor);

      const dayLabel = format(new Date(d.date), "EEE");
      this.doc.setTextColor(...C.latte);
      this.doc.setFontSize(T.micro);
      this.doc.setFont("helvetica", "normal");
      this.doc.text(dayLabel, bx + barW / 2, y + chartH + 6, { align: "center" });
    });

    y += chartH + 16;

    // Rhythm insight
    const rhythmInsight = level === "Steady"
      ? "Your intake stayed consistent day-to-day — a sign of a well-established routine. This steady rhythm supports reliable energy and progress."
      : level === "Gentle waves"
      ? "Your intake had some natural variation. A bit of flexibility is healthy — the key is keeping the overall average close to your target."
      : "Your intake varied quite a bit this week. Consider checking in with yourself before meals — small adjustments can smooth out the highs and lows.";

    this.insightBox(MARGIN, y, CONTENT_W, "What this means", rhythmInsight, rhythmColor);
  }

  // ═══════════════════════════════════════════════════
  //  4. MOMENTUM
  // ═══════════════════════════════════════════════════

  private addMomentum(data: WeeklyReportData) {
    this.doc.addPage();
    this.pageNumber++;
    let y = 30;

    this.sectionHeader("4", "Your Momentum", y);
    y += 25;

    this.doc.setTextColor(...C.mocha);
    this.doc.setFontSize(T.small);
    this.doc.setFont("helvetica", "normal");
    this.doc.text("Are your habits trending in the right direction?", MARGIN, y);
    y += 15;

    const momentum = this.calcMomentum(data);
    const mStatus = momentum > 2 ? "Building" : momentum < -2 ? "Recalibrating" : "Holding steady";
    const mColor = momentum > 2 ? C.sage : momentum < -2 ? C.terracotta : C.amber;

    // Momentum card
    this.card(MARGIN, y, CONTENT_W, 48, mColor);

    this.doc.setFillColor(...mColor);
    this.doc.circle(MARGIN + 30, y + 24, 16, "F");
    this.doc.setTextColor(...C.cream);
    this.doc.setFontSize(14);
    this.doc.setFont("helvetica", "bold");
    this.doc.text(momentum > 0 ? `+${momentum}` : `${momentum}`, MARGIN + 30, y + 29, { align: "center" });

    this.doc.setTextColor(...C.espresso);
    this.doc.setFontSize(T.h3);
    this.doc.setFont("helvetica", "bold");
    this.doc.text(`Momentum: ${mStatus}`, MARGIN + 55, y + 18);

    this.statBadge(MARGIN + 55, y + 23, mStatus, mColor);

    y += 58;

    // Contributing factors
    const factors = momentum > 2
      ? ["Consistent tracking habits", "Protein intake near target", "Stable daily intake pattern", "Regular hydration logging", "Active streak building momentum"]
      : momentum < -2
      ? ["Tracking frequency below optimal", "Protein below target range", "Higher day-to-day variation", "Hydration gaps detected", "Streak needs attention"]
      : ["Habits holding at baseline", "Some areas improving, others stable", "Foundation for growth in place", "Room for small improvements", "Steady state maintained"];

    this.doc.setTextColor(...C.espresso);
    this.doc.setFontSize(T.body);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("What's contributing", MARGIN, y);
    y += 10;

    for (const f of factors) {
      this.doc.setTextColor(...C.mocha);
      this.doc.setFontSize(T.small);
      this.doc.text(`·  ${f}`, MARGIN + 5, y);
      y += 9;
    }

    y += 5;

    const mInsight = mStatus === "Building"
      ? "Your habits are gathering strength. The consistency you're building creates compounding benefits — each day builds on the last."
      : mStatus === "Recalibrating"
      ? "Momentum has slowed — this is a normal part of any journey. Small daily intentions can gently rebuild your rhythm."
      : "You're holding steady. This stable foundation is valuable. From here, even tiny adjustments can create forward movement.";

    this.insightBox(MARGIN, y, CONTENT_W, "Reflection", mInsight, mColor);
  }

  // ═══════════════════════════════════════════════════
  //  5. HABIT CHECK-IN
  // ═══════════════════════════════════════════════════

  private addHabitCheckin(data: WeeklyReportData) {
    this.doc.addPage();
    this.pageNumber++;
    let y = 30;

    this.sectionHeader("5", "Habit Check-in", y);
    y += 25;

    this.doc.setTextColor(...C.mocha);
    this.doc.setFontSize(T.small);
    this.doc.setFont("helvetica", "normal");
    this.doc.text("Patterns we noticed this week.", MARGIN, y);
    y += 15;

    const risks = this.detectHabitRisks(data);
    const riskLevel = risks.length === 0 ? "Smooth sailing" : risks.length <= 2 ? "A few bumps" : "Some turbulence";
    const riskColor = risks.length === 0 ? C.sage : risks.length <= 2 ? C.amber : C.terracotta;

    // Risk level card
    this.card(MARGIN, y, CONTENT_W, 50, riskColor);

    this.doc.setFillColor(...riskColor);
    this.doc.roundedRect(MARGIN, y, 70, 50, CARD_RADIUS, CARD_RADIUS, "F");
    this.doc.setTextColor(...C.cream);
    this.doc.setFontSize(T.body);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Pattern Level:", MARGIN + 10, y + 14);
    this.doc.setFontSize(T.h3);
    this.doc.text(riskLevel, MARGIN + 10, y + 30);

    this.doc.setTextColor(...C.mocha);
    this.doc.setFontSize(T.tiny);
    this.doc.setFont("helvetica", "normal");
    const monitors = ["Tracking frequency", "Intake variance", "Protein gaps", "Weekend patterns", "Missed days"];
    monitors.forEach((m, i) => {
      this.doc.text(`· ${m}`, MARGIN + 82, y + 16 + i * 7);
    });

    y += 60;

    // Patterns found
    if (risks.length > 0) {
      this.card(MARGIN, y, CONTENT_W, 22 + risks.length * 10, C.terracotta);
      this.doc.setTextColor(...C.espresso);
      this.doc.setFontSize(T.body);
      this.doc.setFont("helvetica", "bold");
      this.doc.text("What we noticed:", MARGIN + 12, y + 12);

      risks.forEach((r, i) => {
        this.doc.setTextColor(...C.mocha);
        this.doc.setFontSize(T.small);
        this.doc.text(`·  ${r}`, MARGIN + 12, y + 22 + i * 10);
      });
      y += 32 + risks.length * 10;
    } else {
      y += 5;
    }

    this.doc.setTextColor(...C.latte);
    this.doc.setFontSize(T.micro);
    this.doc.setFont("helvetica", "italic");
    this.doc.text("This looks at your tracking and intake patterns — not a medical assessment.", MARGIN, y);
  }

  // ═══════════════════════════════════════════════════
  //  6. CALORIE ALIGNMENT
  // ═══════════════════════════════════════════════════

  private addCalorieAlignment(data: WeeklyReportData) {
    this.doc.addPage();
    this.pageNumber++;
    let y = 30;

    this.sectionHeader("6", "Calorie Alignment", y);
    y += 25;

    this.doc.setTextColor(...C.mocha);
    this.doc.setFontSize(T.small);
    this.doc.setFont("helvetica", "normal");
    this.doc.text("How your intake compares to your daily target.", MARGIN, y);
    y += 15;

    const diff = data.avgCalories - data.calorieTarget;
    const alignment = Math.abs(diff) < 100 ? "Aligned" : diff > 0 ? "Above target" : "Below target";
    const alignColor = Math.abs(diff) < 100 ? C.sage : diff > 0 ? C.amber : C.terracotta;

    // Stats card
    this.card(MARGIN, y, CONTENT_W, 62, alignColor);

    const stats = [
      { label: "Your daily target", value: `${data.calorieTarget.toLocaleString()} kcal` },
      { label: "Weekly average",    value: `${Math.round(data.avgCalories).toLocaleString()} kcal` },
      { label: "Difference",         value: `${diff > 0 ? "+" : ""}${Math.round(diff).toLocaleString()} kcal` },
    ];

    stats.forEach((s, i) => {
      const sy = y + 14 + i * 16;
      this.doc.setTextColor(...C.mocha);
      this.doc.setFontSize(T.small);
      this.doc.setFont("helvetica", "normal");
      this.doc.text(s.label, MARGIN + 12, sy);
      this.doc.setTextColor(...C.espresso);
      this.doc.setFontSize(T.body);
      this.doc.setFont("helvetica", "bold");
      this.doc.text(s.value, MARGIN + 65, sy);
    });

    this.statBadge(MARGIN + 130, y + 10, alignment, alignColor);

    const variance = this.calcVariance(data.dailyData.map(d => d.calories).filter(c => c > 0));
    const stability = variance < 10 ? "Steady" : variance < 20 ? "Moderate" : "Variable";
    this.doc.setTextColor(...C.mocha);
    this.doc.setFontSize(T.tiny);
    this.doc.setFont("helvetica", "normal");
    this.doc.text(`Daily consistency: ${stability}`, MARGIN + 12, y + 56);

    y += 72;

    // Low intake caution
    if (data.avgCalories < 1200 && data.daysLogged >= 3) {
      this.insightBox(MARGIN, y, CONTENT_W, "A gentle note",
        "Your recorded intake is below typical ranges. Make sure you're logging all meals and snacks. If this reflects actual consumption, consider checking in with a nutrition professional to support your goals safely.",
        C.terracotta);
    }
  }

  // ═══════════════════════════════════════════════════
  //  7. MACRO BALANCE
  // ═══════════════════════════════════════════════════

  private addMacroBalance(data: WeeklyReportData) {
    this.doc.addPage();
    this.pageNumber++;
    let y = 30;

    this.sectionHeader("7", "Macro Balance", y);
    y += 25;

    this.doc.setTextColor(...C.mocha);
    this.doc.setFontSize(T.small);
    this.doc.setFont("helvetica", "normal");
    this.doc.text("Your protein, carbs, and fat breakdown.", MARGIN, y);
    y += 15;

    // Macro table
    autoTable(this.doc, {
      startY: y,
      head: [["Nutrient", "Daily avg", "Your target", "Progress"]],
      body: [
        ["Protein", `${Math.round(data.avgProtein)}g`, `${data.proteinTarget}g`, `${Math.round((data.avgProtein / data.proteinTarget) * 100)}%`],
        ["Carbs", `${Math.round(data.avgCarbs)}g`, `${data.carbsTarget}g`, `${Math.round((data.avgCarbs / data.carbsTarget) * 100)}%`],
        ["Fat", `${Math.round(data.avgFat)}g`, `${data.fatTarget}g`, `${Math.round((data.avgFat / data.fatTarget) * 100)}%`],
      ],
      headStyles: { fillColor: C.sage, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
      bodyStyles: { fontSize: 9, textColor: C.espresso },
      alternateRowStyles: { fillColor: C.cream },
      margin: { left: MARGIN, right: MARGIN },
    });

    y += 55;

    // Calorie distribution
    const totalMacroCals = data.avgProtein * 4 + data.avgCarbs * 4 + data.avgFat * 9;
    const pPct = totalMacroCals > 0 ? Math.round((data.avgProtein * 4 / totalMacroCals) * 100) : 0;
    const cPct = totalMacroCals > 0 ? Math.round((data.avgCarbs * 4 / totalMacroCals) * 100) : 0;
    const fPct = 100 - pPct - cPct;

    this.doc.setTextColor(...C.espresso);
    this.doc.setFontSize(T.body);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Your calorie mix", MARGIN, y);
    y += 10;

    const distribution = [
      { label: "Protein", pct: pPct, color: C.sage, note: "4 cal per gram" },
      { label: "Carbs",    pct: cPct, color: C.olive, note: "4 cal per gram" },
      { label: "Fat",      pct: fPct, color: C.terracotta, note: "9 cal per gram" },
    ];

    for (const d of distribution) {
      this.doc.setFillColor(...d.color);
      this.doc.circle(MARGIN + 5, y + 2, 4, "F");
      this.doc.setTextColor(...C.espresso);
      this.doc.setFontSize(T.small);
      this.doc.setFont("helvetica", "bold");
      this.doc.text(`${d.label}: ${d.pct}%`, MARGIN + 15, y + 6);
      this.doc.setTextColor(...C.latte);
      this.doc.setFontSize(T.micro);
      this.doc.setFont("helvetica", "normal");
      this.doc.text(d.note, MARGIN + 15, y + 11);
      y += 16;
    }

    y += 5;

    const macroInsight = `Your calorie mix is ${pPct}% protein, ${cPct}% carbs, and ${fPct}% fat. Protein alignment is ${(data.avgProtein / data.proteinTarget * 100) >= 90 ? "strong" : "an area with room to grow"}.`;
    this.insightBox(MARGIN, y, CONTENT_W, "At a glance", macroInsight, C.sage);
  }

  // ═══════════════════════════════════════════════════
  //  8. HYDRATION
  // ═══════════════════════════════════════════════════

  private addHydration(data: WeeklyReportData) {
    this.doc.addPage();
    this.pageNumber++;
    let y = 30;

    this.sectionHeader("8", "Hydration", y);
    y += 25;

    this.doc.setTextColor(...C.mocha);
    this.doc.setFontSize(T.small);
    this.doc.setFont("helvetica", "normal");
    this.doc.text("Your water tracking for the week.", MARGIN, y);
    y += 15;

    const daysTracked = data.dailyData.filter(d => d.water > 0).length;

    // 3 stat cards
    const cardW = (CONTENT_W - 10) / 3;
    const statCards = [
      { label: "Days logged", value: `${daysTracked} / 7`, sub: "of 7 days", color: C.sage },
      { label: "Daily average", value: `${data.waterAverage.toFixed(1)}`, sub: "glasses per day", color: C.honey },
      { label: "Daily target", value: "8", sub: "glasses per day", color: C.terracotta },
    ];

    for (let i = 0; i < 3; i++) {
      const cx = MARGIN + i * (cardW + 5);
      this.card(cx, y, cardW, 38, statCards[i].color);
      this.doc.setTextColor(...C.mocha);
      this.doc.setFontSize(T.tiny);
      this.doc.setFont("helvetica", "normal");
      this.doc.text(statCards[i].label, cx + 12, y + 10);
      this.doc.setTextColor(...C.espresso);
      this.doc.setFontSize(T.h3);
      this.doc.setFont("helvetica", "bold");
      this.doc.text(statCards[i].value, cx + 12, y + 23);
      this.doc.setTextColor(...C.latte);
      this.doc.setFontSize(T.micro);
      this.doc.text(statCards[i].sub, cx + 12, y + 32);
    }

    y += 48;

    const hInsight = data.waterAverage >= 6
      ? `You're averaging ${data.waterAverage.toFixed(1)} glasses per day — great consistency. Good hydration supports energy, focus, and overall wellness.`
      : data.waterAverage >= 4
      ? `Averaging ${data.waterAverage.toFixed(1)} glasses per day. There's room to edge closer to the 8-glass target for optimal hydration.`
      : `Averaging ${data.waterAverage.toFixed(1)} glasses per day. Try keeping a water bottle nearby as a gentle reminder to sip throughout the day.`;

    this.insightBox(MARGIN, y, CONTENT_W, "Hydration note", hInsight, C.honey);
  }

  // ═══════════════════════════════════════════════════
  //  9. PERSONALIZED TIPS
  // ═══════════════════════════════════════════════════

  private addPersonalizedTips(data: WeeklyReportData) {
    this.doc.addPage();
    this.pageNumber++;
    let y = 30;

    this.sectionHeader("9", "Personalized Tips", y);
    y += 25;

    this.doc.setTextColor(...C.mocha);
    this.doc.setFontSize(T.small);
    this.doc.setFont("helvetica", "normal");
    this.doc.text("Suggestions based on your patterns.", MARGIN, y);
    y += 15;

    const recs = this.generateMealRecs(data);

    recs.forEach((rec, i) => {
      this.card(MARGIN, y, CONTENT_W, 32, C.sage);
      this.doc.setFillColor(...C.sage);
      this.doc.roundedRect(MARGIN, y, 22, 32, CARD_RADIUS, CARD_RADIUS, "F");
      this.doc.setTextColor(...C.cream);
      this.doc.setFontSize(T.body);
      this.doc.setFont("helvetica", "bold");
      this.doc.text(`${i + 1}`, MARGIN + 11, y + 21, { align: "center" });

      this.doc.setTextColor(...C.espresso);
      this.doc.setFontSize(T.body);
      this.doc.setFont("helvetica", "bold");
      this.doc.text(rec.title, MARGIN + 30, y + 12);
      this.doc.setTextColor(...C.mocha);
      this.doc.setFontSize(T.tiny);
      this.doc.setFont("helvetica", "normal");
      const descLines = this.doc.splitTextToSize(rec.description, CONTENT_W - 48);
      this.doc.text(descLines, MARGIN + 30, y + 20);

      y += 38;
    });

    y += 5;
    this.doc.setTextColor(...C.latte);
    this.doc.setFontSize(T.micro);
    this.doc.setFont("helvetica", "italic");
    this.doc.text("These suggestions are generated from your personal patterns to support your goals.", MARGIN, y);
  }

  // ═══════════════════════════════════════════════════
  //  10. MEAL PLAN
  // ═══════════════════════════════════════════════════

  private addMealPlan(data: WeeklyReportData) {
    this.doc.addPage();
    this.pageNumber++;
    let y = 30;

    this.sectionHeader("10", "Your Meal Plan", y);
    y += 25;

    this.doc.setTextColor(...C.mocha);
    this.doc.setFontSize(T.small);
    this.doc.setFont("helvetica", "normal");
    this.doc.text("Meal suggestions for the week ahead.", MARGIN, y);
    y += 15;

    if (!data.mealPlan || data.mealPlan.length === 0) {
      this.card(MARGIN, y, CONTENT_W, 42, C.sage);
      this.doc.setTextColor(...C.espresso);
      this.doc.setFontSize(T.body);
      this.doc.setFont("helvetica", "bold");
      this.doc.text("Generate your personalized meal plan", MARGIN + 12, y + 12);
      this.doc.setTextColor(...C.mocha);
      this.doc.setFontSize(T.small);
      this.doc.setFont("helvetica", "normal");
      const info = this.doc.splitTextToSize(
        "Our AI analyzes your nutrition targets, preferences, and favorite restaurants to create a 7-day meal plan. Each suggestion helps you meet your goals while enjoying meals from partner restaurants.",
        CONTENT_W - 24
      );
      this.doc.text(info, MARGIN + 12, y + 24);
      this.doc.setTextColor(...C.sageDeep);
      this.doc.text("Visit the Nutrio app to create your plan.", MARGIN + 12, y + 36);
      return;
    }

    // Week totals
    const totals = data.mealPlan.reduce((t, day) => ({
      cal: t.cal + day.dailyCalories,
      prot: t.prot + day.dailyProtein,
      meals: t.meals + [day.breakfast, day.lunch, day.dinner, day.snack].filter(Boolean).length,
    }), { cal: 0, prot: 0, meals: 0 });

    const cardW2 = (CONTENT_W - 15) / 4;
    const statCards2 = [
      { label: "Avg Calories", value: `${Math.round(totals.cal / 7)}`, unit: "kcal/day", color: C.sage },
      { label: "Avg Protein",  value: `${Math.round(totals.prot / 7)}g`, unit: "per day", color: C.olive },
      { label: "Avg Carbs",    value: `${Math.round(data.mealPlan.reduce((s, d) => s + (d.breakfast?.carbs_g || 0) + (d.lunch?.carbs_g || 0) + (d.dinner?.carbs_g || 0), 0) / 7)}g`, unit: "per day", color: C.honey },
      { label: "Meals",        value: `${totals.meals}`, unit: "planned", color: C.terracotta },
    ];

    for (let i = 0; i < 4; i++) {
      const cx = MARGIN + i * (cardW2 + 5);
      this.card(cx, y, cardW2, 38, statCards2[i].color);
      this.doc.setTextColor(...C.mocha);
      this.doc.setFontSize(T.tiny);
      this.doc.setFont("helvetica", "normal");
      this.doc.text(statCards2[i].label, cx + 10, y + 9);
      this.doc.setTextColor(...C.espresso);
      this.doc.setFontSize(T.body);
      this.doc.setFont("helvetica", "bold");
      this.doc.text(statCards2[i].value, cx + 10, y + 22);
      this.doc.setTextColor(...C.latte);
      this.doc.setFontSize(T.micro);
      this.doc.text(statCards2[i].unit, cx + 10, y + 31);
    }

    y += 48;

    // Each day
    for (const day of data.mealPlan) {
      if (y > 230) {
        this.doc.addPage();
        this.pageNumber++;
        y = 30;
        this.sectionHeader("10", "Meal Plan (continued)", y);
        y += 25;
      }

      // Day header
      this.doc.setFillColor(...C.sage);
      this.doc.roundedRect(MARGIN, y, CONTENT_W, 16, 4, 4, "F");
      this.doc.setTextColor(...C.cream);
      this.doc.setFontSize(T.body);
      this.doc.setFont("helvetica", "bold");
      this.doc.text(`${day.day} — ${day.date}`, MARGIN + 8, y + 11);
      this.doc.setFontSize(T.tiny);
      this.doc.text(`${day.dailyCalories} kcal | ${day.dailyProtein}g protein`, PAGE_W - MARGIN - 8, y + 11, { align: "right" });

      y += 22;

      const meals = [
        { type: "Breakfast", meal: day.breakfast, color: C.honey as [number, number, number] },
        { type: "Lunch",     meal: day.lunch,     color: C.sage as [number, number, number] },
        { type: "Dinner",    meal: day.dinner,    color: C.terracotta as [number, number, number] },
      ];

      for (const { type, meal, color } of meals) {
        if (!meal) continue;
        if (y + 44 > 275) {
          this.doc.addPage();
          this.pageNumber++;
          y = 30;
        }

        this.card(MARGIN + 5, y, CONTENT_W - 10, 40, color);

        this.doc.setFillColor(...color);
        this.doc.roundedRect(MARGIN + 5, y, 3.5, 40, 2, 2, "F");

        this.doc.setTextColor(...color);
        this.doc.setFontSize(T.micro);
        this.doc.setFont("helvetica", "bold");
        this.doc.text(type.toUpperCase(), MARGIN + 14, y + 8);

        this.doc.setTextColor(...C.espresso);
        this.doc.setFontSize(T.small);
        this.doc.setFont("helvetica", "bold");
        const name = meal.name.length > 28 ? meal.name.substring(0, 25) + "…" : meal.name;
        this.doc.text(name, MARGIN + 14, y + 17);

        this.doc.setTextColor(...C.mocha);
        this.doc.setFontSize(T.tiny);
        this.doc.setFont("helvetica", "normal");
        this.doc.text(meal.restaurant_name || "Partner Restaurant", MARGIN + 14, y + 24);

        this.doc.setTextColor(...C.latte);
        this.doc.setFontSize(T.micro);
        this.doc.text(`${meal.calories || 0} kcal | P:${meal.protein_g || 0}g C:${meal.carbs_g || 0}g F:${meal.fat_g || 0}g`, MARGIN + 14, y + 31);

        // Meal image if available
        const imgBase64 = data.mealImages?.get(meal.id)
          || (typeof meal.image_url === "string" && meal.image_url.startsWith("data:image/") ? meal.image_url : null);

        if (imgBase64) {
          try {
            let raw = imgBase64;
            if (raw.startsWith("data:")) raw = raw.split(",")[1] || raw;
            this.doc.addImage(raw, "JPEG", PAGE_W - MARGIN - 42, y + 4, 32, 32, undefined, "FAST");
          } catch { /* skip image */ }
        }

        if (meal.rating) {
          this.doc.setFillColor(...C.honey);
          this.doc.roundedRect(PAGE_W - MARGIN - 40, y + 28, 32, 10, 5, 5, "F");
          this.doc.setTextColor(...C.cream);
          this.doc.setFontSize(T.micro);
          this.doc.setFont("helvetica", "bold");
          this.doc.text(`★ ${meal.rating.toFixed(1)}`, PAGE_W - MARGIN - 24, y + 35, { align: "center" });
        }

        y += 46;
      }

      y += 6;
    }

    y += 5;
    this.doc.setTextColor(...C.latte);
    this.doc.setFontSize(T.micro);
    this.doc.setFont("helvetica", "italic");
    this.doc.text("Meals curated from partner restaurants. Availability is subject to change.", MARGIN, y);
  }

  // ═══════════════════════════════════════════════════
  //  11. TRENDS
  // ═══════════════════════════════════════════════════

  private addTrends(data: WeeklyReportData) {
    this.doc.addPage();
    this.pageNumber++;
    let y = 30;

    this.sectionHeader("11", "Your Trends", y);
    y += 25;

    this.doc.setTextColor(...C.mocha);
    this.doc.setFontSize(T.small);
    this.doc.setFont("helvetica", "normal");
    this.doc.text("Direction of your key metrics.", MARGIN, y);
    y += 15;

    if (data.daysLogged < 4) {
      this.insightBox(MARGIN, y, CONTENT_W, "Not enough data yet",
        `Trend analysis needs at least 4 days of tracking. You've logged ${data.daysLogged} day${data.daysLogged === 1 ? "" : "s"} this week — keep going to unlock trend insights.`,
        C.amber);
      return;
    }

    const trends = [
      { label: "Calorie Intake", trend: data.avgCalories > data.calorieTarget ? "Above target" : data.avgCalories < data.calorieTarget * 0.9 ? "Below target" : "On target", color: data.avgCalories > data.calorieTarget ? C.amber : data.avgCalories < data.calorieTarget * 0.9 ? C.terracotta : C.sage },
      { label: "Protein Intake", trend: (data.avgProtein / data.proteinTarget) >= 0.9 ? "Meeting target" : "Below target", color: (data.avgProtein / data.proteinTarget) >= 0.9 ? C.sage : C.amber },
      { label: "Consistency", trend: data.consistencyScore >= 70 ? "Strong" : data.consistencyScore >= 40 ? "Moderate" : "Growing", color: data.consistencyScore >= 70 ? C.sage : data.consistencyScore >= 40 ? C.amber : C.terracotta },
      { label: "Intake Stability", trend: this.calcVariance(data.dailyData.map(d => d.calories).filter(c => c > 0)) < 15 ? "Consistent" : "Variable", color: this.calcVariance(data.dailyData.map(d => d.calories).filter(c => c > 0)) < 15 ? C.sage : C.amber },
    ];

    for (const t of trends) {
      this.doc.setFillColor(...t.color);
      this.doc.circle(MARGIN + 6, y + 6, 5, "F");
      this.doc.setTextColor(...C.espresso);
      this.doc.setFontSize(T.small);
      this.doc.setFont("helvetica", "bold");
      this.doc.text(t.label, MARGIN + 16, y + 9);
      this.statBadge(MARGIN + 100, y + 2, t.trend, t.color);
      y += 22;
    }

    y += 10;

    const posCount = trends.filter(t => t.color === C.sage).length;
    const tInsight = posCount >= 3
      ? `${posCount} of 4 metrics are trending well. Your habits are building a strong foundation.`
      : posCount >= 2
      ? `${posCount} of 4 are on track. Focus on the areas with room to grow — small steps add up.`
      : "Most metrics show room for growth. Each day is a fresh opportunity to build momentum.";

    this.insightBox(MARGIN, y, CONTENT_W, "Trend summary", tInsight, C.sage);
  }

  // ═══════════════════════════════════════════════════
  //  12. LOOKING AHEAD
  // ═══════════════════════════════════════════════════

  private addLookingAhead(data: WeeklyReportData) {
    this.doc.addPage();
    this.pageNumber++;
    let y = 30;

    this.sectionHeader("12", "Looking Ahead", y);
    y += 25;

    this.doc.setTextColor(...C.mocha);
    this.doc.setFontSize(T.small);
    this.doc.setFont("helvetica", "normal");
    this.doc.text("Projected timeline based on your current pace.", MARGIN, y);
    y += 15;

    // Current metrics
    this.doc.setTextColor(...C.espresso);
    this.doc.setFontSize(T.body);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Current metrics", MARGIN, y);
    y += 8;

    const factors = [
      `Average intake: ${Math.round(data.avgCalories).toLocaleString()} kcal/day`,
      `Goal: ${data.activeGoal || "General wellness"}`,
      `Consistency: ${data.consistencyScore}%`,
    ];
    for (const f of factors) {
      this.doc.setTextColor(...C.mocha);
      this.doc.setFontSize(T.small);
      this.doc.text(`·  ${f}`, MARGIN + 5, y);
      y += 8;
    }

    y += 10;

    if (data.daysLogged >= 4) {
      const weeks = this.calcTimeline(data);
      const speed = weeks > 12 ? "Gradual" : weeks > 6 ? "Moderate" : "Steady";

      this.card(MARGIN, y, CONTENT_W, 44, C.sage);

      this.doc.setTextColor(...C.mocha);
      this.doc.setFontSize(T.small);
      this.doc.setFont("helvetica", "normal");
      this.doc.text("At your current pace", MARGIN + 12, y + 12);

      this.doc.setTextColor(...C.espresso);
      this.doc.setFontSize(26);
      this.doc.setFont("helvetica", "bold");
      this.doc.text(`${weeks} weeks`, MARGIN + 12, y + 32);

      this.statBadge(MARGIN + 80, y + 16, `Progress: ${speed}`, C.sage);

      if (data.consistencyScore < 60) {
        this.doc.setTextColor(...C.terracotta);
        this.doc.setFontSize(T.micro);
        this.doc.setFont("helvetica", "italic");
        this.doc.text("Better tracking consistency could speed up this timeline.", MARGIN + 12, y + 40);
      }
    } else {
      this.insightBox(MARGIN, y, CONTENT_W, "More data needed",
        `Timeline projections need at least 4 days of tracking. You've logged ${data.daysLogged} day${data.daysLogged === 1 ? "" : "s"} — keep tracking to see your projected timeline.`,
        C.amber);
    }
  }

  // ═══════════════════════════════════════════════════
  //  13. DATA NOTES
  // ═══════════════════════════════════════════════════

  private addDataNotes(data: WeeklyReportData) {
    this.doc.addPage();
    this.pageNumber++;
    let y = 30;

    this.sectionHeader("13", "About This Report", y);
    y += 30;

    // Data completeness
    let title: string, text: string, color: [number, number, number];
    if (data.daysLogged < 3) {
      title = "Limited data"; text = "This report has preliminary insights based on limited tracking. Try logging at least 5 days for a fuller picture.";
      color = C.terracotta;
    } else if (data.daysLogged < 6) {
      title = "Good coverage"; text = "This report provides meaningful insights. More consistent tracking will unlock deeper analysis.";
      color = C.amber;
    } else {
      title = "Full picture"; text = "This report draws from comprehensive tracking data. All analysis features are fully active.";
      color = C.sage;
    }

    this.card(MARGIN, y, CONTENT_W, 48, color);
    this.doc.setTextColor(...C.espresso);
    this.doc.setFontSize(T.h3);
    this.doc.setFont("helvetica", "bold");
    this.doc.text(`Data completeness: ${title}`, MARGIN + 12, y + 14);
    this.doc.setTextColor(...C.mocha);
    this.doc.setFontSize(T.small);
    this.doc.setFont("helvetica", "normal");
    const lines = this.doc.splitTextToSize(text, CONTENT_W - 24);
    this.doc.text(lines, MARGIN + 12, y + 26);
    this.doc.setTextColor(...C.latte);
    this.doc.setFontSize(T.micro);
    this.doc.text(`Days logged: ${data.daysLogged} of 7`, MARGIN + 12, y + 42);

    y += 58;

    // Disclaimer
    this.card(MARGIN, y, CONTENT_W, 50, C.sage);
    this.doc.setTextColor(...C.espresso);
    this.doc.setFontSize(T.body);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Purpose & Notes", MARGIN + 12, y + 12);

    this.doc.setTextColor(...C.mocha);
    this.doc.setFontSize(T.small);
    this.doc.setFont("helvetica", "normal");
    const d1 = this.doc.splitTextToSize(
      "This report is generated from your self-reported nutrition tracking data for lifestyle awareness and habit building.",
      CONTENT_W - 24
    );
    this.doc.text(d1, MARGIN + 12, y + 24);

    const d2 = this.doc.splitTextToSize(
      "This is not medical advice. Always consult qualified healthcare professionals for medical guidance. Nutrio helps you understand your patterns — your health decisions are yours.",
      CONTENT_W - 24
    );
    this.doc.text(d2, MARGIN + 12, y + 36);
  }

  // ═══════════════════════════════════════════════════
  //  CALCULATION HELPERS
  // ═══════════════════════════════════════════════════

  private calcOverallScore(data: WeeklyReportData): number {
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

  private calcVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / squaredDiffs.length) / mean * 100;
  }

  private calcMomentum(data: WeeklyReportData): number {
    let m = 0;
    if (data.consistencyScore > 50) m += 2;
    if ((data.avgProtein / data.proteinTarget) > 0.7) m += 2;
    if (this.calcVariance(data.dailyData.map(d => d.calories).filter(c => c > 0)) < 20) m += 2;
    if (data.waterAverage > 5) m += 2;
    if (data.currentStreak > 3) m += 2;
    return m - 5;
  }

  private detectHabitRisks(data: WeeklyReportData): string[] {
    const r: string[] = [];
    if (data.daysLogged <= 3) r.push(`Only ${data.daysLogged} days tracked — aim for 5+ for meaningful insights`);
    if (this.calcVariance(data.dailyData.map(d => d.calories).filter(c => c > 0)) > 25) r.push("Daily calories fluctuate quite a bit — meal planning may help smooth things out");
    if ((data.avgProtein / data.proteinTarget) < 0.5) r.push(`Protein at ${Math.round((data.avgProtein / data.proteinTarget) * 100)}% of target — consider adding protein-rich foods`);
    const weekendHigh = data.dailyData.filter(d => {
      const day = new Date(d.date).getDay();
      return (day === 0 || day === 6) && d.calories > data.calorieTarget * 1.3;
    });
    if (weekendHigh.length > 0) r.push("Higher intake on weekends — pre-planning weekend meals could help");
    return r;
  }

  private calcTimeline(data: WeeklyReportData): number {
    const diff = Math.abs(data.avgCalories - data.calorieTarget);
    const c = data.consistencyScore / 100;
    const base = diff > 300 ? 12 : diff > 100 ? 8 : 4;
    return Math.round(base / Math.max(c, 0.3));
  }

  private generateQuickInsight(data: WeeklyReportData): string {
    if (data.daysLogged < 3) return `You've logged ${data.daysLogged} day${data.daysLogged === 1 ? "" : "s"} this week. Keep tracking to unlock personalized insights and a fuller picture of your wellness.`;

    const parts: string[] = [];
    if (data.consistencyScore >= 80) parts.push(`${data.consistencyScore}% tracking consistency shows real dedication.`);
    else if (data.consistencyScore >= 50) parts.push(`You tracked ${data.daysLogged} days — a solid foundation to build on.`);
    else parts.push(`You logged ${data.daysLogged} days. Even small increases in consistency bring richer insights.`);

    const diff = data.avgCalories - data.calorieTarget;
    if (Math.abs(diff) < 50) parts.push("Your calorie intake aligned beautifully with your target.");
    else if (diff > 0) parts.push(`Intake averaged ${Math.round(diff)} calories above target.`);
    else parts.push(`Intake averaged ${Math.round(Math.abs(diff))} calories below target.`);

    const pr = data.avgProtein / data.proteinTarget;
    if (pr >= 0.9) parts.push(`Protein at ${Math.round(pr * 100)}% of goal — nicely done.`);
    else if (pr < 0.6) parts.push(`Protein at ${Math.round(pr * 100)}% of target — there's room to grow here.`);

    return parts.join(" ");
  }

  private generateMealRecs(data: WeeklyReportData): Array<{ title: string; description: string }> {
    const recs: Array<{ title: string; description: string }> = [];
    if ((data.avgProtein / data.proteinTarget) < 0.8) {
      recs.push({ title: "Add protein to each meal", description: "Try eggs at breakfast, chicken or fish at lunch and dinner, Greek yogurt or nuts for snacks — small additions make a difference." });
    }
    if (Math.abs(data.avgCalories - data.calorieTarget) > 200) {
      recs.push({ title: "Plan tomorrow tonight", description: "Spend a few minutes each evening planning the next day's meals. This gentle habit reduces impulsive choices and helps you stay aligned." });
    }
    if (data.consistencyScore < 70) {
      recs.push({ title: "Anchor logging to routines", description: "Link meal logging to something you already do: log breakfast with coffee, lunch right after eating, dinner during evening wind-down." });
    }
    if (recs.length < 3) {
      recs.push({ title: "Prep once, eat all week", description: "Prepare a few versatile ingredients on the weekend — grilled chicken, roasted vegetables, cooked grains — then mix and match during the week." });
    }
    return recs.slice(0, 3);
  }

  // ═══════════════════════════════════════════════════
  //  PUBLIC API
  // ═══════════════════════════════════════════════════

  async download(data: WeeklyReportData, filename?: string) {
    await this.loadLogo();
    this.doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
    this.generate(data);
    const defaultName = `nutrio-wellness-journal-${format(new Date(), "yyyy-MM-dd")}.pdf`;
    this.doc.save(filename || defaultName);
  }

  async getBlob(data: WeeklyReportData): Promise<Blob> {
    await this.loadLogo();
    this.doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
    this.generate(data);
    return this.doc.output("blob");
  }
}

export const professionalWeeklyReportPDF = new ProfessionalWeeklyReportPDF();
