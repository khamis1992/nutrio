# Analytics & Reporting Endpoints

<cite>
**Referenced Files in This Document**
- [analytics.ts](file://src/lib/analytics.ts)
- [PremiumAnalyticsDashboard.tsx](file://src/components/PremiumAnalyticsDashboard.tsx)
- [analytics.spec.ts](file://e2e/admin/analytics.spec.ts)
- [reports.spec.ts](file://e2e/admin/reports.spec.ts)
- [20260106192947_e4bf76cd-2db7-4c7a-8d7c-054362aa9a6f.sql](file://supabase/migrations/20260106192947_e4bf76cd-2db7-4c7a-8d7c-054362aa9a6f.sql)
- [weekly-report-pdf.ts](file://src/lib/weekly-report-pdf.ts)
- [professional-weekly-report-pdf.ts](file://src/lib/professional-weekly-report-pdf.ts)
- [nutrio-report-pdf.ts](file://src/lib/nutrio-report-pdf.ts)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)

## Introduction
This document provides comprehensive REST API documentation for analytics and reporting endpoints across business metrics, user behavior analytics, financial reporting, and operational dashboards. It covers data export capabilities, custom report generation, automated reporting schedules, KPI tracking, trend analysis, performance monitoring, real-time analytics, historical data queries, and executive reporting. It also documents data privacy considerations and compliance reporting features.

## Project Structure
The analytics and reporting functionality spans frontend components, backend Supabase migrations, and PDF generation utilities:
- Frontend analytics instrumentation and dashboards
- Premium analytics dashboard with historical and predictive views
- Automated report generation via PDF libraries
- Database schema supporting premium analytics subscriptions and pricing

```mermaid
graph TB
subgraph "Frontend"
A["Analytics Library<br/>analytics.ts"]
B["Premium Analytics Dashboard<br/>PremiumAnalyticsDashboard.tsx"]
C["Weekly Report PDF<br/>weekly-report-pdf.ts"]
D["Professional Weekly Report PDF<br/>professional-weekly-report-pdf.ts"]
E["Nutrio Report PDF<br/>nutrio-report-pdf.ts"]
end
subgraph "Backend"
F["Supabase Migrations<br/>20260106192947_e4bf76cd-2db7-4c7a-8d7c-054362aa9a6f.sql"]
end
A --> B
B --> F
C --> B
D --> B
E --> B
```

**Diagram sources**
- [analytics.ts:1-170](file://src/lib/analytics.ts#L1-L170)
- [PremiumAnalyticsDashboard.tsx:1-800](file://src/components/PremiumAnalyticsDashboard.tsx#L1-L800)
- [weekly-report-pdf.ts:1-766](file://src/lib/weekly-report-pdf.ts#L1-L766)
- [professional-weekly-report-pdf.ts:1-800](file://src/lib/professional-weekly-report-pdf.ts#L1-L800)
- [nutrio-report-pdf.ts:1-800](file://src/lib/nutrio-report-pdf.ts#L1-L800)
- [20260106192947_e4bf76cd-2db7-4c7a-8d7c-054362aa9a6f.sql:1-48](file://supabase/migrations/20260106192947_e4bf76cd-2db7-4c7a-8d7c-054362aa9a6f.sql#L1-L48)

**Section sources**
- [analytics.ts:1-170](file://src/lib/analytics.ts#L1-L170)
- [PremiumAnalyticsDashboard.tsx:1-800](file://src/components/PremiumAnalyticsDashboard.tsx#L1-L800)
- [weekly-report-pdf.ts:1-766](file://src/lib/weekly-report-pdf.ts#L1-L766)
- [professional-weekly-report-pdf.ts:1-800](file://src/lib/professional-weekly-report-pdf.ts#L1-L800)
- [nutrio-report-pdf.ts:1-800](file://src/lib/nutrio-report-pdf.ts#L1-L800)
- [20260106192947_e4bf76cd-2db7-4c7a-8d7c-054362aa9a6f.sql:1-48](file://supabase/migrations/20260106192947_e4bf76cd-2db7-4c7a-8d7c-054362aa9a6f.sql#L1-L48)

## Core Components
- Analytics instrumentation library for event tracking, user identification, and privacy-safe property sanitization
- Premium analytics dashboard for revenue trends, customer retention, peak hours, menu performance, and forecasting
- PDF report generators for weekly and professional reports with export capabilities
- Supabase migration enabling premium analytics subscriptions and pricing configuration

Key capabilities:
- Real-time analytics via PostHog integration
- Historical data queries for 30-day and 90-day trends
- Exportable reports in PDF format
- Subscription-based premium analytics access control

**Section sources**
- [analytics.ts:1-170](file://src/lib/analytics.ts#L1-L170)
- [PremiumAnalyticsDashboard.tsx:1-800](file://src/components/PremiumAnalyticsDashboard.tsx#L1-L800)
- [weekly-report-pdf.ts:1-766](file://src/lib/weekly-report-pdf.ts#L1-L766)
- [professional-weekly-report-pdf.ts:1-800](file://src/lib/professional-weekly-report-pdf.ts#L1-L800)
- [nutrio-report-pdf.ts:1-800](file://src/lib/nutrio-report-pdf.ts#L1-L800)
- [20260106192947_e4bf76cd-2db7-4c7a-8d7c-054362aa9a6f.sql:1-48](file://supabase/migrations/20260106192947_e4bf76cd-2db7-4c7a-8d7c-054362aa9a6f.sql#L1-L48)

## Architecture Overview
The analytics and reporting architecture integrates frontend instrumentation with backend data access and PDF generation:
- Analytics events are captured client-side and sent to PostHog
- Premium analytics dashboard queries Supabase tables for historical and predictive insights
- PDF generators produce exportable reports for executive consumption

```mermaid
sequenceDiagram
participant Client as "Client App"
participant Analytics as "Analytics Library<br/>analytics.ts"
participant PostHog as "PostHog"
participant Dashboard as "Premium Analytics Dashboard<br/>PremiumAnalyticsDashboard.tsx"
participant Supabase as "Supabase"
participant PDF as "PDF Generators"
Client->>Analytics : Initialize and identify user
Analytics->>PostHog : Capture events and page views
Client->>Dashboard : Load analytics dashboard
Dashboard->>Supabase : Query historical and predictive data
Supabase-->>Dashboard : Return aggregated metrics
Client->>PDF : Generate and export report
PDF-->>Client : Downloadable PDF
```

**Diagram sources**
- [analytics.ts:1-170](file://src/lib/analytics.ts#L1-L170)
- [PremiumAnalyticsDashboard.tsx:1-800](file://src/components/PremiumAnalyticsDashboard.tsx#L1-L800)
- [weekly-report-pdf.ts:1-766](file://src/lib/weekly-report-pdf.ts#L1-L766)
- [professional-weekly-report-pdf.ts:1-800](file://src/lib/professional-weekly-report-pdf.ts#L1-L800)
- [nutrio-report-pdf.ts:1-800](file://src/lib/nutrio-report-pdf.ts#L1-L800)

## Detailed Component Analysis

### Analytics Instrumentation
The analytics library provides:
- Initialization with environment-specific configuration
- User identification and event tracking
- Privacy-safe property sanitization
- Predefined event categories for common actions

```mermaid
classDiagram
class AnalyticsLibrary {
+initPostHog()
+identifyUser(userId, traits)
+resetUser()
+trackEvent(eventName, properties)
+trackPageView(pageName, properties)
+trackUserSignedUp(userId, method)
+trackUserLoggedIn(userId, method)
+trackOrderStarted(orderId, amount)
+trackOrderCompleted(orderId, amount, items)
+trackSubscriptionStarted(planId, amount)
+trackWalletTopupCompleted(amount, paymentMethod)
+trackError(error, context?)
-sanitizeProperties(props)
+isFeatureEnabled(featureKey, defaultValue)
}
```

**Diagram sources**
- [analytics.ts:1-170](file://src/lib/analytics.ts#L1-L170)

**Section sources**
- [analytics.ts:1-170](file://src/lib/analytics.ts#L1-L170)

### Premium Analytics Dashboard
The premium dashboard aggregates:
- Revenue trends over 30 days with projections
- Customer retention and churn analysis
- Menu performance classification
- Demand forecasting calendar
- Exportable PDF report

```mermaid
flowchart TD
Start(["Load Dashboard"]) --> Fetch["Fetch restaurant data<br/>and schedules"]
Fetch --> Trends["Compute 30-day revenue trends"]
Fetch --> Retention["Calculate retention and churn"]
Fetch --> Menu["Aggregate menu performance"]
Fetch --> Forecast["Generate 14-day demand forecast"]
Trends --> Output["Render charts and metrics"]
Retention --> Output
Menu --> Output
Forecast --> Output
Output --> Export["Export PDF report"]
Export --> End(["Done"])
```

**Diagram sources**
- [PremiumAnalyticsDashboard.tsx:185-526](file://src/components/PremiumAnalyticsDashboard.tsx#L185-L526)

**Section sources**
- [PremiumAnalyticsDashboard.tsx:1-800](file://src/components/PremiumAnalyticsDashboard.tsx#L1-L800)

### PDF Report Generation
Multiple PDF generators support:
- Weekly progress reports with metrics and recommendations
- Professional weekly reports with advanced insights and habit intelligence
- Specialized reports for nutrition tracking

```mermaid
classDiagram
class WeeklyReportPDFGenerator {
+generate(data) jsPDF
+download(data, filename?)
+getBlob(data) Blob
-addHeader(data)
-addExecutiveSummary(data)
-addWeightSection(data)
-addNutritionSection(data)
-addDailyBreakdown(data)
-addPerformanceMetrics(data)
-addStreaksAndGoals(data)
-addInsightsAndRecommendations(data)
-addFooter()
-calculateOverallScore(data) number
-generateSummaryText(data) string
}
class ProfessionalWeeklyReportPDF {
+generate(data) jsPDF
-addCoverPage(data)
-addPerformanceScore(data)
-addWeeklySnapshot(data)
-addMacroStability(data)
-addMomentumScore(data)
-addHabitRiskDetection(data)
-addCalorieOverview(data)
-addMacroDistribution(data)
-addHydrationConsistency(data)
-addMealPlanningRecommendations(data)
-addMealPlan(data)
-addTrendAnalysis(data)
-addPredictiveTimeline(data)
-addDataAvailabilityStatus(data)
-addDisclaimer(data)
-stampFooter(page)
}
class NutrioReportPDF {
+cover(d)
+executiveSummary(d)
+dailyBreakdown(d)
+habitIntelligence(d)
+calculateOverallScore(d) number
+variance(arr) number
}
```

**Diagram sources**
- [weekly-report-pdf.ts:93-766](file://src/lib/weekly-report-pdf.ts#L93-L766)
- [professional-weekly-report-pdf.ts:127-192](file://src/lib/professional-weekly-report-pdf.ts#L127-L192)
- [nutrio-report-pdf.ts:105-800](file://src/lib/nutrio-report-pdf.ts#L105-L800)

**Section sources**
- [weekly-report-pdf.ts:1-766](file://src/lib/weekly-report-pdf.ts#L1-L766)
- [professional-weekly-report-pdf.ts:1-800](file://src/lib/professional-weekly-report-pdf.ts#L1-L800)
- [nutrio-report-pdf.ts:1-800](file://src/lib/nutrio-report-pdf.ts#L1-L800)

### Supabase Schema for Premium Analytics
The migration defines:
- Premium analytics subscription tracking on restaurants
- Purchase records with RLS policies
- Platform settings for pricing tiers

```mermaid
erDiagram
RESTAURANTS {
uuid id PK
timestamptz premium_analytics_until
}
PREMIUM_ANALYTICS_PURCHASES {
uuid id PK
uuid restaurant_id FK
uuid partner_id
text package_type
numeric price_paid
timestamptz starts_at
timestamptz ends_at
text payment_reference
timestamptz created_at
}
PLATFORM_SETTINGS {
text key PK
jsonb value
text description
}
RESTAURANTS ||--o{ PREMIUM_ANALYTICS_PURCHASES : "has purchases"
```

**Diagram sources**
- [20260106192947_e4bf76cd-2db7-4c7a-8d7c-054362aa9a6f.sql:1-48](file://supabase/migrations/20260106192947_e4bf76cd-2db7-4c7a-8d7c-054362aa9a6f.sql#L1-L48)

**Section sources**
- [20260106192947_e4bf76cd-2db7-4c7a-8d7c-054362aa9a6f.sql:1-48](file://supabase/migrations/20260106192947_e4bf76cd-2db7-4c7a-8d7c-054362aa9a6f.sql#L1-L48)

## Dependency Analysis
- Analytics library depends on PostHog SDK and environment variables
- Premium dashboard depends on Supabase client and recharts for visualization
- PDF generators depend on jsPDF and optional autoTable for tabular data
- Supabase migration enforces RLS policies for secure access

```mermaid
graph LR
Analytics["Analytics Library"] --> PostHog["PostHog SDK"]
Dashboard["Premium Analytics Dashboard"] --> Supabase["Supabase Client"]
Dashboard --> Charts["Recharts"]
Reports["PDF Generators"] --> jsPDF["jsPDF"]
Reports --> AutoTable["jsPDF AutoTable"]
Supabase --> RLS["RLS Policies"]
```

**Diagram sources**
- [analytics.ts:1-170](file://src/lib/analytics.ts#L1-L170)
- [PremiumAnalyticsDashboard.tsx:1-800](file://src/components/PremiumAnalyticsDashboard.tsx#L1-L800)
- [weekly-report-pdf.ts:1-766](file://src/lib/weekly-report-pdf.ts#L1-L766)
- [professional-weekly-report-pdf.ts:1-800](file://src/lib/professional-weekly-report-pdf.ts#L1-L800)
- [nutrio-report-pdf.ts:1-800](file://src/lib/nutrio-report-pdf.ts#L1-L800)
- [20260106192947_e4bf76cd-2db7-4c7a-8d7c-054362aa9a6f.sql:1-48](file://supabase/migrations/20260106192947_e4bf76cd-2db7-4c7a-8d7c-054362aa9a6f.sql#L1-L48)

**Section sources**
- [analytics.ts:1-170](file://src/lib/analytics.ts#L1-L170)
- [PremiumAnalyticsDashboard.tsx:1-800](file://src/components/PremiumAnalyticsDashboard.tsx#L1-L800)
- [weekly-report-pdf.ts:1-766](file://src/lib/weekly-report-pdf.ts#L1-L766)
- [professional-weekly-report-pdf.ts:1-800](file://src/lib/professional-weekly-report-pdf.ts#L1-L800)
- [nutrio-report-pdf.ts:1-800](file://src/lib/nutrio-report-pdf.ts#L1-L800)
- [20260106192947_e4bf76cd-2db7-4c7a-8d7c-054362aa9a6f.sql:1-48](file://supabase/migrations/20260106192947_e4bf76cd-2db7-4c7a-8d7c-054362aa9a6f.sql#L1-L48)

## Performance Considerations
- Client-side analytics minimize server load while providing real-time insights
- Dashboard computations aggregate data locally for responsive rendering
- PDF generation occurs client-side to reduce backend processing overhead
- Supabase queries use targeted filters and date ranges to limit payload size

## Troubleshooting Guide
Common issues and resolutions:
- Analytics not capturing events: verify PostHog initialization and environment variables
- Dashboard data missing: confirm Supabase connection and table permissions
- PDF generation failures: ensure jsPDF and autoTable are properly imported
- Subscription access denied: check RLS policies and user roles

**Section sources**
- [analytics.ts:1-170](file://src/lib/analytics.ts#L1-L170)
- [PremiumAnalyticsDashboard.tsx:1-800](file://src/components/PremiumAnalyticsDashboard.tsx#L1-L800)
- [weekly-report-pdf.ts:1-766](file://src/lib/weekly-report-pdf.ts#L1-L766)
- [professional-weekly-report-pdf.ts:1-800](file://src/lib/professional-weekly-report-pdf.ts#L1-L800)
- [nutrio-report-pdf.ts:1-800](file://src/lib/nutrio-report-pdf.ts#L1-L800)
- [20260106192947_e4bf76cd-2db7-4c7a-8d7c-054362aa9a6f.sql:1-48](file://supabase/migrations/20260106192947_e4bf76cd-2db7-4c7a-8d7c-054362aa9a6f.sql#L1-L48)

## Conclusion
The analytics and reporting system combines client-side instrumentation, server-backed data aggregation, and export-ready PDF generation to deliver comprehensive insights. Premium subscriptions enable advanced dashboards and forecasting, while robust privacy controls and RLS policies ensure secure access to sensitive data.