# Adaptive Goals System

<cite>
**Referenced Files in This Document**
- [ADAPTIVE_GOALS_IMPLEMENTATION_SUMMARY.md](file://ADAPTIVE_GOALS_IMPLEMENTATION_SUMMARY.md)
- [index.ts](file://supabase/functions/adaptive-goals/index.ts)
- [index.ts](file://supabase/functions/adaptive-goals-batch/index.ts)
- [20260221000000_adaptive_goals_system.sql](file://supabase/migrations/20260221000000_adaptive_goals_system.sql)
- [useAdaptiveGoals.ts](file://src/hooks/useAdaptiveGoals.ts)
- [AdaptiveGoalCard.tsx](file://src/components/AdaptiveGoalCard.tsx)
- [WeightPredictionChart.tsx](file://src/components/WeightPredictionChart.tsx)
- [AdaptiveGoalsSettings.tsx](file://src/components/AdaptiveGoalsSettings.tsx)
- [BehaviorPredictionWidget.tsx](file://src/components/BehaviorPredictionWidget.tsx)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [System Architecture](#system-architecture)
3. [Core Components](#core-components)
4. [Behavior Prediction Engine](#behavior-prediction-engine)
5. [AI-Powered Goal Setting Interface](#ai-powered-goal-setting-interface)
6. [Dynamic Adjustment Recommendations](#dynamic-adjustment-recommendations)
7. [Settings Configuration](#settings-configuration)
8. [Integration with Nutrition Tracking](#integration-with-nutrition-tracking)
9. [Edge Functions and Data Pipeline](#edge-functions-and-data-pipeline)
10. [Performance Considerations](#performance-considerations)
11. [Troubleshooting Guide](#troubleshooting-guide)
12. [Conclusion](#conclusion)

## Introduction

The Adaptive Goals System is an AI-powered nutrition recommendation platform that automatically adjusts user nutrition targets based on their actual progress and behavior patterns. This system combines machine learning algorithms with real-time user data to provide personalized nutrition recommendations that evolve as users achieve their goals.

The system operates on a sophisticated three-tier architecture: edge functions for AI analysis, a comprehensive database layer for data persistence, and a React-based frontend for user interaction. It analyzes user eating patterns, activity levels, and health metrics to suggest optimal nutrition targets while maintaining strict safety parameters and user control.

## System Architecture

The Adaptive Goals System follows a modern serverless architecture with Supabase edge functions and PostgreSQL database integration:

```mermaid
graph TB
subgraph "Frontend Layer"
UI[React Components]
Hooks[useAdaptiveGoals Hook]
Cards[AdaptiveGoalCard]
Charts[WeightPredictionChart]
Settings[AdaptiveGoalsSettings]
end
subgraph "Edge Functions Layer"
AF[adaptive-goals Function]
AB[adaptive-goals-batch Function]
BPE[behavior-prediction-engine]
end
subgraph "Data Layer"
DB[(PostgreSQL Database)]
Tables[adaptive_goal_settings]
Tables2[goal_adjustment_history]
Tables3[weekly_adherence]
Tables4[weight_predictions]
Tables5[plateau_events]
end
subgraph "External Services"
Supabase[Supabase Auth]
Storage[Supabase Storage]
end
UI --> Hooks
Hooks --> AF
Hooks --> AB
AF --> DB
AB --> AF
BPE --> DB
DB --> AF
DB --> AB
DB --> BPE
UI --> Cards
UI --> Charts
UI --> Settings
Hooks --> DB
AF --> Supabase
AB --> Supabase
```

**Diagram sources**
- [index.ts:1-522](file://supabase/functions/adaptive-goals/index.ts#L1-L522)
- [index.ts:1-136](file://supabase/functions/adaptive-goals-batch/index.ts#L1-L136)
- [20260221000000_adaptive_goals_system.sql:1-336](file://supabase/migrations/20260221000000_adaptive_goals_system.sql#L1-L336)

## Core Components

### Database Schema Design

The system implements a comprehensive database foundation with five primary tables that work together to provide intelligent goal adjustment capabilities:

```mermaid
erDiagram
ADAPTIVE_GOAL_SETTINGS {
uuid id PK
uuid user_id FK
boolean auto_adjust_enabled
text adjustment_frequency
integer min_calorie_floor
integer max_calorie_ceiling
decimal weight_change_threshold_kg
timestamp created_at
timestamp updated_at
}
GOAL_ADJUSTMENT_HISTORY {
uuid id PK
uuid user_id FK
date adjustment_date
integer previous_calories
integer new_calories
jsonb previous_macros
jsonb new_macros
text reason
decimal weight_change_kg
decimal adherence_rate
boolean plateau_detected
decimal ai_confidence
boolean applied
timestamp created_at
}
WEEKLY_ADHERENCE {
uuid id PK
uuid user_id FK
date week_start
date week_end
integer days_logged
integer days_on_target
integer avg_calories_consumed
integer target_calories
decimal adherence_rate
decimal weight_start
decimal weight_end
decimal weight_change
timestamp created_at
}
WEIGHT_PREDICTIONS {
uuid id PK
uuid user_id FK
date prediction_date
decimal predicted_weight
decimal confidence_lower
decimal confidence_upper
text model_version
decimal actual_weight
decimal accuracy
timestamp created_at
}
PLATEAU_EVENTS {
uuid id PK
uuid user_id FK
date detected_at
integer weeks_without_change
text suggested_action
boolean user_acknowledged
timestamp created_at
}
PROFILES {
uuid user_id PK
date last_goal_adjustment_date
date next_scheduled_adjustment
decimal adherence_rate_last_30_days
integer consecutive_weeks_on_track
integer plateau_weeks
integer ai_suggested_calories
decimal ai_suggestion_confidence
boolean has_unviewed_adjustment
}
ADAPTIVE_GOAL_SETTINGS }o--|| PROFILES : "belongs_to"
GOAL_ADJUSTMENT_HISTORY }o--|| PROFILES : "belongs_to"
WEEKLY_ADHERENCE }o--|| PROFILES : "belongs_to"
WEIGHT_PREDICTIONS }o--|| PROFILES : "belongs_to"
PLATEAU_EVENTS }o--|| PROFILES : "belongs_to"
```

**Diagram sources**
- [20260221000000_adaptive_goals_system.sql:9-336](file://supabase/migrations/20260221000000_adaptive_goals_system.sql#L9-L336)

### Edge Function Architecture

The system utilizes two primary edge functions that work in tandem to provide automated analysis and recommendations:

**Individual Analysis Function (`adaptive-goals`)**: Processes recommendations for individual users based on their progress data and current settings.

**Batch Processing Function (`adaptive-goals-batch`)**: Handles mass processing of all eligible users according to their configured adjustment frequencies.

**Section sources**
- [index.ts:316-522](file://supabase/functions/adaptive-goals/index.ts#L316-L522)
- [index.ts:9-136](file://supabase/functions/adaptive-goals-batch/index.ts#L9-L136)

## Behavior Prediction Engine

The Behavior Prediction Engine extends the adaptive goals system by analyzing user engagement patterns and predicting potential behavioral changes that could impact goal achievement:

```mermaid
sequenceDiagram
participant User as "User Activity"
participant Engine as "Behavior Prediction Engine"
participant DB as "PostgreSQL"
participant Widget as "BehaviorPredictionWidget"
User->>Engine : Activity Data
Engine->>Engine : Analyze Patterns
Engine->>DB : Store Predictions
DB-->>Widget : Real-time Updates
Widget-->>User : AI Insights
Note over Engine,DB : Predicts churn risk, boredom risk,<br/>and engagement scores
```

**Diagram sources**
- [BehaviorPredictionWidget.tsx:1-201](file://src/components/BehaviorPredictionWidget.tsx#L1-L201)

The engine analyzes multiple behavioral indicators including:
- Churn risk assessment (scores > 0.6 trigger alerts)
- Boredom risk detection (meal plan variety patterns)
- Engagement score monitoring (app usage patterns)
- Recommended actions based on prediction severity

**Section sources**
- [BehaviorPredictionWidget.tsx:18-201](file://src/components/BehaviorPredictionWidget.tsx#L18-L201)

## AI-Powered Goal Setting Interface

### AdaptiveGoalCard Component

The AdaptiveGoalCard provides an intuitive interface for displaying AI recommendations with clear visual indicators and actionable controls:

```mermaid
classDiagram
class AdaptiveGoalCard {
+recommendation : AdjustmentRecommendation
+currentCalories : number
+currentProtein : number
+currentCarbs : number
+currentFat : number
+adjustmentId : string
+onApply() : void
+onDismiss() : void
+loading : boolean
-calorieDiff : number
-proteinDiff : number
-carbsDiff : number
-fatDiff : number
+render() : JSX.Element
}
class AdjustmentRecommendation {
+new_calories : number
+new_protein : number
+new_carbs : number
+new_fat : number
+reason : string
+confidence : number
+plateau_detected : boolean
+suggested_action : string
}
AdaptiveGoalCard --> AdjustmentRecommendation : "displays"
```

**Diagram sources**
- [AdaptiveGoalCard.tsx:7-218](file://src/components/AdaptiveGoalCard.tsx#L7-L218)

### WeightPredictionChart Component

The WeightPredictionChart visualizes four-week weight projections with confidence intervals and interactive tooltips:

```mermaid
flowchart TD
Start([User Opens Dashboard]) --> CheckData["Check for Prediction Data"]
CheckData --> HasData{"Has Rich Data?"}
HasData --> |Yes| BuildRich["Build Rich Chart Data"]
HasData --> |No| CheckOld["Check Old Predictions"]
CheckOld --> HasOld{"Has Old Predictions?"}
HasOld --> |Yes| BuildOld["Build from Old Predictions"]
HasOld --> |No| ShowPlaceholder["Show Placeholder"]
BuildRich --> RenderChart["Render Interactive Chart"]
BuildOld --> RenderChart
ShowPlaceholder --> End([End])
RenderChart --> End
```

**Diagram sources**
- [WeightPredictionChart.tsx:40-291](file://src/components/WeightPredictionChart.tsx#L40-L291)

**Section sources**
- [AdaptiveGoalCard.tsx:1-218](file://src/components/AdaptiveGoalCard.tsx#L1-L218)
- [WeightPredictionChart.tsx:1-291](file://src/components/WeightPredictionChart.tsx#L1-L291)

## Dynamic Adjustment Recommendations

### Smart Scenarios Implementation

The system implements seven intelligent scenarios that trigger automatic calorie adjustments based on user progress patterns:

| Scenario | Trigger Condition | Action | Confidence Level |
|----------|-------------------|--------|------------------|
| **Plateau Detection** | 3+ consecutive weeks no weight change | ±100-150 calorie adjustment | 85% |
| **Rapid Weight Loss** | >1kg/week weight loss | +150 calories | 80% |
| **Slow Weight Loss** | <0.25kg/week weight loss | -100 calories | 75% |
| **Rapid Muscle Gain** | >1kg/week weight gain during bulking | -100 calories | 80% |
| **Low Adherence** | <50% tracking consistency | No changes | 60% |
| **Goal Achievement** | Current weight ≤ target weight | Switch to maintenance (+10%) | 95% |
| **Optimal Progress** | On-track weight loss/gain | No changes | 90% |

### Recommendation Generation Algorithm

The AI analysis engine processes user data through a multi-stage decision tree:

```mermaid
flowchart TD
UserData["Collect User Data"] --> AnalyzeTrends["Analyze Weight Trends"]
AnalyzeTrends --> CheckAdherence["Check Adherence Rate"]
CheckAdherence --> LowAdherence{"< 50% Adherence?"}
LowAdherence --> |Yes| NoChange["No Changes - Focus on Tracking"]
LowAdherence --> |No| CheckScenarios["Check All Scenarios"]
CheckScenarios --> Plateau{"3+ Week Plateau?"}
Plateau --> |Yes| PlateauAction["±100-150 Calorie Adjustment"]
Plateau --> |No| RapidLoss{">1kg/Week Loss?"}
RapidLoss --> |Yes| RapidAction["+150 Calories"]
RapidLoss --> |No| SlowLoss{"<0.25kg/Week Loss?"}
SlowLoss --> |Yes| SlowAction["-100 Calories"]
SlowLoss --> |No| RapidGain{">1kg/Week Gain?"}
RapidGain --> |Yes| GainAction["-100 Calories"]
RapidGain --> |No| GoalAchieved{"Goal Achieved?"}
GoalAchieved --> |Yes| Maintenance["+10% Maintenance Calories"]
GoalAchieved --> |No| Optimal["Optimal Progress - No Changes"]
PlateauAction --> SafetyCheck["Safety & Compliance Check"]
RapidAction --> SafetyCheck
SlowAction --> SafetyCheck
GainAction --> SafetyCheck
Maintenance --> SafetyCheck
NoChange --> End([Recommendation Generated])
Optimal --> SafetyCheck
SafetyCheck --> End
```

**Diagram sources**
- [index.ts:52-227](file://supabase/functions/adaptive-goals/index.ts#L52-L227)

**Section sources**
- [index.ts:42-227](file://supabase/functions/adaptive-goals/index.ts#L42-L227)
- [ADAPTIVE_GOALS_IMPLEMENTATION_SUMMARY.md:39-58](file://ADAPTIVE_GOALS_IMPLEMENTATION_SUMMARY.md#L39-L58)

## Settings Configuration

### AdaptiveGoalsSettings Component

The settings interface provides comprehensive control over the adaptive goals system:

```mermaid
classDiagram
class AdaptiveGoalsSettings {
+settings : AdaptiveGoalSettings
+adjustmentHistory : AdjustmentHistoryItem[]
+settingsLoading : boolean
+historyLoading : boolean
+updateSettings() : Promise<boolean>
}
class AdaptiveGoalSettings {
+auto_adjust_enabled : boolean
+adjustment_frequency : 'weekly' | 'biweekly' | 'monthly'
+min_calorie_floor : number
+max_calorie_ceiling : number
}
class AdjustmentHistoryItem {
+id : string
+adjustment_date : string
+previous_calories : number
+new_calories : number
+reason : string
+weight_change_kg : number
+adherence_rate : number
+plateau_detected : boolean
+ai_confidence : number
+applied : boolean
}
AdaptiveGoalsSettings --> AdaptiveGoalSettings : "manages"
AdaptiveGoalsSettings --> AdjustmentHistoryItem : "displays"
```

**Diagram sources**
- [AdaptiveGoalsSettings.tsx:16-180](file://src/components/AdaptiveGoalsSettings.tsx#L16-L180)

### Configuration Options

The system provides granular control through several key settings:

**Auto-Adjustment Controls**:
- Enable/disable automatic goal adjustments
- Configure adjustment frequency (weekly/biweekly/monthly)
- Set minimum and maximum calorie limits (1200-4000)

**Safety Parameters**:
- Weight change thresholds for plateau detection
- Confidence level requirements for recommendations
- Adherence rate minimums before suggesting changes

**Personalization Preferences**:
- Health goal alignment (lose/gain/maintain)
- Individual user preferences for adjustment aggressiveness
- Historical data retention periods

**Section sources**
- [AdaptiveGoalsSettings.tsx:1-180](file://src/components/AdaptiveGoalsSettings.tsx#L1-L180)
- [20260221000000_adaptive_goals_system.sql:9-20](file://supabase/migrations/20260221000000_adaptive_goals_system.sql#L9-L20)

## Integration with Nutrition Tracking

### Frontend Integration Pattern

The adaptive goals system integrates seamlessly with the existing nutrition tracking infrastructure:

```mermaid
sequenceDiagram
participant Dashboard as "Dashboard"
participant Hook as "useAdaptiveGoals"
participant Function as "adaptive-goals Function"
participant DB as "PostgreSQL"
participant UI as "AdaptiveGoalCard"
Dashboard->>Hook : Initialize
Hook->>Function : Fetch Recommendation (Dry Run)
Function->>DB : Query User Data
DB-->>Function : Progress Data
Function-->>Hook : AI Recommendation
Hook-->>UI : Render Card
UI-->>Dashboard : Display Recommendation
Note over Dashboard,UI : Real-time Updates & User Interaction
```

**Diagram sources**
- [useAdaptiveGoals.ts:136-178](file://src/hooks/useAdaptiveGoals.ts#L136-L178)

### Data Flow Integration

The system maintains bidirectional data flow between the AI engine and user interface:

**Incoming Data Flow**:
- User weight logs from progress tracking
- Calorie consumption data from meal logging
- Adherence metrics from tracking consistency
- Profile information from user settings

**Outgoing Data Flow**:
- AI-generated recommendations with confidence scores
- Four-week weight predictions with confidence intervals
- Adjustment history for audit trails
- Safety notifications for significant changes

**Section sources**
- [useAdaptiveGoals.ts:1-407](file://src/hooks/useAdaptiveGoals.ts#L1-L407)
- [ADAPTIVE_GOALS_IMPLEMENTATION_SUMMARY.md:108-133](file://ADAPTIVE_GOALS_IMPLEMENTATION_SUMMARY.md#L108-L133)

## Edge Functions and Data Pipeline

### Individual Analysis Pipeline

The adaptive-goals edge function processes user data through a comprehensive analysis pipeline:

```mermaid
flowchart TD
Request["Function Request"] --> ValidateUser["Validate User ID"]
ValidateUser --> CheckSettings["Check Adaptive Settings"]
CheckSettings --> FetchProfile["Fetch Profile Data"]
FetchProfile --> FetchWeightLogs["Fetch Weight Logs (12 weeks)"]
FetchWeightLogs --> FetchCalorieLogs["Fetch Calorie Logs (4 weeks)"]
FetchCalorieLogs --> StoreAdherence["Store Weekly Adherence"]
StoreAdherence --> CalculateStats["Calculate Progress Statistics"]
CalculateStats --> AnalyzeProgress["Run AI Analysis"]
AnalyzeProgress --> GenerateRecommendation["Generate Recommendation"]
GenerateRecommendation --> StoreHistory["Store Adjustment History"]
StoreHistory --> StorePredictions["Store Weight Predictions"]
StorePredictions --> UpdateProfile["Update User Profile"]
UpdateProfile --> CreateEvent["Create Plateau Event"]
CreateEvent --> Response["Return Response"]
Response --> End([Function Complete])
```

**Diagram sources**
- [index.ts:316-522](file://supabase/functions/adaptive-goals/index.ts#L316-L522)

### Batch Processing Pipeline

The adaptive-goals-batch function orchestrates mass processing of user accounts:

```mermaid
sequenceDiagram
participant Scheduler as "Cron Job"
participant BatchFunc as "Batch Function"
participant UserDB as "Profiles Table"
participant IndFunc as "Individual Function"
participant Results as "Results Tracking"
Scheduler->>BatchFunc : Trigger Analysis
BatchFunc->>UserDB : Fetch Active Users
UserDB-->>BatchFunc : User List
BatchFunc->>BatchFunc : Check Adjustment Due
BatchFunc->>IndFunc : Call Individual Analysis
IndFunc-->>BatchFunc : Analysis Result
BatchFunc->>Results : Update Metrics
BatchFunc-->>Scheduler : Batch Complete
Note over BatchFunc,Results : Processes 100+ users<br/>with rate limiting
```

**Diagram sources**
- [index.ts:9-136](file://supabase/functions/adaptive-goals-batch/index.ts#L9-L136)

### Data Validation and Safety

The system implements comprehensive safety measures:

**Input Validation**:
- User ID verification and authentication
- Data completeness checks for required fields
- Timestamp validation for log entries
- Range validation for numeric values

**Output Safety**:
- Calorie limit enforcement (1200-4000)
- Macro distribution validation
- Confidence threshold filtering
- Duplicate prevention mechanisms

**Section sources**
- [index.ts:316-522](file://supabase/functions/adaptive-goals/index.ts#L316-L522)
- [index.ts:9-136](file://supabase/functions/adaptive-goals-batch/index.ts#L9-L136)

## Performance Considerations

### Scalability Optimizations

The system implements several performance optimizations:

**Database Efficiency**:
- Indexed queries on frequently accessed columns
- Efficient aggregation functions for statistics
- Batch operations for reduced network overhead
- Connection pooling for edge function scalability

**Edge Function Performance**:
- Minimal cold start impact through optimized imports
- Caching strategies for repeated user data
- Asynchronous processing for non-critical operations
- Error handling to prevent cascading failures

**Frontend Optimization**:
- Lazy loading for heavy chart components
- Memoization for expensive calculations
- Debounced API calls for user interactions
- Progressive loading for large datasets

### Monitoring and Metrics

The system tracks key performance indicators:

**Processing Metrics**:
- Function execution time per user
- Database query performance
- Memory usage patterns
- Error rates and retry counts

**User Experience Metrics**:
- Recommendation acceptance rates
- User engagement with suggestions
- Feature adoption rates
- Support ticket volume

## Troubleshooting Guide

### Common Issues and Solutions

**Edge Function Deployment Issues**:
- Verify Supabase service role key configuration
- Check function availability before API calls
- Monitor CORS policy settings
- Validate environment variable configuration

**Data Integration Problems**:
- Confirm user profile completion status
- Verify progress log data integrity
- Check adherence calculation accuracy
- Validate weight measurement consistency

**Recommendation Accuracy**:
- Review adherence rate thresholds
- Analyze weight change calculation methods
- Check macro redistribution algorithms
- Validate confidence scoring mechanisms

### Debugging Tools

**Development Tools**:
- Console logging for edge function debugging
- Database query analysis for performance tuning
- Frontend state inspection for component debugging
- Network monitoring for API call tracking

**Production Monitoring**:
- Error tracking for edge function failures
- Database performance monitoring
- User feedback collection systems
- A/B testing for recommendation effectiveness

**Section sources**
- [useAdaptiveGoals.ts:136-178](file://src/hooks/useAdaptiveGoals.ts#L136-L178)
- [index.ts:514-521](file://supabase/functions/adaptive-goals/index.ts#L514-L521)

## Conclusion

The Adaptive Goals System represents a comprehensive solution for intelligent nutrition goal management. By combining sophisticated AI algorithms with robust data infrastructure and intuitive user interfaces, the system provides personalized nutrition recommendations that adapt to individual progress patterns.

Key achievements include:

**Technical Excellence**:
- Serverless architecture with scalable edge functions
- Comprehensive database design supporting complex analytics
- Real-time data processing and user notifications
- Extensive safety measures and error handling

**User Experience**:
- Intuitive recommendation cards with clear explanations
- Visual prediction charts for progress tracking
- Flexible settings for personal customization
- Seamless integration with existing nutrition tracking

**Business Impact**:
- Improved user retention through personalized engagement
- Enhanced goal achievement rates through adaptive recommendations
- Reduced manual intervention requirements
- Scalable architecture supporting rapid growth

The system provides a solid foundation for future enhancements including advanced machine learning models, expanded behavioral insights, and integration with additional health metrics. Its modular design ensures continued evolution while maintaining system stability and user trust.