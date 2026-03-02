import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

// App Color Scheme (from index.css)
const APP_COLORS = {
  // Primary - Vibrant Green: hsl(142 71% 45%)
  primary: [46, 204, 113] as [number, number, number],
  primaryDark: [39, 174, 96] as [number, number, number],
  
  // Accent - Teal: hsl(168 76% 42%)
  accent: [26, 188, 156] as [number, number, number],
  
  // Warning - Orange: hsl(38 92% 50%)
  warning: [243, 156, 18] as [number, number, number],
  
  // Background & Text
  background: [250, 250, 250] as [number, number, number],
  muted: [245, 245, 245] as [number, number, number],
  border: [224, 224, 224] as [number, number, number],
  text: [60, 60, 60] as [number, number, number],
  textLight: [120, 120, 120] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
};

// Comprehensive Weekly Report PDF Generator
export interface WeeklyReportData {
  userName: string;
  userEmail: string;
  reportDate: string;
  weekStart: string;
  weekEnd: string;
  
  // Weight Data
  currentWeight: number | null;
  weightChange: number | null;
  weightGoal: number | null;
  weightProgress: number;
  
  // Nutrition Summary
  avgCalories: number;
  calorieTarget: number;
  calorieProgress: number;
  avgProtein: number;
  proteinTarget: number;
  avgCarbs: number;
  carbsTarget: number;
  avgFat: number;
  fatTarget: number;
  
  // Daily Breakdown
  dailyData: Array<{
    date: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    weight: number | null;
    water: number;
  }>;
  
  // Performance Metrics
  consistencyScore: number;
  daysLogged: number;
  totalDays: number;
  mealQualityScore: number;
  waterAverage: number;
  
  // Streaks
  currentStreak: number;
  bestStreak: number;
  
  // Goals
  activeGoal: string | null;
  goalProgress: number;
  
  // Milestones
  milestonesAchieved: number;
  totalMilestones: number;
  
  // Insights & Recommendations
  insights: string[];
  recommendations: string[];
  
  // Comparisons
  vsLastWeek: {
    calories: number;
    weight: number;
    consistency: number;
  };
}

export class WeeklyReportPDFGenerator {
  private doc: jsPDF;
  private colors = APP_COLORS;
  private logoBase64: string | null = null;
  
  constructor() {
    this.doc = new jsPDF();
    this.loadLogo();
  }

  private async loadLogo() {
    // Try to load the logo from the public folder
    try {
      const response = await fetch('/logo.png');
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        this.logoBase64 = reader.result as string;
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      console.log('Logo not found, will use text-based logo');
    }
  }

  generate(data: WeeklyReportData): jsPDF {
    this.addHeader(data);
    this.addExecutiveSummary(data);
    this.addWeightSection(data);
    this.addNutritionSection(data);
    this.addDailyBreakdown(data);
    this.addPerformanceMetrics(data);
    this.addStreaksAndGoals(data);
    this.addInsightsAndRecommendations(data);
    this.addFooter();
    
    return this.doc;
  }

  private addHeader(data: WeeklyReportData) {
    // Header background with gradient effect
    this.doc.setFillColor(...this.colors.primary);
    this.doc.rect(0, 0, 210, 50, "F");
    
    // Add subtle gradient effect with lighter color
    this.doc.setFillColor(...this.colors.accent);
    this.doc.rect(0, 50, 210, 5, "F");
    
    // Logo area
    if (this.logoBase64) {
      try {
        this.doc.addImage(this.logoBase64, 'PNG', 15, 10, 25, 25);
      } catch (e) {
        // Fallback to text logo
        this.addTextLogo();
      }
    } else {
      this.addTextLogo();
    }
    
    // App name
    this.doc.setTextColor(...this.colors.white);
    this.doc.setFontSize(24);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Nutrio", this.logoBase64 ? 45 : 20, 28);
    
    this.doc.setFontSize(12);
    this.doc.setFont("helvetica", "normal");
    this.doc.text("Weekly Progress Report", this.logoBase64 ? 45 : 20, 38);
    
    // Report Info - Right side
    this.doc.setFontSize(9);
    this.doc.text(`Prepared for: ${data.userName}`, 140, 18);
    this.doc.text(`Email: ${data.userEmail}`, 140, 26);
    this.doc.text(`Week: ${format(new Date(data.weekStart), "MMM d")} - ${format(new Date(data.weekEnd), "MMM d, yyyy")}`, 140, 34);
    this.doc.text(`Generated: ${format(new Date(), "MMM d, yyyy")}`, 140, 42);
    
    // Decorative line with accent color
    this.doc.setDrawColor(...this.colors.accent);
    this.doc.setLineWidth(1);
    this.doc.line(20, 60, 190, 60);
  }

  private addTextLogo() {
    // Create a simple text-based logo/icon
    this.doc.setFillColor(...this.colors.white);
    this.doc.roundedRect(15, 10, 20, 20, 3, 3, "F");
    this.doc.setTextColor(...this.colors.primary);
    this.doc.setFontSize(14);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("N", 25, 24, { align: "center" });
  }

  private addExecutiveSummary(data: WeeklyReportData) {
    this.doc.setFontSize(16);
    this.doc.setFont("helvetica", "bold");
    this.doc.setTextColor(...this.colors.primary);
    this.doc.text("Executive Summary", 20, 75);
    
    // Overall Score Circle with primary color
    const overallScore = this.calculateOverallScore(data);
    this.doc.setFillColor(...this.colors.primary);
    this.doc.circle(35, 95, 18, "F");
    
    // Score border with accent
    this.doc.setDrawColor(...this.colors.accent);
    this.doc.setLineWidth(2);
    this.doc.circle(35, 95, 18, "S");
    
    this.doc.setTextColor(...this.colors.white);
    this.doc.setFontSize(22);
    this.doc.setFont("helvetica", "bold");
    this.doc.text(`${overallScore}`, 35, 100, { align: "center" });
    this.doc.setFontSize(8);
    this.doc.text("Overall Score", 35, 107, { align: "center" });
    
    // Key Metrics Grid
    this.doc.setTextColor(...this.colors.text);
    this.doc.setFontSize(10);
    const metrics = [
      { label: "Avg Calories", value: `${Math.round(data.avgCalories)} / ${data.calorieTarget}` },
      { label: "Days Logged", value: `${data.daysLogged} / ${data.totalDays}` },
      { label: "Consistency", value: `${data.consistencyScore}%` },
      { label: "Meal Quality", value: `${data.mealQualityScore}/100` },
      { label: "Current Streak", value: `${data.currentStreak} days` },
      { label: "Water Avg", value: `${Math.round(data.waterAverage)} glasses` },
    ];
    
    let y = 90;
    let x = 60;
    metrics.forEach((metric, index) => {
      if (index % 2 === 0 && index > 0) {
        y += 14;
        x = 60;
      }
      this.doc.setFont("helvetica", "bold");
      this.doc.setTextColor(...this.colors.primary);
      this.doc.text(metric.value, x, y);
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(8);
      this.doc.setTextColor(...this.colors.textLight);
      this.doc.text(metric.label, x, y + 4);
      this.doc.setFontSize(10);
      this.doc.setTextColor(...this.colors.text);
      x += 70;
    });
    
    // Summary text
    this.doc.setFontSize(10);
    this.doc.setFont("helvetica", "normal");
    this.doc.setTextColor(...this.colors.textLight);
    const summaryText = this.generateSummaryText(data);
    const splitSummary = this.doc.splitTextToSize(summaryText, 170);
    this.doc.text(splitSummary, 20, 130);
  }

  private addWeightSection(data: WeeklyReportData) {
    if (!data.currentWeight) return;
    
    this.doc.addPage();
    this.doc.setFontSize(18);
    this.doc.setFont("helvetica", "bold");
    this.doc.setTextColor(...this.colors.primary);
    this.doc.text("Weight Progress", 20, 30);
    
    // Weight Card with muted background
    this.doc.setFillColor(...this.colors.muted);
    this.doc.roundedRect(20, 40, 170, 60, 5, 5, "F");
    
    this.doc.setTextColor(...this.colors.text);
    this.doc.setFontSize(12);
    this.doc.setFont("helvetica", "normal");
    this.doc.text("Current Weight", 30, 55);
    
    this.doc.setFontSize(28);
    this.doc.setFont("helvetica", "bold");
    this.doc.setTextColor(...this.colors.primary);
    this.doc.text(`${data.currentWeight} kg`, 30, 75);
    
    // Weight change indicator
    if (data.weightChange !== null) {
      const isPositive = data.weightChange > 0;
      this.doc.setTextColor(isPositive ? 200 : 46, isPositive ? 82 : 204, isPositive ? 82 : 113);
      this.doc.setFontSize(12);
      const sign = isPositive ? "+" : "";
      this.doc.text(`${sign}${data.weightChange.toFixed(1)} kg this week`, 30, 85);
    }
    
    // Goal progress
    if (data.weightGoal) {
      this.doc.setTextColor(...this.colors.textLight);
      this.doc.setFontSize(10);
      this.doc.setFont("helvetica", "normal");
      this.doc.text(`Goal: ${data.weightGoal} kg`, 120, 55);
      
      // Progress bar with primary color
      const progress = Math.min(100, Math.max(0, data.weightProgress));
      this.doc.setFillColor(...this.colors.border);
      this.doc.roundedRect(120, 62, 60, 8, 4, 4, "F");
      this.doc.setFillColor(...this.colors.primary);
      this.doc.roundedRect(120, 62, 60 * (progress / 100), 8, 4, 4, "F");
      this.doc.setTextColor(...this.colors.text);
      this.doc.text(`${Math.round(progress)}% to goal`, 120, 80);
    }
    
    // Daily weight table
    autoTable(this.doc, {
      startY: 110,
      head: [["Date", "Weight (kg)", "Change", "Status"]],
      body: data.dailyData
        .filter(day => day.weight !== null)
        .map((day, index, arr) => {
          const prevWeight = index > 0 ? arr[index - 1].weight : null;
          const change = prevWeight && day.weight ? (day.weight - prevWeight).toFixed(1) : "-";
          const changeText = change !== "-" ? (parseFloat(change) > 0 ? `+${change}` : change) : "-";
          const status = day.weight && data.weightGoal 
            ? (day.weight <= data.weightGoal ? "✓ On Track" : "→ In Progress")
            : "-";
          return [
            format(new Date(day.date), "EEE, MMM d"),
            day.weight?.toFixed(1) || "-",
            changeText,
            status
          ];
        }),
      headStyles: {
        fillColor: this.colors.primary,
        textColor: 255,
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: this.colors.muted,
      },
    });
  }

  private addNutritionSection(data: WeeklyReportData) {
    this.doc.addPage();
    this.doc.setFontSize(18);
    this.doc.setFont("helvetica", "bold");
    this.doc.setTextColor(...this.colors.primary);
    this.doc.text("Nutrition Analysis", 20, 30);
    
    // Macros Overview
    const macros = [
      { 
        name: "Calories", 
        avg: data.avgCalories, 
        target: data.calorieTarget, 
        progress: data.calorieProgress,
        unit: "kcal",
        color: this.colors.warning
      },
      { 
        name: "Protein", 
        avg: data.avgProtein, 
        target: data.proteinTarget, 
        progress: Math.round((data.avgProtein / data.proteinTarget) * 100),
        unit: "g",
        color: this.colors.primary
      },
      { 
        name: "Carbs", 
        avg: data.avgCarbs, 
        target: data.carbsTarget, 
        progress: Math.round((data.avgCarbs / data.carbsTarget) * 100),
        unit: "g",
        color: this.colors.accent
      },
      { 
        name: "Fat", 
        avg: data.avgFat, 
        target: data.fatTarget, 
        progress: Math.round((data.avgFat / data.fatTarget) * 100),
        unit: "g",
        color: this.colors.textLight
      },
    ];
    
    let y = 50;
    macros.forEach((macro, index) => {
      const x = 20 + (index % 2) * 95;
      if (index % 2 === 0 && index > 0) y += 50;
      
      // Card
      this.doc.setFillColor(...this.colors.muted);
      this.doc.roundedRect(x, y, 85, 45, 5, 5, "F");
      
      // Name
      this.doc.setTextColor(...this.colors.textLight);
      this.doc.setFontSize(10);
      this.doc.setFont("helvetica", "normal");
      this.doc.text(macro.name, x + 5, y + 10);
      
      // Value
      this.doc.setTextColor(...this.colors.text);
      this.doc.setFontSize(18);
      this.doc.setFont("helvetica", "bold");
      this.doc.text(`${Math.round(macro.avg)}${macro.unit}`, x + 5, y + 25);
      
      // Target
      this.doc.setFontSize(8);
      this.doc.setFont("helvetica", "normal");
      this.doc.setTextColor(...this.colors.textLight);
      this.doc.text(`Target: ${macro.target}${macro.unit}`, x + 5, y + 32);
      
      // Progress ring with appropriate color
      this.doc.setFillColor(...macro.color);
      this.doc.circle(x + 70, y + 22, 8, "F");
      this.doc.setTextColor(255, 255, 255);
      this.doc.setFontSize(8);
      this.doc.setFont("helvetica", "bold");
      this.doc.text(`${macro.progress}%`, x + 70, y + 25, { align: "center" });
    });
    
    // Comparison with last week
    y += 60;
    this.doc.setTextColor(...this.colors.primary);
    this.doc.setFontSize(14);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Week-over-Week Comparison", 20, y);
    
    autoTable(this.doc, {
      startY: y + 10,
      head: [["Metric", "This Week", "Last Week", "Change", "Trend"]],
      body: [
        [
          "Avg Calories",
          Math.round(data.avgCalories).toString(),
          Math.round(data.avgCalories - data.vsLastWeek.calories).toString(),
          `${data.vsLastWeek.calories > 0 ? "+" : ""}${Math.round(data.vsLastWeek.calories)}`,
          data.vsLastWeek.calories < 0 ? "↓ Better" : data.vsLastWeek.calories > 100 ? "↑ Higher" : "→ Stable"
        ],
        [
          "Weight Change",
          `${data.weightChange?.toFixed(1) || 0} kg`,
          "-",
          data.weightChange && data.weightChange < 0 ? "↓ Losing" : data.weightChange && data.weightChange > 0 ? "↑ Gaining" : "→ Stable",
          data.weightGoal && data.weightChange && data.weightChange < 0 ? "✓ On Track" : "→ Monitor"
        ],
        [
          "Consistency",
          `${data.consistencyScore}%`,
          `${Math.max(0, data.consistencyScore - data.vsLastWeek.consistency)}%`,
          `${data.vsLastWeek.consistency > 0 ? "+" : ""}${data.vsLastWeek.consistency}%`,
          data.vsLastWeek.consistency > 0 ? "↑ Improving" : "→ Stable"
        ],
      ],
      headStyles: {
        fillColor: this.colors.primary,
        textColor: 255,
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: this.colors.muted,
      },
    });
  }

  private addDailyBreakdown(data: WeeklyReportData) {
    this.doc.addPage();
    this.doc.setFontSize(18);
    this.doc.setFont("helvetica", "bold");
    this.doc.setTextColor(...this.colors.primary);
    this.doc.text("Daily Breakdown", 20, 30);
    
    autoTable(this.doc, {
      startY: 40,
      head: [["Date", "Calories", "Protein", "Carbs", "Fat", "Water", "Weight", "Status"]],
      body: data.dailyData.map(day => {
        const totalCalories = day.calories;
        const status = totalCalories > 0 
          ? (totalCalories >= data.calorieTarget * 0.9 && totalCalories <= data.calorieTarget * 1.1 
              ? "✓ On Target" 
              : totalCalories < data.calorieTarget * 0.9 
                ? "↓ Below" 
                : "↑ Above")
          : "- Not Logged";
        
        return [
          format(new Date(day.date), "EEE, MMM d"),
          totalCalories > 0 ? Math.round(totalCalories).toString() : "-",
          day.protein > 0 ? `${Math.round(day.protein)}g` : "-",
          day.carbs > 0 ? `${Math.round(day.carbs)}g` : "-",
          day.fat > 0 ? `${Math.round(day.fat)}g` : "-",
          day.water > 0 ? `${day.water} glasses` : "-",
          day.weight ? `${day.weight.toFixed(1)} kg` : "-",
          status
        ];
      }),
      headStyles: {
        fillColor: this.colors.primary,
        textColor: 255,
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: this.colors.muted,
      },
      styles: {
        fontSize: 9,
      },
    });
  }

  private addPerformanceMetrics(data: WeeklyReportData) {
    this.doc.addPage();
    this.doc.setFontSize(18);
    this.doc.setFont("helvetica", "bold");
    this.doc.setTextColor(...this.colors.primary);
    this.doc.text("Performance Metrics", 20, 30);
    
    // Score Cards with app colors
    const scores = [
      { name: "Consistency", score: data.consistencyScore, max: 100, color: this.colors.primary },
      { name: "Meal Quality", score: data.mealQualityScore, max: 100, color: this.colors.warning },
      { name: "Hydration", score: Math.round((data.waterAverage / 8) * 100), max: 100, color: [6, 182, 212] as [number, number, number] },
      { name: "Goal Progress", score: data.goalProgress, max: 100, color: this.colors.accent },
    ];
    
    let y = 50;
    scores.forEach((score, index) => {
      const x = 20 + (index % 2) * 95;
      if (index % 2 === 0 && index > 0) y += 50;
      
      // Card
      this.doc.setFillColor(...this.colors.muted);
      this.doc.roundedRect(x, y, 85, 45, 5, 5, "F");
      
      // Score circle with appropriate color
      this.doc.setFillColor(...score.color);
      this.doc.circle(x + 20, y + 22, 12, "F");
      this.doc.setTextColor(255, 255, 255);
      this.doc.setFontSize(12);
      this.doc.setFont("helvetica", "bold");
      this.doc.text(`${Math.min(100, Math.max(0, score.score))}`, x + 20, y + 26, { align: "center" });
      
      // Label
      this.doc.setTextColor(...this.colors.text);
      this.doc.setFontSize(11);
      this.doc.setFont("helvetica", "bold");
      this.doc.text(score.name, x + 40, y + 18);
      
      // Progress bar
      this.doc.setFillColor(...this.colors.border);
      this.doc.roundedRect(x + 40, y + 25, 40, 6, 3, 3, "F");
      this.doc.setFillColor(...score.color);
      const progressWidth = 40 * (Math.min(100, Math.max(0, score.score)) / 100);
      this.doc.roundedRect(x + 40, y + 25, progressWidth, 6, 3, 3, "F");
    });
    
    // Stats summary
    y += 70;
    this.doc.setTextColor(...this.colors.primary);
    this.doc.setFontSize(14);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Key Statistics", 20, y);
    
    const stats = [
      ["Total Meals Logged", data.daysLogged.toString()],
      ["Average Daily Water", `${Math.round(data.waterAverage)} glasses`],
      ["Current Streak", `${data.currentStreak} days`],
      ["Best Streak", `${data.bestStreak} days`],
      ["Milestones Achieved", `${data.milestonesAchieved}/${data.totalMilestones}`],
      ["Days to Goal", data.weightGoal && data.currentWeight ? 
        `${Math.ceil((data.currentWeight - data.weightGoal) / 0.5)} weeks (est.)` : "N/A"],
    ];
    
    autoTable(this.doc, {
      startY: y + 10,
      body: stats,
      theme: "plain",
      styles: {
        fontSize: 10,
        cellPadding: 5,
      },
      columnStyles: {
        0: { fontStyle: "bold", textColor: 80 },
        1: { textColor: 60 },
      },
    });
  }

  private addStreaksAndGoals(data: WeeklyReportData) {
    this.doc.addPage();
    this.doc.setFontSize(18);
    this.doc.setFont("helvetica", "bold");
    this.doc.setTextColor(...this.colors.primary);
    this.doc.text("Streaks & Goals", 20, 30);
    
    // Streak visualization with warning color
    this.doc.setFillColor(...this.colors.muted);
    this.doc.roundedRect(20, 40, 170, 50, 5, 5, "F");
    
    this.doc.setTextColor(...this.colors.warning);
    this.doc.setFontSize(36);
    this.doc.setFont("helvetica", "bold");
    this.doc.text(`${data.currentStreak}`, 40, 70);
    
    this.doc.setTextColor(...this.colors.textLight);
    this.doc.setFontSize(10);
    this.doc.setFont("helvetica", "normal");
    this.doc.text("Current Streak", 40, 78);
    this.doc.text("days", 40, 83);
    
    // Best streak
    this.doc.setTextColor(...this.colors.text);
    this.doc.setFontSize(14);
    this.doc.setFont("helvetica", "bold");
    this.doc.text(`${data.bestStreak}`, 120, 70);
    this.doc.setFontSize(10);
    this.doc.setFont("helvetica", "normal");
    this.doc.setTextColor(...this.colors.textLight);
    this.doc.text("Best Streak (days)", 120, 78);
    
    // Active Goal with primary color
    if (data.activeGoal) {
      this.doc.setTextColor(...this.colors.primary);
      this.doc.setFontSize(14);
      this.doc.setFont("helvetica", "bold");
      this.doc.text("Active Goal", 20, 110);
      
      this.doc.setFillColor(...this.colors.primary);
      this.doc.setTextColor(255, 255, 255);
      this.doc.roundedRect(20, 118, 170, 30, 5, 5, "F");
      
      this.doc.setFontSize(12);
      this.doc.setFont("helvetica", "bold");
      this.doc.text(data.activeGoal, 30, 130);
      
      this.doc.setFontSize(10);
      this.doc.setFont("helvetica", "normal");
      this.doc.text(`${data.goalProgress}% Complete`, 30, 138);
      
      // Progress bar with accent color
      this.doc.setFillColor(255, 255, 255, 0.3);
      this.doc.roundedRect(130, 130, 50, 6, 3, 3, "F");
      this.doc.setFillColor(...this.colors.accent);
      this.doc.roundedRect(130, 130, 50 * (data.goalProgress / 100), 6, 3, 3, "F");
    }
  }

  private addInsightsAndRecommendations(data: WeeklyReportData) {
    this.doc.addPage();
    this.doc.setFontSize(18);
    this.doc.setFont("helvetica", "bold");
    this.doc.setTextColor(...this.colors.primary);
    this.doc.text("Insights & Recommendations", 20, 30);
    
    // Insights
    if (data.insights.length > 0) {
      this.doc.setFontSize(14);
      this.doc.setTextColor(...this.colors.text);
      this.doc.text("Key Insights", 20, 50);
      
      data.insights.forEach((insight, index) => {
        const y = 65 + (index * 20);
        
        // Bullet point with primary color
        this.doc.setFillColor(...this.colors.primary);
        this.doc.circle(25, y - 2, 2, "F");
        
        // Text
        this.doc.setFontSize(10);
        this.doc.setFont("helvetica", "normal");
        this.doc.setTextColor(...this.colors.textLight);
        const splitText = this.doc.splitTextToSize(insight, 160);
        this.doc.text(splitText, 35, y);
      });
    }
    
    // Recommendations with accent color
    if (data.recommendations.length > 0) {
      const startY = 65 + (data.insights.length * 25) + 20;
      
      this.doc.setFontSize(14);
      this.doc.setFont("helvetica", "bold");
      this.doc.setTextColor(...this.colors.text);
      this.doc.text("Personalized Recommendations", 20, startY);
      
      data.recommendations.forEach((rec, index) => {
        const y = startY + 15 + (index * 25);
        
        // Number badge with accent color
        this.doc.setFillColor(...this.colors.accent);
        this.doc.roundedRect(20, y - 8, 18, 18, 9, 9, "F");
        this.doc.setTextColor(255, 255, 255);
        this.doc.setFontSize(10);
        this.doc.setFont("helvetica", "bold");
        this.doc.text(`${index + 1}`, 29, y + 2, { align: "center" });
        
        // Text
        this.doc.setFontSize(10);
        this.doc.setFont("helvetica", "normal");
        this.doc.setTextColor(...this.colors.textLight);
        const splitText = this.doc.splitTextToSize(rec, 150);
        this.doc.text(splitText, 45, y);
      });
    }
  }

  private addFooter() {
    const pageCount = this.doc.getNumberOfPages();
    
    for (let i = 1; i <= pageCount; i++) {
      this.doc.setPage(i);
      
      // Footer line with primary color
      this.doc.setDrawColor(...this.colors.primary);
      this.doc.setLineWidth(0.5);
      this.doc.line(20, 280, 190, 280);
      
      // Footer text
      this.doc.setFontSize(8);
      this.doc.setFont("helvetica", "normal");
      this.doc.setTextColor(...this.colors.textLight);
      this.doc.text("Nutrio - Your Journey to Better Health", 20, 287);
      this.doc.text(`Page ${i} of ${pageCount}`, 180, 287);
      this.doc.setTextColor(...this.colors.primary);
      this.doc.text(`© ${new Date().getFullYear()} Nutrio. All rights reserved.`, 105, 293, { align: "center" });
    }
  }

  private calculateOverallScore(data: WeeklyReportData): number {
    const scores = [
      data.consistencyScore * 0.25,
      (data.avgCalories / data.calorieTarget) * 100 * 0.2,
      (data.avgProtein / data.proteinTarget) * 100 * 0.15,
      data.mealQualityScore * 0.2,
      Math.min(100, (data.waterAverage / 8) * 100) * 0.1,
      (data.currentStreak / Math.max(data.bestStreak, 1)) * 100 * 0.1,
    ];
    
    return Math.round(scores.reduce((a, b) => a + b, 0));
  }

  private generateSummaryText(data: WeeklyReportData): string {
    const parts = [];
    
    parts.push(`This week, you maintained a ${data.currentStreak}-day logging streak with ${data.consistencyScore}% consistency.`);
    
    if (data.weightChange !== null) {
      const changeText = data.weightChange < 0 
        ? `lost ${Math.abs(data.weightChange).toFixed(1)} kg`
        : data.weightChange > 0 
          ? `gained ${data.weightChange.toFixed(1)} kg`
          : `maintained your weight`;
      parts.push(`You ${changeText} this week.`);
    }
    
    parts.push(`Your average daily intake was ${Math.round(data.avgCalories)} calories, which is ${Math.abs(Math.round(data.avgCalories - data.calorieTarget))} calories ${data.avgCalories > data.calorieTarget ? "above" : "below"} your target.`);
    
    if (data.mealQualityScore >= 80) {
      parts.push("Excellent meal quality this week!");
    } else if (data.mealQualityScore >= 60) {
      parts.push("Good meal quality with room for improvement.");
    }
    
    return parts.join(" ");
  }

  download(data: WeeklyReportData, filename?: string) {
    const pdf = this.generate(data);
    const defaultFilename = `nutrio-weekly-report-${format(new Date(), "yyyy-MM-dd")}.pdf`;
    pdf.save(filename || defaultFilename);
  }

  getBlob(data: WeeklyReportData): Blob {
    const pdf = this.generate(data);
    return pdf.output("blob");
  }
}

export const weeklyReportPDF = new WeeklyReportPDFGenerator();
