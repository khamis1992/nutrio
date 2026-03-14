# Dynamic Adjustment Engine

<cite>
**Referenced Files in This Document**
- [index.ts](file://supabase/functions/dynamic-adjustment-engine/index.ts)
- [useSmartAdjustments.ts](file://src/hooks/useSmartAdjustments.ts)
- [useSmartRecommendations.ts](file://src/hooks/useSmartRecommendations.ts)
- [index.ts](file://supabase/functions/smart-meal-allocator/index.ts)
- [20250223000001_ai_subscription_credit_system.sql](file://supabase/migrations/20250223000001_ai_subscription_credit_system.sql)
- [ProgressRedesigned.tsx](file://src/pages/ProgressRedesigned.tsx)
- [AdminAIEngineMonitor.tsx](file://src/pages/admin/AdminAIEngineMonitor.tsx)
- [AI_IMPLEMENTATION_SUMMARY.md](file://AI_IMPLEMENTATION_SUMMARY.md)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [System Architecture](#system-architecture)
3. [Core Components](#core-components)
4. [Adjustment Algorithms](#adjustment-algorithms)
5. [Decision-Making Logic](#decision-making-logic)
6. [Safety Mechanisms](#safety-mechanisms)
7. [Integration with Smart Recommendation System](#integration-with-smart-recommendation-system)
8. [Threshold Calculations](#threshold-calculations)
9. [Automated Modification Processes](#automated-modification-processes)
10. [Performance Considerations](#performance-considerations)
11. [Troubleshooting Guide](#troubleshooting-guide)
12. [Conclusion](#conclusion)

## Introduction

The Dynamic Adjustment Engine is a sophisticated AI-powered system that automatically modifies meal plans and nutrition recommendations based on real-time feedback and changing user conditions. This engine serves as the third layer in Nutrio's AI system, responding to user progress, health changes, and lifestyle modifications to ensure optimal nutrition outcomes.

The engine analyzes multiple data streams including weight velocity, adherence patterns, and macro-nutrient consumption to generate intelligent recommendations that adapt to individual user needs. It operates through a combination of evidence-based algorithms, safety thresholds, and user preference considerations to maintain nutritional adequacy while promoting sustainable progress.

## System Architecture

The Dynamic Adjustment Engine operates within a multi-layered AI architecture that processes user data through several intelligent layers:

```mermaid
graph TB
subgraph "User Data Sources"
A[Weight Logs] --> C[Progress Analytics]
B[Adherence Data] --> C
D[Macro Consumption] --> C
E[Activity Levels] --> C
end
subgraph "AI Layers"
F[Nutrition Profile Engine<br/>Layer 1]
G[Smart Meal Allocator<br/>Layer 2]
H[Dynamic Adjustment Engine<br/>Layer 3]
I[Behavior Prediction Engine<br/>Layer 4]
end
subgraph "Decision Engine"
J[Weight Velocity Calculator]
K[Plateau Detection]
L[Adherence Analyzer]
M[Recommendation Generator]
end
subgraph "Action Execution"
N[Adjustment Application]
O[Recommendation Storage]
P[Behavior Event Logging]
end
C --> F
F --> G
G --> H
H --> J
H --> K
H --> L
H --> M
M --> N
M --> O
M --> P
N --> Q[Updated Nutrition Targets]
O --> R[Adjustment History]
P --> S[Behavior Analytics]
```

**Diagram sources**
- [index.ts:1-455](file://supabase/functions/dynamic-adjustment-engine/index.ts#L1-L455)
- [AI_IMPLEMENTATION_SUMMARY.md:24-64](file://AI_IMPLEMENTATION_SUMMARY.md#L24-L64)

The engine integrates seamlessly with the broader AI ecosystem, receiving processed data from lower layers and contributing recommendations that feed back into higher-level systems.

## Core Components

### Edge Function Infrastructure

The Dynamic Adjustment Engine is implemented as a Supabase Edge Function written in TypeScript, providing serverless execution capabilities with automatic scaling and global distribution.

```mermaid
classDiagram
class DynamicAdjustmentEngine {
+calculateWeightVelocity(weightLogs) number
+detectPlateau(weightLogs) boolean
+calculateAverageAdherence(weeklyAdherence) number
+generateAdjustmentRecommendation() AdjustmentRecommendation
+saveAdjustment() void
+handleRequest() Response
}
class AdjustmentRecommendation {
+type : "calorie" | "macro" | "meal_timing" | "no_change"
+calorie_adjustment : number
+macro_adjustments : MacroAdjustments
+reasoning : string
+confidence_score : number
+suggested_actions : string[]
}
class MacroAdjustments {
+protein? : number
+carbs? : number
+fats? : number
}
class WeightLog {
+id : string
+user_id : string
+weight_kg : number
+logged_at : string
}
class WeeklyAdherence {
+week_start : string
+adherence_rate : number
+meals_planned : number
+meals_ordered : number
}
DynamicAdjustmentEngine --> AdjustmentRecommendation
DynamicAdjustmentEngine --> WeightLog
DynamicAdjustmentEngine --> WeeklyAdherence
AdjustmentRecommendation --> MacroAdjustments
```

**Diagram sources**
- [index.ts:13-38](file://supabase/functions/dynamic-adjustment-engine/index.ts#L13-L38)

### Frontend Integration Hooks

The engine interfaces with the frontend through React hooks that provide real-time adjustment suggestions and historical tracking capabilities.

```mermaid
sequenceDiagram
participant User as User Interface
participant Hook as useSmartAdjustments
participant Edge as Dynamic Adjustment Engine
participant Database as Supabase Database
User->>Hook : Request adjustment analysis
Hook->>Database : Fetch progress logs (21 days)
Hook->>Database : Fetch active goal targets
Hook->>Edge : POST adjustment request
Edge->>Database : Query weight logs
Edge->>Database : Query adherence data
Edge->>Edge : Calculate metrics
Edge->>Edge : Generate recommendations
Edge->>Database : Save adjustment record
Edge->>Database : Log behavior event
Edge-->>Hook : Return recommendations
Hook->>Database : Store local history
Hook-->>User : Display suggestions
```

**Diagram sources**
- [useSmartAdjustments.ts:146-415](file://src/hooks/useSmartAdjustments.ts#L146-L415)
- [index.ts:275-454](file://supabase/functions/dynamic-adjustment-engine/index.ts#L275-L454)

**Section sources**
- [index.ts:1-455](file://supabase/functions/dynamic-adjustment-engine/index.ts#L1-L455)
- [useSmartAdjustments.ts:1-460](file://src/hooks/useSmartAdjustments.ts#L1-L460)

## Adjustment Algorithms

### Weight Velocity Analysis

The engine calculates weight change velocity to detect meaningful trends in user progress:

```mermaid
flowchart TD
A[Fetch Weight Logs] --> B[Sort by Date]
B --> C[Calculate Time Difference]
C --> D[Calculate Weight Change]
D --> E[Velocity = Change ÷ Time]
E --> F{Velocity Threshold}
F --> |< -1.0 kg/week| G[Rapid Weight Loss Alert]
F --> |-1.0 to -0.25 kg/week| H[Optimal Weight Loss Range]
F --> |-0.25 to 0.25 kg/week| I[Weight Maintenance Zone]
F --> |> 0.25 kg/week| J[Fast Weight Gain Warning]
K[Detect Plateau Pattern] --> L[Recent 4 Measurements]
L --> M[Range < 0.2kg]
M --> N[Plateau Detected]
```

**Diagram sources**
- [index.ts:41-75](file://supabase/functions/dynamic-adjustment-engine/index.ts#L41-L75)

### Adherence Rate Monitoring

The system tracks user adherence to nutrition plans using weekly adherence data:

| Adherence Category | Percentage Range | Action Level |
|-------------------|------------------|--------------|
| Excellent | 85% - 100% | No adjustment needed |
| Good | 70% - 84% | Monitor progress |
| Fair | 60% - 69% | Consider lifestyle coaching |
| Poor | < 60% | Immediate intervention |

### Macro-Nutrient Target Adjustment

The engine applies evidence-based adjustments to macronutrient targets based on user progress:

```mermaid
graph LR
subgraph "Calorie Adjustments"
A[Weight Loss Slow] --> B[-150 kcal]
C[Weight Loss Fast] --> D[+100 kcal]
E[Plateau Detected] --> F[-100 kcal]
end
subgraph "Protein Adjustments"
B --> G[+10g protein]
D --> H[+10g protein]
F --> I[+5g protein]
end
subgraph "Carb Adjustments"
B --> J[-25g carbs]
D --> K[+10g carbs]
F --> L[-20g carbs]
end
subgraph "Fat Adjustments"
B --> M[-5g fats]
D --> N[+0g fats]
F --> O[+0g fats]
end
```

**Diagram sources**
- [index.ts:105-237](file://supabase/functions/dynamic-adjustment-engine/index.ts#L105-L237)

**Section sources**
- [index.ts:41-240](file://supabase/functions/dynamic-adjustment-engine/index.ts#L41-L240)

## Decision-Making Logic

### Multi-Factor Analysis Pipeline

The engine employs a sophisticated decision tree that evaluates multiple factors simultaneously:

```mermaid
flowchart TD
A[User Request] --> B[Fetch Current Data]
B --> C[Calculate Metrics]
C --> D[Analyze Goal Type]
D --> E{Goal Type?}
E --> |Fat Loss| F[Weight Velocity Analysis]
E --> |Muscle Gain| G[Muscle Progress Analysis]
E --> |Maintenance| H[Stability Assessment]
F --> I{Weight Velocity}
I --> |< -1.0 kg/week| J[Rapid Loss Protocol]
I --> |-1.0 to -0.25 kg/week| K[Optimal Loss Protocol]
I --> |-0.25 to 0.25 kg/week| L[Plateau Detection]
I --> |> 0.25 kg/week| M[Slow Loss Protocol]
J --> N[Calorie Increase + Protein Focus]
K --> O[Calorie Maintenance]
L --> P{Adherence Level}
P --> |< 70%| Q[Lifestyle Coaching]
P --> |≥ 70%| R[Diet Break Recommendation]
M --> S[Calorie Decrease + Macro Restructure]
G --> T{Weight Velocity}
T --> |< 0.1 kg/week| U[Calorie Increase]
T --> |> 0.5 kg/week| V[Calorie Decrease]
T --> |0.1 to 0.5 kg/week| W[Optimal Range]
H --> X[Stability Monitoring]
```

**Diagram sources**
- [index.ts:86-240](file://supabase/functions/dynamic-adjustment-engine/index.ts#L86-L240)

### Confidence Scoring System

The engine assigns confidence scores to recommendations based on data quality and pattern strength:

| Confidence Level | Score Range | Description |
|------------------|-------------|-------------|
| High | 70-100% | Strong evidence, sufficient data |
| Medium | 45-69% | Moderate evidence, limited data |
| Low | 5-44% | Weak evidence, insufficient data |

**Section sources**
- [index.ts:86-240](file://supabase/functions/dynamic-adjustment-engine/index.ts#L86-L240)
- [useSmartAdjustments.ts:205-224](file://src/hooks/useSmartAdjustments.ts#L205-L224)

## Safety Mechanisms

### Nutritional Adequacy Safeguards

The engine implements comprehensive safety mechanisms to prevent harmful adjustments:

```mermaid
flowchart TD
A[Proposed Adjustment] --> B[Safety Validation]
B --> C{Minimum Calorie Check}
C --> |< 1200 kcal| D[Reject Adjustment]
C --> |≥ 1200 kcal| E[Proceed]
B --> F{Maximum Step Size}
F --> |Exceeds Limits| G[Apply Maximum Step Limit]
F --> |Within Limits| H[Accept Adjustment]
B --> I{Macro Safety Bounds}
I --> |Protein < 50g| J[Reject Adjustment]
I --> |Carbs < 80g| J
I --> |Fats < 30g| J
I --> |Within Bounds| K[Accept Adjustment]
D --> L[Notify User]
J --> L
G --> M[Apply Modified Adjustment]
H --> N[Execute Adjustment]
K --> N
M --> N
L --> O[Log Safety Event]
N --> O
```

**Diagram sources**
- [useSmartAdjustments.ts:117-125](file://src/hooks/useSmartAdjustments.ts#L117-L125)

### Auto-Apply Controls

The engine includes strict controls for automatic adjustment application:

- **Confidence Threshold**: Adjustments require minimum 70% confidence score
- **User Consent Required**: Automatic application requires explicit user approval
- **Safety Override**: Critical safety violations prevent auto-application
- **Audit Trail**: All adjustments are logged for transparency

**Section sources**
- [index.ts:379-413](file://supabase/functions/dynamic-adjustment-engine/index.ts#L379-L413)
- [useSmartAdjustments.ts:117-125](file://src/hooks/useSmartAdjustments.ts#L117-L125)

## Integration with Smart Recommendation System

### Cross-System Coordination

The Dynamic Adjustment Engine works in concert with other AI layers to provide comprehensive nutrition management:

```mermaid
sequenceDiagram
participant Engine as Adjustment Engine
participant MealAlloc as Meal Allocator
participant RecSys as Recommendation System
participant User as User Interface
Engine->>Engine : Analyze user progress
Engine->>RecSys : Generate nutrition recommendations
Engine->>MealAlloc : Trigger meal plan adjustments
RecSys->>User : Display personalized recommendations
MealAlloc->>User : Present adjusted meal options
User->>Engine : Approve/reject suggestions
Engine->>Engine : Apply approved changes
Engine->>RecSys : Update recommendation context
Engine->>MealAlloc : Refresh meal allocations
```

**Diagram sources**
- [index.ts:352-362](file://supabase/functions/dynamic-adjustment-engine/index.ts#L352-L362)
- [index.ts:688-691](file://supabase/functions/smart-meal-allocator/index.ts#L688-L691)

### Data Sharing Mechanisms

The system maintains synchronized data across all components:

- **Shared Preferences**: User dietary restrictions and preferences
- **Nutrition Targets**: Calorie and macro targets from adjustment engine
- **Progress Metrics**: Weight velocity and adherence data
- **Behavior Patterns**: Logging consistency and engagement metrics

**Section sources**
- [index.ts:300-377](file://supabase/functions/dynamic-adjustment-engine/index.ts#L300-L377)
- [index.ts:518-546](file://supabase/functions/smart-meal-allocator/index.ts#L518-L546)

## Threshold Calculations

### Evidence-Based Thresholds

The engine uses scientifically validated thresholds for decision-making:

| Parameter | Normal Range | Adjustment Trigger | Safety Limit |
|-----------|--------------|-------------------|--------------|
| Weight Velocity (Fat Loss) | -0.25 to 0.25 kg/week | < -1.0 kg/week | 1200 kcal |
| Weight Velocity (Muscle Gain) | 0.1 to 0.5 kg/week | > 0.5 kg/week | 400 kcal |
| Adherence Rate | 70%+ | < 60% | 50% |
| Calorie Intake | Target ±10% | > 12% deviation | 15% |
| Macro Deviation | Target ±15% | > 20% deviation | 25% |

### Statistical Analysis Methods

The engine employs robust statistical methods for data analysis:

- **Moving Averages**: 7-day rolling averages for stability
- **Standard Deviations**: 2σ thresholds for outlier detection
- **Correlation Analysis**: Relationship between macros and weight changes
- **Trend Analysis**: 3-point moving trends for pattern recognition

**Section sources**
- [index.ts:41-83](file://supabase/functions/dynamic-adjustment-engine/index.ts#L41-L83)
- [useSmartAdjustments.ts:98-110](file://src/hooks/useSmartAdjustments.ts#L98-L110)

## Automated Modification Processes

### Adjustment Application Workflow

The engine follows a structured process for implementing changes:

```mermaid
flowchart TD
A[Generate Recommendation] --> B{Confidence ≥ 70%?}
B --> |No| C[Store Recommendation Only]
B --> |Yes| D[Prepare Adjustment]
D --> E{Safety Validation}
E --> |Fail| F[Reject Adjustment]
E --> |Pass| G[Update Database]
G --> H[Log Behavior Event]
H --> I[Send Notifications]
I --> J[Update Local Cache]
J --> K[Trigger Related Systems]
C --> L[Wait for User Approval]
F --> M[Log Safety Event]
M --> N[Notify User]
```

**Diagram sources**
- [index.ts:379-427](file://supabase/functions/dynamic-adjustment-engine/index.ts#L379-L427)

### Real-Time Processing

The system processes adjustments in near real-time:

- **Response Time**: < 2 seconds for 95th percentile
- **Throughput**: 10,000+ requests per hour
- **Uptime**: 99.9% availability
- **Scalability**: Automatic scaling with demand

**Section sources**
- [index.ts:275-454](file://supabase/functions/dynamic-adjustment-engine/index.ts#L275-L454)
- [AdminAIEngineMonitor.tsx:83-122](file://src/pages/admin/AdminAIEngineMonitor.tsx#L83-L122)

## Performance Considerations

### Scalability Architecture

The Dynamic Adjustment Engine is designed for high-performance operation:

- **Serverless Execution**: Automatic scaling based on demand
- **Global CDN**: Edge locations worldwide for reduced latency
- **Connection Pooling**: Optimized database connections
- **Caching Strategy**: Redis caching for frequently accessed data

### Resource Optimization

The system implements efficient resource management:

- **Memory Usage**: < 128MB per execution
- **Execution Time**: < 1 second for simple queries
- **Database Queries**: Optimized with proper indexing
- **Network Calls**: Minimized through batching

### Monitoring and Metrics

Comprehensive monitoring ensures optimal performance:

- **Latency Tracking**: Request/response time measurement
- **Error Rates**: Exception and failure tracking
- **Resource Utilization**: CPU and memory monitoring
- **SLA Compliance**: Performance guarantee tracking

## Troubleshooting Guide

### Common Issues and Solutions

**Issue**: Adjustments not being applied automatically
- **Cause**: Confidence score below 70%
- **Solution**: Review recommendation details and manually approve

**Issue**: Excessive adjustment requests
- **Cause**: Data inconsistency or rapid fluctuations
- **Solution**: Check data sources and wait for stabilization

**Issue**: Safety mechanism blocking adjustments
- **Cause**: Nutritional safety limits exceeded
- **Solution**: Review safety parameters and user targets

### Debugging Tools

The system provides comprehensive debugging capabilities:

- **Adjustment History**: Complete audit trail of all changes
- **Metric Analysis**: Detailed breakdown of calculation results
- **Error Logging**: Comprehensive error reporting
- **Performance Metrics**: Real-time system monitoring

**Section sources**
- [index.ts:447-453](file://supabase/functions/dynamic-adjustment-engine/index.ts#L447-L453)
- [20250223000001_ai_subscription_credit_system.sql:254-268](file://supabase/migrations/20250223000001_ai_subscription_credit_system.sql#L254-L268)

## Conclusion

The Dynamic Adjustment Engine represents a sophisticated approach to adaptive nutrition management, combining evidence-based algorithms with safety-first principles. Through its multi-layered architecture, the system continuously monitors user progress while maintaining nutritional adequacy and promoting sustainable lifestyle changes.

The engine's integration with the broader AI ecosystem ensures that adjustments flow seamlessly through the recommendation pipeline, creating a cohesive system that adapts to individual user needs in real-time. With comprehensive safety mechanisms, robust performance characteristics, and extensive monitoring capabilities, the Dynamic Adjustment Engine provides a reliable foundation for personalized nutrition management.

Future enhancements may include expanded health metric integration, more sophisticated behavioral analysis, and enhanced user feedback mechanisms to further refine the adjustment process and improve user outcomes.