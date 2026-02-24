import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

// App Color Scheme - Standard RGB for PDF compatibility
const COLORS = {
  primary: [46, 204, 113] as [number, number, number],
  primaryDark: [39, 174, 96] as [number, number, number],
  accent: [26, 188, 156] as [number, number, number],
  warning: [243, 156, 18] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  background: [250, 250, 250] as [number, number, number],
  card: [255, 255, 255] as [number, number, number],
  border: [230, 230, 230] as [number, number, number],
  textPrimary: [45, 55, 72] as [number, number, number],
  textSecondary: [113, 128, 150] as [number, number, number],
  textMuted: [160, 174, 192] as [number, number, number],
};

// Layout Constants
const MARGIN = 15;
const PAGE_WIDTH = 210;
const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2);

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
  private totalPages = 1;
  
  constructor() {
    this.doc = new jsPDF({
      unit: 'mm',
      format: 'a4',
      compress: true,
    });
  }

  generate(data: WeeklyReportData): jsPDF {
    this.totalPages = 6;
    
    // Page 1: Cover + Executive Summary
    this.addCoverAndSummary(data);
    
    // Page 2: Weight + Nutrition
    this.addWeightAndNutrition(data);
    
    // Page 3: Daily Breakdown
    this.addDailyBreakdown(data);
    
    // Page 4: Performance + Streaks
    this.addPerformanceAndStreaks(data);
    
    // Page 5: Insights
    this.addInsights(data);
    
    return this.doc;
  }

  private addCoverAndSummary(data: WeeklyReportData) {
    // Header background
    this.doc.setFillColor(...COLORS.primary);
    this.doc.rect(0, 0, PAGE_WIDTH, 35, 'F');
    
    // Logo
    this.doc.setFillColor(...COLORS.white);
    this.doc.circle(MARGIN + 12, 20, 8, 'F');
    this.doc.setTextColor(...COLORS.primary);
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('N', MARGIN + 12, 23, { align: 'center' });
    
    // Title
    this.doc.setTextColor(...COLORS.white);
    this.doc.setFontSize(20);
    this.doc.text('Nutrio Fuel', MARGIN + 28, 18);
    this.doc.setFontSize(11);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text('Weekly Progress Report', MARGIN + 28, 26);
    
    // Date and user info
    this.doc.setTextColor(...COLORS.textSecondary);
    this.doc.setFontSize(9);
    const dateRange = `${format(new Date(data.weekStart), 'MMM d')} - ${format(new Date(data.weekEnd), 'MMM d, yyyy')}`;
    this.doc.text(dateRange, PAGE_WIDTH - MARGIN, 18, { align: 'right' });
    this.doc.text(`For: ${data.userName}`, PAGE_WIDTH - MARGIN, 24, { align: 'right' });
    
    // Executive Summary Section
    let y = 50;
    this.doc.setTextColor(...COLORS.primary);
    this.doc.setFontSize(16);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Executive Summary', MARGIN, y);
    
    // Overall Score Box
    y += 10;
    const overallScore = this.calculateOverallScore(data);
    this.doc.setFillColor(...COLORS.primary);
    this.doc.roundedRect(MARGIN, y, 50, 45, 5, 5, 'F');
    this.doc.setTextColor(...COLORS.white);
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text('Overall Score', MARGIN + 25, y + 12, { align: 'center' });
    this.doc.setFontSize(28);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(`${overallScore}`, MARGIN + 25, y + 32, { align: 'center' });
    
    // Key Metrics - Right side
    const metricsX = MARGIN + 60;
    const metrics = [
      { label: 'Avg Calories', value: `${Math.round(data.avgCalories)}`, target: `Target: ${data.calorieTarget}` },
      { label: 'Days Logged', value: `${data.daysLogged}/${data.totalDays}`, target: `${data.consistencyScore}% consistency` },
      { label: 'Meal Quality', value: `${data.mealQualityScore}`, target: 'out of 100' },
      { label: 'Current Streak', value: `${data.currentStreak}`, target: 'days' },
      { label: 'Water Avg', value: `${Math.round(data.waterAverage)}`, target: 'glasses/day' },
    ];
    
    let metricY = y;
    metrics.forEach((metric, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = metricsX + (col * 65);
      metricY = y + (row * 22);
      
      // Card background
      this.doc.setFillColor(...COLORS.card);
      this.doc.roundedRect(x, metricY, 60, 20, 3, 3, 'F');
      
      // Left accent
      this.doc.setFillColor(...COLORS.primary);
      this.doc.rect(x, metricY, 2, 20, 'F');
      
      // Text
      this.doc.setTextColor(...COLORS.textSecondary);
      this.doc.setFontSize(7);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text(metric.label, x + 5, metricY + 6);
      
      this.doc.setTextColor(...COLORS.textPrimary);
      this.doc.setFontSize(11);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text(metric.value, x + 5, metricY + 14);
      
      this.doc.setTextColor(...COLORS.textMuted);
      this.doc.setFontSize(6);
      this.doc.text(metric.target, x + 5, metricY + 18);
    });
    
    // Summary text
    y = 115;
    this.doc.setFillColor(245, 255, 250);
    this.doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 30, 4, 4, 'F');
    
    this.doc.setTextColor(...COLORS.primaryDark);
    this.doc.setFontSize(11);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Weekly Summary', MARGIN + 5, y + 10);
    
    this.doc.setTextColor(...COLORS.textSecondary);
    this.doc.setFontSize(9);
    this.doc.setFont('helvetica', 'normal');
    const summaryText = this.generateSummaryText(data);
    const splitText = this.doc.splitTextToSize(summaryText, CONTENT_WIDTH - 15);
    this.doc.text(splitText, MARGIN + 5, y + 18);
    
    this.addFooter();
    this.doc.addPage();
    this.pageNumber++;
  }

  private addWeightAndNutrition(data: WeeklyReportData) {
    this.addPageHeader('Weight & Nutrition');
    
    let y = 35;
    
    // Weight Section (if available)
    if (data.currentWeight) {
      // Weight Card
      this.doc.setFillColor(...COLORS.card);
      this.doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 35, 5, 5, 'F');
      
      this.doc.setTextColor(...COLORS.textPrimary);
      this.doc.setFontSize(10);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text('Current Weight', MARGIN + 5, y + 10);
      
      this.doc.setFontSize(24);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text(`${data.currentWeight}`, MARGIN + 5, y + 26);
      
      this.doc.setTextColor(...COLORS.textSecondary);
      this.doc.setFontSize(10);
      this.doc.text('kg', MARGIN + 45, y + 26);
      
      // Weight change
      if (data.weightChange !== null) {
        const isLoss = data.weightChange < 0;
        this.doc.setTextColor(...(isLoss ? COLORS.primary : COLORS.warning));
        this.doc.setFontSize(9);
        const sign = data.weightChange > 0 ? '+' : '';
        this.doc.text(`${sign}${data.weightChange.toFixed(1)} kg this week`, MARGIN + 5, y + 32);
      }
      
      // Goal
      if (data.weightGoal) {
        this.doc.setTextColor(...COLORS.textSecondary);
        this.doc.setFontSize(8);
        this.doc.text(`Goal: ${data.weightGoal} kg`, MARGIN + 80, y + 12);
        
        // Progress bar
        const progress = Math.min(100, Math.max(0, data.weightProgress));
        this.doc.setFillColor(...COLORS.border);
        this.doc.roundedRect(MARGIN + 80, y + 18, 60, 6, 3, 3, 'F');
        this.doc.setFillColor(...COLORS.primary);
        this.doc.roundedRect(MARGIN + 80, y + 18, 60 * (progress / 100), 6, 3, 3, 'F');
        this.doc.setTextColor(...COLORS.textSecondary);
        this.doc.setFontSize(7);
        this.doc.text(`${Math.round(progress)}% to goal`, MARGIN + 80, y + 30);
      }
      
      y += 45;
    }
    
    // Nutrition Section
    this.doc.setTextColor(...COLORS.primary);
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Nutrition Analysis', MARGIN, y);
    y += 8;
    
    // Macro Cards - 2x2 grid
    const macros = [
      { name: 'Calories', avg: data.avgCalories, target: data.calorieTarget, progress: data.calorieProgress, unit: 'kcal', color: COLORS.warning },
      { name: 'Protein', avg: data.avgProtein, target: data.proteinTarget, progress: Math.round((data.avgProtein / data.proteinTarget) * 100), unit: 'g', color: COLORS.primary },
      { name: 'Carbs', avg: data.avgCarbs, target: data.carbsTarget, progress: Math.round((data.avgCarbs / data.carbsTarget) * 100), unit: 'g', color: COLORS.accent },
      { name: 'Fat', avg: data.avgFat, target: data.fatTarget, progress: Math.round((data.avgFat / data.fatTarget) * 100), unit: 'g', color: COLORS.textSecondary },
    ];
    
    const cardWidth = (CONTENT_WIDTH - 10) / 2;
    const cardHeight = 30;
    
    macros.forEach((macro, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = MARGIN + (col * (cardWidth + 10));
      const cardY = y + (row * (cardHeight + 8));
      
      // Card
      this.doc.setFillColor(...COLORS.card);
      this.doc.roundedRect(x, cardY, cardWidth, cardHeight, 4, 4, 'F');
      
      // Top bar
      this.doc.setFillColor(...macro.color);
      this.doc.roundedRect(x, cardY, cardWidth, 3, 2, 2, 'F');
      
      // Name
      this.doc.setTextColor(...COLORS.textSecondary);
      this.doc.setFontSize(7);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text(macro.name, x + 5, cardY + 10);
      
      // Value
      this.doc.setTextColor(...COLORS.textPrimary);
      this.doc.setFontSize(14);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text(`${Math.round(macro.avg)}${macro.unit}`, x + 5, cardY + 20);
      
      // Target
      this.doc.setTextColor(...COLORS.textMuted);
      this.doc.setFontSize(6);
      this.doc.text(`Target: ${macro.target}${macro.unit}`, x + 5, cardY + 26);
      
      // Progress circle
      this.doc.setFillColor(...macro.color);
      this.doc.circle(x + cardWidth - 15, cardY + 15, 8, 'F');
      this.doc.setTextColor(...COLORS.white);
      this.doc.setFontSize(7);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text(`${macro.progress}%`, x + cardWidth - 15, cardY + 17, { align: 'center' });
    });
    
    // Week Comparison Table
    y += 75;
    autoTable(this.doc, {
      startY: y,
      head: [['Metric', 'This Week', 'Last Week', 'Change', 'Trend']],
      body: [
        [
          'Avg Calories',
          Math.round(data.avgCalories).toString(),
          Math.round(data.avgCalories - data.vsLastWeek.calories).toString(),
          `${data.vsLastWeek.calories > 0 ? '+' : ''}${Math.round(data.vsLastWeek.calories)}`,
          data.vsLastWeek.calories < 0 ? 'Better' : data.vsLastWeek.calories > 100 ? 'Higher' : 'Stable'
        ],
        [
          'Weight Change',
          `${data.weightChange?.toFixed(1) || 0} kg`,
          '-',
          data.weightChange && data.weightChange < 0 ? 'Losing' : data.weightChange && data.weightChange > 0 ? 'Gaining' : 'Stable',
          data.weightGoal && data.weightChange && data.weightChange < 0 ? 'On Track' : 'Monitor'
        ],
        [
          'Consistency',
          `${data.consistencyScore}%`,
          `${Math.max(0, data.consistencyScore - data.vsLastWeek.consistency)}%`,
          `${data.vsLastWeek.consistency > 0 ? '+' : ''}${data.vsLastWeek.consistency}%`,
          data.vsLastWeek.consistency > 0 ? 'Improving' : 'Stable'
        ],
      ],
      headStyles: {
        fillColor: [46, 204, 113],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 8,
        cellPadding: { top: 6, bottom: 6, left: 5, right: 5 },
      },
      bodyStyles: {
        fontSize: 8,
        cellPadding: { top: 5, bottom: 5, left: 5, right: 5 },
        textColor: COLORS.textPrimary,
      },
      alternateRowStyles: {
        fillColor: [250, 250, 250],
      },
      margin: { left: MARGIN, right: MARGIN },
    });
    
    this.addFooter();
    this.doc.addPage();
    this.pageNumber++;
  }

  private addDailyBreakdown(data: WeeklyReportData) {
    this.addPageHeader('Daily Breakdown');
    
    autoTable(this.doc, {
      startY: 35,
      head: [['Date', 'Calories', 'Protein', 'Carbs', 'Fat', 'Water', 'Weight', 'Status']],
      body: data.dailyData.map(day => {
        const totalCalories = day.calories;
        let status = 'Not Logged';
        if (totalCalories > 0) {
          if (totalCalories >= data.calorieTarget * 0.9 && totalCalories <= data.calorieTarget * 1.1) {
            status = 'On Target';
          } else if (totalCalories < data.calorieTarget * 0.9) {
            status = 'Below';
          } else {
            status = 'Above';
          }
        }
        
        return [
          format(new Date(day.date), 'EEE, MMM d'),
          totalCalories > 0 ? Math.round(totalCalories).toString() : '-',
          day.protein > 0 ? `${Math.round(day.protein)}g` : '-',
          day.carbs > 0 ? `${Math.round(day.carbs)}g` : '-',
          day.fat > 0 ? `${Math.round(day.fat)}g` : '-',
          day.water > 0 ? `${day.water}` : '-',
          day.weight ? `${day.weight.toFixed(1)} kg` : '-',
          status
        ];
      }),
      headStyles: {
        fillColor: [46, 204, 113],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 8,
        cellPadding: { top: 6, bottom: 6, left: 4, right: 4 },
      },
      bodyStyles: {
        fontSize: 8,
        cellPadding: { top: 5, bottom: 5, left: 4, right: 4 },
        textColor: COLORS.textPrimary,
      },
      alternateRowStyles: {
        fillColor: [250, 250, 250],
      },
      columnStyles: {
        0: { cellWidth: 32 },
        1: { cellWidth: 22, halign: 'center' },
        2: { cellWidth: 22, halign: 'center' },
        3: { cellWidth: 22, halign: 'center' },
        4: { cellWidth: 22, halign: 'center' },
        5: { cellWidth: 18, halign: 'center' },
        6: { cellWidth: 26, halign: 'center' },
        7: { cellWidth: 28, halign: 'center' },
      },
      styles: {
        lineColor: COLORS.border,
        lineWidth: 0.5,
      },
      margin: { left: MARGIN, right: MARGIN },
    });
    
    this.addFooter();
    this.doc.addPage();
    this.pageNumber++;
  }

  private addPerformanceAndStreaks(data: WeeklyReportData) {
    this.addPageHeader('Performance & Streaks');
    
    let y = 35;
    
    // Performance Metrics - 4 cards in a row
    const scores = [
      { name: 'Consistency', score: data.consistencyScore, color: COLORS.primary },
      { name: 'Meal Quality', score: data.mealQualityScore, color: COLORS.warning },
      { name: 'Hydration', score: Math.round((data.waterAverage / 8) * 100), color: [52, 152, 219] },
      { name: 'Goal Progress', score: data.goalProgress, color: COLORS.accent },
    ];
    
    const cardWidth = (CONTENT_WIDTH - 15) / 4;
    
    scores.forEach((score, index) => {
      const x = MARGIN + (index * (cardWidth + 5));
      
      // Card
      this.doc.setFillColor(...COLORS.card);
      this.doc.roundedRect(x, y, cardWidth, 45, 4, 4, 'F');
      
      // Score circle
      this.doc.setFillColor(score.color[0], score.color[1], score.color[2]);
      this.doc.circle(x + cardWidth / 2, y + 18, 10, 'F');
      
      this.doc.setTextColor(...COLORS.white);
      this.doc.setFontSize(10);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text(`${Math.min(100, Math.max(0, score.score))}`, x + cardWidth / 2, y + 21, { align: 'center' });
      
      // Label
      this.doc.setTextColor(...COLORS.textSecondary);
      this.doc.setFontSize(7);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text(score.name, x + cardWidth / 2, y + 38, { align: 'center' });
      
      // Progress bar
      this.doc.setFillColor(...COLORS.border);
      this.doc.roundedRect(x + 5, y + 42, cardWidth - 10, 4, 2, 2, 'F');
      this.doc.setFillColor(score.color[0], score.color[1], score.color[2]);
      const progressWidth = (cardWidth - 10) * (Math.min(100, Math.max(0, score.score)) / 100);
      this.doc.roundedRect(x + 5, y + 42, progressWidth, 4, 2, 2, 'F');
    });
    
    // Streaks Section
    y += 55;
    this.doc.setFillColor(...COLORS.card);
    this.doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 40, 5, 5, 'F');
    
    // Current Streak
    this.doc.setFillColor(...COLORS.warning);
    this.doc.circle(MARGIN + 25, y + 20, 12, 'F');
    this.doc.setTextColor(...COLORS.white);
    this.doc.setFontSize(10);
    this.doc.text('F', MARGIN + 25, y + 24, { align: 'center' });
    
    this.doc.setTextColor(...COLORS.textPrimary);
    this.doc.setFontSize(20);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(`${data.currentStreak}`, MARGIN + 50, y + 18);
    
    this.doc.setTextColor(...COLORS.textSecondary);
    this.doc.setFontSize(8);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text('Current Streak (days)', MARGIN + 50, y + 26);
    
    // Best Streak
    this.doc.setTextColor(...COLORS.textPrimary);
    this.doc.setFontSize(16);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(`${data.bestStreak}`, PAGE_WIDTH - MARGIN - 60, y + 18);
    
    this.doc.setTextColor(...COLORS.textMuted);
    this.doc.setFontSize(8);
    this.doc.text('Best Streak', PAGE_WIDTH - MARGIN - 60, y + 26);
    
    // Key Stats
    y += 50;
    this.doc.setTextColor(...COLORS.primary);
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Key Statistics', MARGIN, y);
    
    const stats = [
      ['Total Meals Logged', data.daysLogged.toString()],
      ['Average Daily Water', `${Math.round(data.waterAverage)} glasses`],
      ['Milestones Achieved', `${data.milestonesAchieved}/${data.totalMilestones}`],
    ];
    
    autoTable(this.doc, {
      startY: y + 5,
      body: stats,
      theme: 'plain',
      styles: {
        fontSize: 9,
        cellPadding: { top: 6, bottom: 6, left: 0, right: 0 },
      },
      columnStyles: {
        0: { fontStyle: 'bold', textColor: COLORS.textSecondary, cellWidth: 80 },
        1: { textColor: COLORS.textPrimary },
      },
      margin: { left: MARGIN, right: MARGIN },
    });
    
    this.addFooter();
    this.doc.addPage();
    this.pageNumber++;
  }

  private addInsights(data: WeeklyReportData) {
    this.addPageHeader('Insights & Recommendations');
    
    let y = 40;
    
    // Insights
    if (data.insights.length > 0) {
      this.doc.setTextColor(...COLORS.primary);
      this.doc.setFontSize(12);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text('Key Insights', MARGIN, y);
      y += 8;
      
      data.insights.forEach((insight) => {
        // Bullet
        this.doc.setFillColor(...COLORS.primary);
        this.doc.circle(MARGIN + 3, y + 3, 1.5, 'F');
        
        // Text
        this.doc.setTextColor(...COLORS.textSecondary);
        this.doc.setFontSize(9);
        this.doc.setFont('helvetica', 'normal');
        const splitText = this.doc.splitTextToSize(insight, CONTENT_WIDTH - 15);
        this.doc.text(splitText, MARGIN + 10, y + 3);
        
        y += (splitText.length * 5) + 3;
      });
    }
    
    // Recommendations
    if (data.recommendations.length > 0) {
      y += 10;
      this.doc.setTextColor(...COLORS.primary);
      this.doc.setFontSize(12);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text('Recommendations', MARGIN, y);
      y += 8;
      
      data.recommendations.forEach((rec, index) => {
        // Number badge
        this.doc.setFillColor(...COLORS.accent);
        this.doc.roundedRect(MARGIN, y, 12, 12, 6, 6, 'F');
        
        this.doc.setTextColor(...COLORS.white);
        this.doc.setFontSize(8);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text(`${index + 1}`, MARGIN + 6, y + 8, { align: 'center' });
        
        // Text
        this.doc.setTextColor(...COLORS.textSecondary);
        this.doc.setFontSize(9);
        this.doc.setFont('helvetica', 'normal');
        const splitText = this.doc.splitTextToSize(rec, CONTENT_WIDTH - 25);
        this.doc.text(splitText, MARGIN + 18, y + 4);
        
        y += Math.max(15, (splitText.length * 5) + 5);
      });
    }
    
    this.addFooter();
  }

  private addPageHeader(title: string) {
    this.doc.setTextColor(...COLORS.textPrimary);
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(title, MARGIN, 20);
    
    this.doc.setDrawColor(...COLORS.primary);
    this.doc.setLineWidth(0.5);
    this.doc.line(MARGIN, 24, MARGIN + 50, 24);
    
    this.doc.setFont('helvetica', 'normal');
  }

  private addFooter() {
    const y = 285;
    
    this.doc.setDrawColor(...COLORS.border);
    this.doc.setLineWidth(0.3);
    this.doc.line(MARGIN, y - 5, PAGE_WIDTH - MARGIN, y - 5);
    
    this.doc.setTextColor(...COLORS.textMuted);
    this.doc.setFontSize(7);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text('Nutrio Fuel - Your Journey to Better Health', MARGIN, y);
    this.doc.text(`Page ${this.pageNumber} of ${this.totalPages}`, PAGE_WIDTH - MARGIN, y, { align: 'right' });
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
    
    parts.push(`Your average daily intake was ${Math.round(data.avgCalories)} calories.`);
    
    if (data.mealQualityScore >= 80) {
      parts.push("Excellent meal quality this week!");
    } else if (data.mealQualityScore >= 60) {
      parts.push("Good meal quality with room for improvement.");
    }
    
    return parts.join(' ');
  }

  download(data: WeeklyReportData, filename?: string) {
    const pdf = this.generate(data);
    const defaultFilename = `nutrio-weekly-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
    pdf.save(filename || defaultFilename);
  }

  getBlob(data: WeeklyReportData): Blob {
    const pdf = this.generate(data);
    return pdf.output('blob');
  }
}

export const professionalWeeklyReportPDF = new ProfessionalWeeklyReportPDF();
