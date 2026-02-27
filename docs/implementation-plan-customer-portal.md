# Customer Portal Workflow Optimization - Implementation Plan

## Executive Summary

**Goal**: Transform the Customer Portal from a 6.5/10 experience to a 9/10 experience by addressing critical UX gaps in onboarding, subscription conversion, and order tracking.

**Timeline**: 90 days (3 sprints)
**Total Effort**: ~40 developer-days
**Expected ROI**: 40% reduction in support tickets, 25% increase in subscription conversion

---

## Phase 1: Critical Fixes (30 Days)

### 1.1 Onboarding Experience Overhaul

#### 1.1.1 Add Progress Indicator with Percentage

**File**: `src/pages/Onboarding.tsx`

**Current State**: Step dots only, no percentage or progress bar

**Implementation**:

```tsx
// Add at top of Onboarding.tsx after imports
const ONBOARDING_STEPS = [
  { id: 'goal', label: 'Your Goal', icon: Target },
  { id: 'gender', label: 'Gender', icon: User },
  { id: 'metrics', label: 'Body Metrics', icon: Scale },
  { id: 'activity', label: 'Activity Level', icon: Activity },
  { id: 'diet', label: 'Dietary Preferences', icon: Apple },
];

// Replace current step indicator with:
<div className="mb-8">
  <div className="flex items-center justify-between mb-2">
    <span className="text-sm text-muted-foreground">Step {currentStep} of 5</span>
    <span className="text-sm font-medium text-primary">{Math.round((currentStep / 5) * 100)}% Complete</span>
  </div>
  <Progress value={(currentStep / 5) * 100} className="h-2" />
  <div className="flex justify-between mt-4">
    {ONBOARDING_STEPS.map((step, idx) => (
      <div key={step.id} className="flex flex-col items-center">
        <div className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center transition-all",
          idx < currentStep ? "bg-primary text-primary-foreground" :
          idx === currentStep ? "bg-primary/20 text-primary border-2 border-primary" :
          "bg-muted text-muted-foreground"
        )}>
          {idx < currentStep ? <Check className="h-5 w-5" /> : <step.icon className="h-5 w-5" />}
        </div>
        <span className="text-xs mt-1 hidden sm:block">{step.label}</span>
      </div>
    ))}
  </div>
</div>
```

**Dependencies**: Import `Progress` from `@/components/ui/progress`

---

#### 1.1.2 Add "Skip for Now" Option

**File**: `src/pages/Onboarding.tsx`

**Implementation**:

```tsx
// Add skip handler
const handleSkip = async () => {
  // Save minimal profile data
  const { error } = await updateProfile({
    onboarding_completed: true,
    full_name: user?.user_metadata?.full_name || null,
  });
  
  if (!error) {
    toast.success("You can complete your profile anytime in Settings");
    navigate('/dashboard');
  }
};

// Add to UI after the main CTA button:
<div className="mt-4 text-center">
  <Button 
    variant="ghost" 
    onClick={handleSkip}
    className="text-muted-foreground hover:text-foreground"
  >
    Skip for now — I'll set up later
  </Button>
  <p className="text-xs text-muted-foreground mt-1">
    You can always update your preferences in Settings
  </p>
</div>
```

**Note**: Users who skip should see a "Complete Your Profile" banner on dashboard

---

#### 1.1.3 Auto-Save Progress with Recovery

**File**: `src/pages/Onboarding.tsx`

**Implementation**:

```tsx
// Add auto-save hook
const AUTOSAVE_KEY = 'nutrio_onboarding_draft';

const saveDraft = useCallback(
  debounce((data: Partial<OnboardingData>) => {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({
      data,
      currentStep,
      savedAt: new Date().toISOString(),
    }));
  }, 500),
  [currentStep]
);

// Load draft on mount
useEffect(() => {
  const draft = localStorage.getItem(AUTOSAVE_KEY);
  if (draft) {
    const { data: draftData, savedAt, currentStep: savedStep } = JSON.parse(draft);
    const hoursSinceSave = (Date.now() - new Date(savedAt).getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceSave < 24) { // Only recover if less than 24 hours old
      setShowRecoveryDialog(true);
      setDraftData({ data: draftData, step: savedStep, savedAt });
    }
  }
}, []);

// Recovery dialog component
<AlertDialog open={showRecoveryDialog} onOpenChange={setShowRecoveryDialog}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Continue where you left off?</AlertDialogTitle>
      <AlertDialogDescription>
        We found a saved draft from {formatDistanceToNow(new Date(draftData.savedAt))} ago.
        Would you like to continue or start fresh?
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel onClick={() => {
        localStorage.removeItem(AUTOSAVE_KEY);
        setShowRecoveryDialog(false);
      }}>
        Start Fresh
      </AlertDialogCancel>
      <AlertDialogAction onClick={() => {
        setOnboardingData(draftData.data);
        setCurrentStep(draftData.step);
        setShowRecoveryDialog(false);
      }}>
        Continue
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

---

#### 1.1.4 Break Step 3 into Sub-steps

**File**: `src/pages/Onboarding.tsx`

**Problem**: Step 3 (Body Metrics) requires 4 inputs and causes highest drop-off

**Implementation**:

```tsx
// Split metrics into two sub-steps
const METRICS_SUB_STEPS = ['basic', 'targets'];

// In Step 3 render:
{currentStep === 3 && (
  <div>
    {metricsSubStep === 'basic' && (
      <div className="space-y-6 animate-in fade-in-50 duration-200">
        <h3 className="text-lg font-medium">Let's get to know you</h3>
        <div className="grid grid-cols-2 gap-4">
          <FormField name="age" label="Age" type="number" />
          <FormField name="gender" label="Gender" type="select" options={['male', 'female']} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField name="height_cm" label="Height (cm)" type="number" />
          <FormField name="current_weight_kg" label="Current Weight (kg)" type="number" />
        </div>
        <Button onClick={() => setMetricsSubStep('targets')}>
          Continue
        </Button>
      </div>
    )}
    
    {metricsSubStep === 'targets' && (
      <div className="space-y-6 animate-in fade-in-50 duration-200">
        <h3 className="text-lg font-medium">What's your target weight?</h3>
        <FormField 
          name="target_weight_kg" 
          label="Target Weight (kg)" 
          type="number"
          hint={`${onboardingData.health_goal === 'lose' ? 'We recommend losing 0.5-1kg per week' : 'Healthy weight gain takes time'}`}
        />
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setMetricsSubStep('basic')}>
            Back
          </Button>
          <Button onClick={handleNextStep}>
            Continue
          </Button>
        </div>
      </div>
    )}
  </div>
)}
```

---

### 1.2 Subscription Conversion Improvements

#### 1.2.1 Soft Gate with Value Proposition

**File**: `src/components/SubscriptionGate.tsx` (NEW FILE)

**Purpose**: Replace hard gate with soft gate that shows value

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Sparkles, ArrowRight, X } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';

interface SubscriptionGateProps {
  onDismiss?: () => void;
  showDismiss?: boolean;
  context?: 'meal' | 'schedule' | 'tracking';
}

const VALUE_PROPS = {
  meal: {
    title: 'Unlock This Meal',
    description: 'Join thousands in Qatar achieving their health goals',
    benefits: ['Schedule this meal for delivery', 'Track your nutrition automatically', 'Get personalized meal recommendations'],
  },
  schedule: {
    title: 'Start Your Meal Plan',
    description: 'Healthy eating made easy with scheduled deliveries',
    benefits: ['Flexible weekly meal scheduling', 'Pause or skip anytime', 'Unused meals roll over'],
  },
  tracking: {
    title: 'Track Your Progress',
    description: 'See real results with our nutrition tracking',
    benefits: ['Daily calorie & macro tracking', 'Weight progress visualization', 'Weekly reports delivered to inbox'],
  },
};

export function SubscriptionGate({ onDismiss, showDismiss = true, context = 'meal' }: SubscriptionGateProps) {
  const navigate = useNavigate();
  const { hasActiveSubscription } = useSubscription();
  const props = VALUE_PROPS[context];

  if (hasActiveSubscription) return null;

  return (
    <Card className="border-primary/20 shadow-lg">
      <CardHeader className="text-center pb-2">
        {showDismiss && onDismiss && (
          <Button variant="ghost" size="icon" className="absolute right-2 top-2" onClick={onDismiss}>
            <X className="h-4 w-4" />
          </Button>
        )}
        <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="text-xl">{props.title}</CardTitle>
        <CardDescription>{props.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {props.benefits.map((benefit, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
              <Check className="h-3 w-3 text-primary" />
            </div>
            <span className="text-sm">{benefit}</span>
          </div>
        ))}
      </CardContent>
      <CardFooter className="flex-col gap-2">
        <Button className="w-full" onClick={() => navigate('/subscription')}>
          View Plans <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          Plans start at <strong>215 QAR/month</strong> • Cancel anytime
        </p>
      </CardFooter>
    </Card>
  );
}
```

---

#### 1.2.2 Subscription Quiz/Wizard

**File**: `src/components/SubscriptionWizard.tsx` (NEW FILE)

**Purpose**: 3-question quiz to recommend best plan

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Check, ArrowRight, ArrowLeft, Sparkles } from 'lucide-react';

const QUESTIONS = [
  {
    id: 'meals_per_day',
    question: 'How many meals do you want delivered per day?',
    options: [
      { value: '1', label: '1 meal', plan: 'basic' },
      { value: '2', label: '2 meals', plan: 'standard' },
      { value: '3', label: '3 meals', plan: 'premium' },
      { value: 'unlimited', label: 'Varies / Flexible', plan: 'vip' },
    ],
  },
  {
    id: 'commitment',
    question: 'How committed are you to your health goals?',
    options: [
      { value: 'exploring', label: 'Just exploring', plan: 'basic' },
      { value: 'moderate', label: 'Moderately committed', plan: 'standard' },
      { value: 'serious', label: 'Very committed', plan: 'premium' },
      { value: 'all_in', label: 'All in - I want a coach', plan: 'vip' },
    ],
  },
  {
    id: 'features',
    question: 'What matters most to you?',
    options: [
      { value: 'price', label: 'Best value for money', plan: 'basic' },
      { value: 'variety', label: 'Wide restaurant variety', plan: 'standard' },
      { value: 'coaching', label: 'Personal coaching & support', plan: 'premium' },
      { value: 'premium', label: 'Premium experience & priority', plan: 'vip' },
    ],
  },
];

const PLAN_DETAILS = {
  basic: { name: 'Basic', price: 215, meals: 22, highlight: 'Best for trying out' },
  standard: { name: 'Standard', price: 430, meals: 43, highlight: 'Most popular' },
  premium: { name: 'Premium', price: 645, meals: 65, highlight: 'Best value' },
  vip: { name: 'VIP', price: 860, meals: 'Unlimited', highlight: 'Premium experience' },
};

export function SubscriptionWizard() {
  const navigate = useNavigate();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const handleAnswer = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleNext = () => {
    if (currentQuestion < QUESTIONS.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(prev => prev - 1);
    }
  };

  // Calculate recommended plan
  const getRecommendedPlan = () => {
    const planScores: Record<string, number> = { basic: 0, standard: 0, premium: 0, vip: 0 };
    
    Object.entries(answers).forEach(([questionId, answer]) => {
      const question = QUESTIONS.find(q => q.id === questionId);
      const option = question?.options.find(o => o.value === answer);
      if (option) {
        planScores[option.plan]++;
      }
    });

    const maxScore = Math.max(...Object.values(planScores));
    const recommendedPlan = Object.entries(planScores).find(([_, score]) => score === maxScore)?.[0] || 'standard';
    
    return recommendedPlan as keyof typeof PLAN_DETAILS;
  };

  const currentQ = QUESTIONS[currentQuestion];
  const isLastQuestion = currentQuestion === QUESTIONS.length - 1;
  const recommendedPlan = getRecommendedPlan();
  const planDetail = PLAN_DETAILS[recommendedPlan];

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">Question {currentQuestion + 1} of {QUESTIONS.length}</span>
          <div className="flex gap-1">
            {QUESTIONS.map((_, idx) => (
              <div key={idx} className={`h-2 w-6 rounded-full ${idx <= currentQuestion ? 'bg-primary' : 'bg-muted'}`} />
            ))}
          </div>
        </div>
        <CardTitle>{currentQ.question}</CardTitle>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={answers[currentQ.id] || ''}
          onValueChange={(value) => handleAnswer(currentQ.id, value)}
          className="space-y-3"
        >
          {currentQ.options.map((option) => (
            <div key={option.value} className="flex items-center space-x-3">
              <RadioGroupItem value={option.value} id={option.value} />
              <Label htmlFor={option.value} className="flex-1 cursor-pointer">
                {option.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </CardContent>
      <CardFooter className="justify-between">
        <Button variant="ghost" onClick={handleBack} disabled={currentQuestion === 0}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        {isLastQuestion ? (
          <Button onClick={() => navigate(`/subscription?recommended=${recommendedPlan}`)}>
            See My Plan <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleNext} disabled={!answers[currentQ.id]}>
            Next <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

// Result component to show on subscription page
export function RecommendedPlanBanner({ plan }: { plan: keyof typeof PLAN_DETAILS }) {
  const details = PLAN_DETAILS[plan];
  
  return (
    <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg p-4 mb-6">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <span className="font-medium">Recommended for You</span>
        <Badge variant="secondary">{details.highlight}</Badge>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-2xl font-bold">{details.name}</p>
          <p className="text-sm text-muted-foreground">{details.meals} meals/month • {details.price} QAR</p>
        </div>
        <Button>Select This Plan</Button>
      </div>
    </div>
  );
}
```

---

#### 1.2.3 Quota Warning Banner

**File**: `src/components/QuotaWarningBanner.tsx` (NEW FILE)

```tsx
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useSubscription } from '@/hooks/useSubscription';
import { useNavigate } from 'react-router-dom';

export function QuotaWarningBanner() {
  const navigate = useNavigate();
  const { remainingMeals, totalMeals, isUnlimited, hasActiveSubscription } = useSubscription();

  if (!hasActiveSubscription || isUnlimited) return null;

  const usagePercent = ((totalMeals - remainingMeals) / totalMeals) * 100;
  
  if (usagePercent < 75) return null; // Only show at 75%+ usage

  const isExhausted = remainingMeals === 0;

  return (
    <Alert variant={isExhausted ? 'destructive' : 'warning'} className="mb-4">
      {isExhausted ? (
        <AlertTriangle className="h-4 w-4" />
      ) : (
        <CheckCircle className="h-4 w-4" />
      )}
      <AlertTitle>
        {isExhausted ? 'Meal Quota Exhausted' : `${remainingMeals} Meals Remaining`}
      </AlertTitle>
      <AlertDescription className="flex items-center justify-between">
        <span>
          {isExhausted
            ? "You've used all your meals for this period. Upgrade or wait for renewal."
            : `You've used ${usagePercent.toFixed(0)}% of your monthly meals.`}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/subscription')}>
            {isExhausted ? 'Upgrade Plan' : 'View Options'}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
```

---

### 1.3 Order Tracking Unification

#### 1.3.1 Unified Order Status Constants

**File**: `src/lib/constants/order-status.ts` (NEW FILE)

```ts
// Unified order status definitions
export const ORDER_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  PREPARING: 'preparing',
  READY: 'ready',
  OUT_FOR_DELIVERY: 'out_for_delivery',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
} as const;

export type OrderStatus = typeof ORDER_STATUS[keyof typeof ORDER_STATUS];

export const ORDER_STATUS_CONFIG: Record<OrderStatus, {
  label: string;
  description: string;
  icon: string;
  color: string;
  customerVisible: boolean;
}> = {
  [ORDER_STATUS.PENDING]: {
    label: 'Order Placed',
    description: 'Waiting for restaurant confirmation',
    icon: 'Package',
    color: 'bg-yellow-500',
    customerVisible: true,
  },
  [ORDER_STATUS.CONFIRMED]: {
    label: 'Confirmed',
    description: 'Restaurant has accepted your order',
    icon: 'CheckCircle2',
    color: 'bg-blue-500',
    customerVisible: true,
  },
  [ORDER_STATUS.PREPARING]: {
    label: 'Preparing',
    description: 'Your meal is being prepared',
    icon: 'ChefHat',
    color: 'bg-orange-500',
    customerVisible: true,
  },
  [ORDER_STATUS.READY]: {
    label: 'Ready for Pickup',
    description: 'Waiting for driver assignment',
    icon: 'Box',
    color: 'bg-purple-500',
    customerVisible: true,
  },
  [ORDER_STATUS.OUT_FOR_DELIVERY]: {
    label: 'Out for Delivery',
    description: 'Your driver is on the way',
    icon: 'Truck',
    color: 'bg-indigo-500',
    customerVisible: true,
  },
  [ORDER_STATUS.DELIVERED]: {
    label: 'Delivered',
    description: 'Enjoy your meal!',
    icon: 'CheckCheck',
    color: 'bg-green-500',
    customerVisible: true,
  },
  [ORDER_STATUS.CANCELLED]: {
    label: 'Cancelled',
    description: 'This order was cancelled',
    icon: 'XCircle',
    color: 'bg-red-500',
    customerVisible: true,
  },
};

// Status progression for timeline
export const ORDER_TIMELINE = [
  ORDER_STATUS.PENDING,
  ORDER_STATUS.CONFIRMED,
  ORDER_STATUS.PREPARING,
  ORDER_STATUS.READY,
  ORDER_STATUS.OUT_FOR_DELIVERY,
  ORDER_STATUS.DELIVERED,
];

export const getStatusIndex = (status: OrderStatus): number => {
  return ORDER_TIMELINE.indexOf(status);
};

export const isStatusPast = (currentStatus: OrderStatus, checkStatus: OrderStatus): boolean => {
  return getStatusIndex(currentStatus) > getStatusIndex(checkStatus);
};

export const isStatusCurrent = (currentStatus: OrderStatus, checkStatus: OrderStatus): boolean => {
  return currentStatus === checkStatus;
};

export const getNextStatus = (currentStatus: OrderStatus): OrderStatus | null => {
  const currentIndex = getStatusIndex(currentStatus);
  if (currentIndex === -1 || currentIndex >= ORDER_TIMELINE.length - 1) return null;
  return ORDER_TIMELINE[currentIndex + 1];
};

export const getEstimatedTimeForStatus = (status: OrderStatus): string => {
  const estimates: Record<OrderStatus, string> = {
    [ORDER_STATUS.PENDING]: '5-10 min for confirmation',
    [ORDER_STATUS.CONFIRMED]: '15-25 min for preparation',
    [ORDER_STATUS.PREPARING]: '10-20 min remaining',
    [ORDER_STATUS.READY]: '5-10 min for driver pickup',
    [ORDER_STATUS.OUT_FOR_DELIVERY]: '15-30 min for delivery',
    [ORDER_STATUS.DELIVERED]: '',
    [ORDER_STATUS.CANCELLED]: '',
  };
  return estimates[status] || '';
};
```

---

#### 1.3.2 Order Tracking Hub Component

**File**: `src/components/OrderTrackingHub.tsx` (NEW FILE)

```tsx
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, MapPin, Clock, ChefHat, Truck, CheckCheck, ChevronRight, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ORDER_STATUS, ORDER_STATUS_CONFIG, type OrderStatus } from '@/lib/constants/order-status';

interface ActiveOrder {
  id: string;
  restaurant_name: string;
  restaurant_logo: string;
  status: OrderStatus;
  delivery_date: string;
  meal_type: string;
  meal_name: string;
  driver_name?: string;
  driver_phone?: string;
  estimated_arrival?: string;
}

export function OrderTrackingHub() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchActiveOrders = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('meal_schedules')
      .select(`
        id,
        scheduled_date,
        meal_type,
        order_status,
        meals (name, restaurants (name, logo_url)),
        delivery_jobs (driver_id, drivers (full_name, phone))
      `)
      .eq('user_id', user.id)
      .in('order_status', ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery'])
      .order('scheduled_date', { ascending: true });

    if (!error && data) {
      setActiveOrders(data.map(order => ({
        id: order.id,
        restaurant_name: order.meals?.restaurants?.name || 'Unknown',
        restaurant_logo: order.meals?.restaurants?.logo_url || '',
        status: order.order_status as OrderStatus,
        delivery_date: order.scheduled_date,
        meal_type: order.meal_type,
        meal_name: order.meals?.name || 'Unknown meal',
        driver_name: order.delivery_jobs?.[0]?.drivers?.full_name,
        driver_phone: order.delivery_jobs?.[0]?.drivers?.phone,
      })));
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchActiveOrders();
  }, [user]);

  // Real-time subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('order-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'meal_schedules',
          filter: `user_id=eq.${user.id}`,
        },
        () => fetchActiveOrders()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchActiveOrders();
  };

  const getStatusIcon = (status: OrderStatus) => {
    const icons: Record<string, typeof Package> = {
      pending: Package,
      confirmed: CheckCheck,
      preparing: ChefHat,
      ready: Package,
      out_for_delivery: Truck,
      delivered: CheckCheck,
    };
    const Icon = icons[status] || Package;
    return <Icon className="h-5 w-5" />;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
          <p className="text-muted-foreground">Loading your orders...</p>
        </CardContent>
      </Card>
    );
  }

  if (activeOrders.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            No Active Orders
          </CardTitle>
          <CardDescription>
            You don't have any orders being prepared right now.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => navigate('/meals')}>
            Browse Meals <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Active Orders ({activeOrders.length})
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {activeOrders.map((order) => {
          const statusConfig = ORDER_STATUS_CONFIG[order.status];
          
          return (
            <Link
              key={order.id}
              to={`/tracking?id=${order.id}`}
              className="block"
            >
              <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                <div className={`h-12 w-12 rounded-full ${statusConfig.color} flex items-center justify-center text-white`}>
                  {getStatusIcon(order.status)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{order.meal_name}</p>
                    <Badge variant="outline" className="text-xs">{order.meal_type}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{order.restaurant_name}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {statusConfig.label} • {statusConfig.description}
                    </span>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </Link>
          );
        })}
        
        <Button variant="outline" className="w-full" onClick={() => navigate('/orders')}>
          View All Orders
        </Button>
      </CardContent>
    </Card>
  );
}
```

---

#### 1.3.3 Enhanced Delivery Tracking Page

**File**: `src/pages/DeliveryTracking.tsx` (MODIFICATIONS)

Key additions:

```tsx
// Add estimated arrival window
const ArrivalWindow = ({ estimatedMinutes }: { estimatedMinutes: number }) => {
  const start = new Date(Date.now() + (estimatedMinutes - 5) * 60000);
  const end = new Date(Date.now() + (estimatedMinutes + 5) * 60000);
  
  return (
    <div className="bg-primary/10 rounded-lg p-4 text-center">
      <p className="text-sm text-muted-foreground">Arriving between</p>
      <p className="text-2xl font-bold">
        {format(start, 'h:mm')} - {format(end, 'h:mm a')}
      </p>
      <p className="text-sm text-muted-foreground mt-1">
        (~{estimatedMinutes} minutes)
      </p>
    </div>
  );
};

// Add proactive status updates
const StatusUpdates = ({ orderId }: { orderId: string }) => {
  const [updates, setUpdates] = useState<StatusUpdate[]>([]);
  
  useEffect(() => {
    const channel = supabase
      .channel(`tracking-${orderId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'meal_schedules',
        filter: `id=eq.${orderId}`,
      }, (payload) => {
        toast.success(`Order ${payload.new.order_status}`);
        fetchOrderDetails();
      })
      .subscribe();
      
    return () => supabase.removeChannel(channel);
  }, [orderId]);
  
  return null; // Toast notifications handle this
};

// Add contact section
const ContactSection = ({ restaurant, driver }: { restaurant: Restaurant; driver?: Driver }) => (
  <div className="flex gap-2">
    {driver && (
      <Button variant="outline" className="flex-1" asChild>
        <a href={`tel:${driver.phone}`}>
          <Phone className="h-4 w-4 mr-2" /> Call Driver
        </a>
      </Button>
    )}
    <Button variant="outline" className="flex-1" asChild>
      <a href={`tel:${restaurant.phone}`}>
        <Phone className="h-4 w-4 mr-2" /> Call Restaurant
      </a>
    </Button>
  </div>
);
```

---

### 1.4 Notification System

#### 1.4.1 Push Notification Service

**File**: `src/lib/notifications/push.ts` (NEW FILE)

```ts
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

export interface PushNotificationData {
  type: 'order_update' | 'delivery_update' | 'promotion' | 'reminder';
  orderId?: string;
  status?: string;
  title: string;
  body: string;
}

class PushNotificationService {
  private static instance: PushNotificationService;
  private fcmToken: string | null = null;

  static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  async initialize(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      console.log('Push notifications only available on native platforms');
      return;
    }

    const permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === 'prompt') {
      const requestStatus = await PushNotifications.requestPermissions();
      if (requestStatus.receive !== 'granted') {
        console.warn('Push notification permission denied');
        return;
      }
    }

    await PushNotifications.register();

    PushNotifications.addListener('registration', (token) => {
      this.fcmToken = token.value;
      this.saveTokenToDatabase(token.value);
    });

    PushNotifications.addListener('registrationError', (err) => {
      console.error('Push registration error:', err);
    });

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('Push received:', notification);
      // Handle foreground notification
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('Push action:', action);
      this.handleNotificationTap(action.notification.data as PushNotificationData);
    });
  }

  private async saveTokenToDatabase(token: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('push_tokens').upsert({
      user_id: user.id,
      token,
      platform: Capacitor.getPlatform(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
  }

  private handleNotificationTap(data: PushNotificationData): void {
    switch (data.type) {
      case 'order_update':
      case 'delivery_update':
        if (data.orderId) {
          window.location.href = `/tracking?id=${data.orderId}`;
        }
        break;
      case 'promotion':
        window.location.href = '/meals';
        break;
      case 'reminder':
        window.location.href = '/schedule';
        break;
    }
  }

  getToken(): string | null {
    return this.fcmToken;
  }
}

export const pushNotificationService = PushNotificationService.getInstance();
```

---

#### 1.4.2 Notification Preferences Component

**File**: `src/components/NotificationPreferences.tsx` (NEW FILE)

```tsx
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Bell, Mail, MessageSquare, Smartphone } from 'lucide-react';

interface NotificationPreferences {
  order_updates_push: boolean;
  order_updates_email: boolean;
  order_updates_whatsapp: boolean;
  delivery_updates_push: boolean;
  delivery_updates_email: boolean;
  delivery_updates_whatsapp: boolean;
  promotions_email: boolean;
  reminders_push: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  order_updates_push: true,
  order_updates_email: true,
  order_updates_whatsapp: true,
  delivery_updates_push: true,
  delivery_updates_email: false,
  delivery_updates_whatsapp: true,
  promotions_email: true,
  reminders_push: true,
};

export function NotificationPreferences() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchPreferences();
    }
  }, [user]);

  const fetchPreferences = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('notification_preferences')
      .eq('user_id', user?.id)
      .single();

    if (data?.notification_preferences) {
      setPreferences({ ...DEFAULT_PREFERENCES, ...data.notification_preferences });
    }
    setLoading(false);
  };

  const updatePreference = async (key: keyof NotificationPreferences, value: boolean) => {
    const newPreferences = { ...preferences, [key]: value };
    setPreferences(newPreferences);

    const { error } = await supabase
      .from('profiles')
      .update({ notification_preferences: newPreferences })
      .eq('user_id', user?.id);

    if (error) {
      toast.error('Failed to update preferences');
      setPreferences(preferences); // Revert
    } else {
      toast.success('Preferences updated');
    }
  };

  const categories = [
    {
      title: 'Order Updates',
      description: 'Get notified when your order status changes',
      icon: Bell,
      keys: {
        push: 'order_updates_push',
        email: 'order_updates_email',
        whatsapp: 'order_updates_whatsapp',
      } as const,
    },
    {
      title: 'Delivery Updates',
      description: 'Track your delivery in real-time',
      icon: Bell,
      keys: {
        push: 'delivery_updates_push',
        email: 'delivery_updates_email',
        whatsapp: 'delivery_updates_whatsapp',
      } as const,
    },
    {
      title: 'Promotions',
      description: 'Special offers and discounts',
      icon: Bell,
      keys: {
        email: 'promotions_email',
      } as const,
    },
    {
      title: 'Meal Reminders',
      description: 'Reminders to schedule your meals',
      icon: Bell,
      keys: {
        push: 'reminders_push',
      } as const,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notification Preferences
        </CardTitle>
        <CardDescription>
          Choose how you want to receive updates
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {categories.map((category) => (
          <div key={category.title} className="space-y-3">
            <div>
              <h4 className="font-medium">{category.title}</h4>
              <p className="text-sm text-muted-foreground">{category.description}</p>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {category.keys.push !== undefined && (
                <div className="flex items-center justify-between">
                  <Label htmlFor={category.keys.push} className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4" />
                    Push
                  </Label>
                  <Switch
                    id={category.keys.push}
                    checked={preferences[category.keys.push]}
                    onCheckedChange={(checked) => updatePreference(category.keys.push, checked)}
                  />
                </div>
              )}
              {category.keys.email !== undefined && (
                <div className="flex items-center justify-between">
                  <Label htmlFor={category.keys.email} className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email
                  </Label>
                  <Switch
                    id={category.keys.email}
                    checked={preferences[category.keys.email]}
                    onCheckedChange={(checked) => updatePreference(category.keys.email, checked)}
                  />
                </div>
              )}
              {category.keys.whatsapp !== undefined && (
                <div className="flex items-center justify-between">
                  <Label htmlFor={category.keys.whatsapp} className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    WhatsApp
                  </Label>
                  <Switch
                    id={category.keys.whatsapp}
                    checked={preferences[category.keys.whatsapp]}
                    onCheckedChange={(checked) => updatePreference(category.keys.whatsapp, checked)}
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
```

---

## Phase 2: Structural Improvements (60 Days)

### 2.1 Self-Service Capabilities

#### 2.1.1 Order Cancellation Flow

**File**: `src/components/OrderCancellation.tsx` (NEW FILE)

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AlertTriangle, Clock, CheckCircle } from 'lucide-react';

interface OrderCancellationProps {
  orderId: string;
  orderStatus: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCancelled: () => void;
}

const CANCELLATION_REASONS = [
  { value: 'changed_mind', label: 'Changed my mind' },
  { value: 'wrong_order', label: 'Ordered by mistake' },
  { value: 'delivery_time', label: 'Delivery time too long' },
  { value: 'found_better', label: 'Found a better option' },
  { value: 'other', label: 'Other reason' },
];

const CANCELLATION_RULES = {
  pending: { allowed: true, refundType: 'full', message: 'Full refund will be processed' },
  confirmed: { allowed: true, refundType: 'full', message: 'Full refund will be processed' },
  preparing: { allowed: true, refundType: 'partial', message: 'Partial refund (50%) - meal preparation started' },
  ready: { allowed: false, refundType: 'none', message: 'Cannot cancel - order is ready for delivery' },
  out_for_delivery: { allowed: false, refundType: 'none', message: 'Cannot cancel - order is in transit' },
};

export function OrderCancellation({ orderId, orderStatus, open, onOpenChange, onCancelled }: OrderCancellationProps) {
  const navigate = useNavigate();
  const [reason, setReason] = useState<string>('');
  const [customReason, setCustomReason] = useState('');
  const [loading, setLoading] = useState(false);

  const rules = CANCELLATION_RULES[orderStatus as keyof typeof CANCELLATION_RULES] || CANCELLATION_RULES.pending;

  const handleCancel = async () => {
    if (!reason) {
      toast.error('Please select a reason for cancellation');
      return;
    }

    setLoading(true);

    const { error } = await supabase.rpc('cancel_order', {
      p_order_id: orderId,
      p_reason: reason === 'other' ? customReason : reason,
      p_refund_type: rules.refundType,
    });

    setLoading(false);

    if (error) {
      toast.error('Failed to cancel order. Please contact support.');
    } else {
      toast.success('Order cancelled successfully');
      onCancelled();
      onOpenChange(false);
    }
  };

  if (!rules.allowed) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Cannot Cancel Order
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>{rules.message}</p>
            <p className="text-sm text-muted-foreground mt-2">
              If you have issues with your order, please contact support.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button onClick={() => navigate('/support')}>
              Contact Support
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel Order</DialogTitle>
          <DialogDescription>
            Are you sure you want to cancel this order?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className={`flex items-center gap-2 p-3 rounded-lg ${rules.refundType === 'full' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
            {rules.refundType === 'full' ? (
              <CheckCircle className="h-5 w-5" />
            ) : (
              <Clock className="h-5 w-5" />
            )}
            <span className="text-sm font-medium">{rules.message}</span>
          </div>

          <div className="space-y-2">
            <Label>Reason for cancellation</Label>
            <RadioGroup value={reason} onValueChange={setReason}>
              {CANCELLATION_REASONS.map((r) => (
                <div key={r.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={r.value} id={r.value} />
                  <Label htmlFor={r.value}>{r.label}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {reason === 'other' && (
            <Textarea
              placeholder="Please tell us why you're cancelling..."
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
            />
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Keep Order
          </Button>
          <Button variant="destructive" onClick={handleCancel} disabled={loading}>
            {loading ? 'Cancelling...' : 'Cancel Order'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---

#### 2.1.2 Address Management Enhancement

**File**: `src/pages/Addresses.tsx` (ENHANCEMENTS)

Add delivery zone validation:

```tsx
// Add to address form
const DELIVERY_ZONES = [
  { zone: 'doha', label: 'Doha', deliveryFee: 0, estimatedMinutes: 30 },
  { zone: 'al_wakrah', label: 'Al Wakrah', deliveryFee: 10, estimatedMinutes: 45 },
  { zone: 'al_khor', label: 'Al Khor', deliveryFee: 15, estimatedMinutes: 60 },
  { zone: 'outside', label: 'Outside delivery area', deliveryFee: null, estimatedMinutes: null },
];

const validateDeliveryZone = async (address: string): Promise<DeliveryZone | null> => {
  // Use geocoding API to determine zone
  const response = await fetch(`/api/validate-address?address=${encodeURIComponent(address)}`);
  return response.json();
};

// In address form:
<FormField
  name="address"
  label="Delivery Address"
  validate={async (value) => {
    const zone = await validateDeliveryZone(value);
    if (!zone || zone.zone === 'outside') {
      return 'This address is outside our delivery area';
    }
    return null;
  }}
  onBlur={async (e) => {
    const zone = await validateDeliveryZone(e.target.value);
    if (zone) {
      setDeliveryInfo(zone);
    }
  }}
/>

{deliveryInfo && deliveryInfo.zone !== 'outside' && (
  <Alert>
    <MapPin className="h-4 w-4" />
    <AlertDescription>
      Delivery to {deliveryInfo.label}: {deliveryInfo.deliveryFee === 0 ? 'Free' : `${deliveryInfo.deliveryFee} QAR`}
      <br />
      Estimated delivery: {deliveryInfo.estimatedMinutes} minutes
    </AlertDescription>
  </Alert>
)}
```

---

### 2.2 Automation Improvements

#### 2.2.1 Auto Driver Assignment Edge Function

**File**: `supabase/functions/auto-assign-driver/index.ts` (NEW FILE)

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

interface DeliveryJob {
  order_id: string;
  pickup_lat: number;
  pickup_lng: number;
  delivery_lat: number;
  delivery_lng: number;
}

interface Driver {
  id: string;
  current_lat: number;
  current_lng: number;
  current_orders: number;
  max_orders: number;
  rating: number;
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function scoreDriver(driver: Driver, job: DeliveryJob): number {
  // Calculate pickup distance
  const pickupDistance = calculateDistance(
    driver.current_lat, driver.current_lng,
    job.pickup_lat, job.pickup_lng
  );

  // Score components
  const distanceScore = Math.max(0, 100 - pickupDistance * 10); // Closer = better
  const capacityScore = (driver.max_orders - driver.current_orders) * 20; // More capacity = better
  const ratingScore = driver.rating * 20; // Higher rating = better

  return distanceScore + capacityScore + ratingScore;
}

Deno.serve(async (req) => {
  try {
    const { orderId } = await req.json();

    // Get order details with restaurant location
    const { data: order, error: orderError } = await supabase
      .from('meal_schedules')
      .select(`
        id,
        user_id,
        scheduled_date,
        profiles (address, latitude, longitude),
        meals (restaurants (latitude, longitude))
      `)
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: 'Order not found' }), { status: 404 });
    }

    // Check if already assigned
    const { data: existingJob } = await supabase
      .from('delivery_jobs')
      .select('id')
      .eq('order_id', orderId)
      .maybeSingle();

    if (existingJob) {
      return new Response(JSON.stringify({ message: 'Already assigned' }), { status: 200 });
    }

    // Get available drivers
    const { data: drivers, error: driversError } = await supabase
      .from('drivers')
      .select(`
        id,
        current_lat,
        current_lng,
        max_orders,
        rating,
        status
      `)
      .eq('status', 'available')
      .eq('approval_status', 'approved');

    if (driversError || !drivers?.length) {
      // No drivers available - queue for manual assignment
      await supabase
        .from('delivery_queue')
        .insert({ order_id: orderId, status: 'pending_assignment' });
      
      return new Response(JSON.stringify({ message: 'No drivers available, queued for manual assignment' }), { status: 200 });
    }

    // Get current order counts for each driver
    const driverIds = drivers.map(d => d.id);
    const { data: activeJobs } = await supabase
      .from('delivery_jobs')
      .select('driver_id')
      .in('driver_id', driverIds)
      .in('status', ['assigned', 'picked_up']);

    const orderCounts = (activeJobs || []).reduce((acc, job) => {
      acc[job.driver_id] = (acc[job.driver_id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const job: DeliveryJob = {
      order_id: orderId,
      pickup_lat: order.meals?.restaurants?.latitude || 0,
      pickup_lng: order.meals?.restaurants?.longitude || 0,
      delivery_lat: order.profiles?.latitude || 0,
      delivery_lng: order.profiles?.longitude || 0,
    };

    // Score and rank drivers
    const scoredDrivers = drivers
      .filter(d => (orderCounts[d.id] || 0) < (d.max_orders || 3))
      .map(d => ({
        ...d,
        current_orders: orderCounts[d.id] || 0,
        score: scoreDriver({ ...d, current_orders: orderCounts[d.id] || 0 }, job),
      }))
      .sort((a, b) => b.score - a.score);

    if (!scoredDrivers.length) {
      return new Response(JSON.stringify({ message: 'No drivers with capacity' }), { status: 200 });
    }

    const bestDriver = scoredDrivers[0];

    // Create delivery job
    const { error: createError } = await supabase
      .from('delivery_jobs')
      .insert({
        order_id: orderId,
        driver_id: bestDriver.id,
        status: 'assigned',
        assigned_at: new Date().toISOString(),
      });

    if (createError) {
      throw createError;
    }

    // Update order status
    await supabase
      .from('meal_schedules')
      .update({ order_status: 'out_for_delivery' })
      .eq('id', orderId);

    // Send notification to driver
    await supabase.functions.invoke('send-notification', {
      body: {
        userId: bestDriver.id,
        type: 'new_delivery',
        title: 'New Delivery Assignment',
        body: `You have a new delivery order`,
        data: { orderId },
      },
    });

    return new Response(JSON.stringify({
      success: true,
      driverId: bestDriver.id,
      score: bestDriver.score,
    }), { status: 200 });

  } catch (error) {
    console.error('Auto-assign error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
```

---

#### 2.2.2 Auto Invoice Email Edge Function

**File**: `supabase/functions/send-invoice-email/index.ts` (NEW FILE)

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { Resend } from 'npm:resend@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

Deno.serve(async (req) => {
  try {
    const { paymentId, userId } = await req.json();

    // Get payment details
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select(`
        id,
        amount,
        payment_method,
        created_at,
        payment_type,
        user_id,
        profiles (full_name, email)
      `)
      .eq('id', paymentId)
      .single();

    if (paymentError || !payment) {
      return new Response(JSON.stringify({ error: 'Payment not found' }), { status: 404 });
    }

    // Generate invoice number
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(payment.id).padStart(6, '0')}`;

    // Send email
    const { data, error } = await resend.emails.send({
      from: 'Nutrio Fuel <billing@nutriofuel.qa>',
      to: payment.profiles.email,
      subject: `Your Invoice ${invoiceNumber}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: 'Plus Jakarta Sans', sans-serif; color: #1a1a1a; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { text-align: center; margin-bottom: 40px; }
            .logo { font-size: 24px; font-weight: bold; color: #10B981; }
            .invoice-box { background: #f9f9f9; border-radius: 8px; padding: 24px; }
            .row { display: flex; justify-content: space-between; margin-bottom: 12px; }
            .total { font-size: 20px; font-weight: bold; border-top: 2px solid #10B981; padding-top: 12px; margin-top: 12px; }
            .footer { text-align: center; margin-top: 40px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">🥗 Nutrio Fuel</div>
              <p>Healthy Meal Delivery</p>
            </div>
            
            <h1>Invoice</h1>
            <p>Invoice #: ${invoiceNumber}</p>
            <p>Date: ${new Date(payment.created_at).toLocaleDateString('en-QA')}</p>
            
            <div class="invoice-box">
              <div class="row">
                <span>Billed to:</span>
                <span>${payment.profiles.full_name}</span>
              </div>
              <div class="row">
                <span>Payment Type:</span>
                <span>${payment.payment_type}</span>
              </div>
              <div class="row">
                <span>Payment Method:</span>
                <span>${payment.payment_method}</span>
              </div>
              <div class="row total">
                <span>Total:</span>
                <span>${payment.amount} QAR</span>
              </div>
            </div>
            
            <p style="margin-top: 24px;">
              Thank you for your payment. Your transaction has been completed successfully.
            </p>
            
            <div class="footer">
              <p>Nutrio Fuel Qatar</p>
              <p>Questions? Contact support@nutriofuel.qa</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      throw error;
    }

    // Mark invoice as sent
    await supabase
      .from('payments')
      .update({ invoice_sent: true, invoice_sent_at: new Date().toISOString() })
      .eq('id', paymentId);

    return new Response(JSON.stringify({ success: true, emailId: data?.id }), { status: 200 });

  } catch (error) {
    console.error('Invoice email error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
```

---

## Phase 3: Optimization (90 Days)

### 3.1 Smart Meal Suggestions

**File**: `src/hooks/useSmartSuggestions.ts` (ENHANCEMENT)

```tsx
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface MealSuggestion {
  id: string;
  name: string;
  restaurant_name: string;
  image_url: string;
  calories: number;
  match_score: number;
  match_reason: string;
}

export function useSmartSuggestions() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['smart-suggestions', user?.id],
    queryFn: async (): Promise<MealSuggestion[]> => {
      if (!user) return [];

      // Get user's nutrition targets and history
      const { data: profile } = await supabase
        .from('profiles')
        .select('daily_calorie_target, protein_target_g, health_goal')
        .eq('user_id', user.id)
        .single();

      const { data: topMeals } = await supabase
        .from('user_top_meals')
        .select('meal_id, order_count')
        .eq('user_id', user.id)
        .order('order_count', { ascending: false })
        .limit(5);

      const { data: recentOrders } = await supabase
        .from('meal_schedules')
        .select('meal_id, meals (calories, protein_g)')
        .eq('user_id', user.id)
        .gte('scheduled_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .limit(20);

      // Calculate average nutrition from recent orders
      const avgCalories = recentOrders?.reduce((sum, o) => sum + (o.meals?.calories || 0), 0) / (recentOrders?.length || 1) || 500;
      const avgProtein = recentOrders?.reduce((sum, o) => sum + (o.meals?.protein_g || 0), 0) / (recentOrders?.length || 1) || 30;

      // Get suggested meals based on targets
      const { data: suggestions } = await supabase
        .from('meals')
        .select(`
          id,
          name,
          calories,
          protein_g,
          image_url,
          restaurants (name)
        `)
        .eq('is_active', true)
        .gte('protein_g', profile?.protein_target_g ? profile.protein_target_g * 0.25 : 20)
        .lte('calories', profile?.daily_calorie_target ? profile.daily_calorie_target * 0.4 : 800)
        .limit(20);

      // Score and rank suggestions
      const scored = (suggestions || []).map(meal => {
        let score = 50;
        let reason = 'Popular choice';

        // Boost if matches user's typical meal profile
        const calorieMatch = 100 - Math.abs(meal.calories - avgCalories) / 10;
        score += calorieMatch;

        // Boost if high protein (for health goals)
        if (profile?.health_goal === 'lose' && meal.protein_g > avgProtein) {
          score += 20;
          reason = 'High protein for your goals';
        }

        // Boost if user has ordered from this restaurant before
        if (topMeals?.some(tm => tm.meal_id === meal.id)) {
          score += 15;
          reason = 'You\'ve enjoyed this before';
        }

        return {
          id: meal.id,
          name: meal.name,
          restaurant_name: meal.restaurants?.name || '',
          image_url: meal.image_url,
          calories: meal.calories,
          match_score: Math.min(100, Math.round(score)),
          match_reason: reason,
        };
      });

      return scored.sort((a, b) => b.match_score - a.match_score).slice(0, 6);
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
```

---

### 3.2 NPS Survey Component

**File**: `src/components/NPSSurvey.tsx` (NEW FILE)

```tsx
import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface NPSSurveyProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId?: string;
}

export function NPSSurvey({ open, onOpenChange, orderId }: NPSSurveyProps) {
  const { user } = useAuth();
  const [score, setScore] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (score === null) {
      toast.error('Please select a score');
      return;
    }

    setLoading(true);

    const { error } = await supabase.from('nps_responses').insert({
      user_id: user?.id,
      order_id: orderId,
      score,
      feedback: feedback || null,
      created_at: new Date().toISOString(),
    });

    setLoading(false);

    if (error) {
      toast.error('Failed to submit feedback');
    } else {
      toast.success('Thank you for your feedback!');
      onOpenChange(false);
    }
  };

  const getScoreLabel = (s: number) => {
    if (s <= 6) return 'Not likely';
    if (s <= 8) return 'Maybe';
    return 'Very likely';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>How was your experience?</DialogTitle>
          <DialogDescription>
            How likely are you to recommend Nutrio Fuel to a friend?
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="flex justify-between gap-1">
            {[...Array(11)].map((_, i) => (
              <button
                key={i}
                onClick={() => setScore(i)}
                className={`h-10 w-10 rounded-lg font-medium transition-all ${
                  score === i
                    ? i <= 6
                      ? 'bg-red-500 text-white'
                      : i <= 8
                      ? 'bg-yellow-500 text-white'
                      : 'bg-green-500 text-white'
                    : 'bg-muted hover:bg-muted/80'
                }`}
              >
                {i}
              </button>
            ))}
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-2">
            <span>Not at all likely</span>
            <span>Extremely likely</span>
          </div>

          {score !== null && (
            <div className="mt-4 space-y-2">
              <p className="text-sm font-medium">
                {score <= 6
                  ? 'What could we do better?'
                  : score <= 8
                  ? 'What would make you more likely to recommend us?'
                  : 'What do you love most about Nutrio Fuel?'}
              </p>
              <Textarea
                placeholder="Share your thoughts (optional)"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={3}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Skip
          </Button>
          <Button onClick={handleSubmit} disabled={loading || score === null}>
            {loading ? 'Submitting...' : 'Submit Feedback'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---

## Database Migrations Required

### Migration 1: Add Notification Preferences

```sql
-- File: supabase/migrations/20240101000000_add_notification_preferences.sql

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{
  "order_updates_push": true,
  "order_updates_email": true,
  "order_updates_whatsapp": true,
  "delivery_updates_push": true,
  "delivery_updates_email": false,
  "delivery_updates_whatsapp": true,
  "promotions_email": true,
  "reminders_push": true
}'::jsonb;

-- Add push tokens table
CREATE TABLE IF NOT EXISTS push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX idx_push_tokens_user ON push_tokens(user_id);
```

### Migration 2: Add NPS Responses

```sql
-- File: supabase/migrations/20240101000001_add_nps_responses.sql

CREATE TABLE IF NOT EXISTS nps_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id UUID,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 10),
  feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_nps_responses_user ON nps_responses(user_id);
CREATE INDEX idx_nps_responses_created ON nps_responses(created_at);
```

### Migration 3: Add Order Cancellation RPC

```sql
-- File: supabase/migrations/20240101000002_add_cancel_order_rpc.sql

CREATE OR REPLACE FUNCTION cancel_order(
  p_order_id UUID,
  p_reason TEXT,
  p_refund_type TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id UUID;
  v_meal_id UUID;
  v_refund_amount DECIMAL;
  v_wallet_id UUID;
BEGIN
  -- Get order details
  SELECT user_id, meal_id INTO v_user_id, v_meal_id
  FROM meal_schedules
  WHERE id = p_order_id;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Order not found');
  END IF;

  -- Update order status
  UPDATE meal_schedules
  SET order_status = 'cancelled',
      cancelled_at = NOW(),
      cancellation_reason = p_reason
  WHERE id = p_order_id;

  -- Handle refund if applicable
  IF p_refund_type IN ('full', 'partial') THEN
    -- Get wallet
    SELECT id INTO v_wallet_id FROM customer_wallets WHERE user_id = v_user_id;
    
    IF v_wallet_id IS NULL THEN
      INSERT INTO customer_wallets (user_id, balance)
      VALUES (v_user_id, 0)
      RETURNING id INTO v_wallet_id;
    END IF;

    -- Calculate refund amount (simplified - in reality would get meal price)
    v_refund_amount := CASE 
      WHEN p_refund_type = 'full' THEN 50.00
      WHEN p_refund_type = 'partial' THEN 25.00
      ELSE 0
    END;

    -- Credit wallet
    UPDATE customer_wallets
    SET balance = balance + v_refund_amount,
        total_credits = total_credits + v_refund_amount
    WHERE id = v_wallet_id;

    -- Log transaction
    INSERT INTO wallet_transactions (
      wallet_id, user_id, type, amount, reference_type, description
    ) VALUES (
      v_wallet_id, v_user_id, 'refund', v_refund_amount, 'order_cancellation', p_reason
    );
  END IF;

  -- Increment meal quota back
  UPDATE subscriptions
  SET meals_used_this_month = GREATEST(0, meals_used_this_month - 1),
      meals_used_this_week = GREATEST(0, meals_used_this_week - 1)
  WHERE user_id = v_user_id AND status = 'active';

  RETURN jsonb_build_object(
    'success', true,
    'refund_amount', v_refund_amount,
    'refund_type', p_refund_type
  );
END;
$$;
```

### Migration 4: Add Delivery Queue

```sql
-- File: supabase/migrations/20240101000003_add_delivery_queue.sql

CREATE TABLE IF NOT EXISTS delivery_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES meal_schedules(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending_assignment',
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_at TIMESTAMPTZ,
  notes TEXT
);

CREATE INDEX idx_delivery_queue_status ON delivery_queue(status);
CREATE INDEX idx_delivery_queue_created ON delivery_queue(created_at);
```

---

## Testing Checklist

### Phase 1 Tests

| Test Case | File | Status |
|-----------|------|--------|
| Onboarding progress bar updates correctly | `Onboarding.test.tsx` | [ ] |
| Skip for now saves minimal profile | `Onboarding.test.tsx` | [ ] |
| Auto-save recovery dialog appears | `Onboarding.test.tsx` | [ ] |
| Subscription gate shows value props | `SubscriptionGate.test.tsx` | [ ] |
| Quiz recommends correct plan | `SubscriptionWizard.test.tsx` | [ ] |
| Quota warning appears at 75% usage | `QuotaWarningBanner.test.tsx` | [ ] |
| Order tracking hub shows active orders | `OrderTrackingHub.test.tsx` | [ ] |
| Push notifications register on native | `push.test.ts` | [ ] |

### Phase 2 Tests

| Test Case | File | Status |
|-----------|------|--------|
| Order cancellation validates status | `OrderCancellation.test.tsx` | [ ] |
| Auto-assign selects best driver | `auto-assign-driver.test.ts` | [ ] |
| Invoice email sends correctly | `send-invoice-email.test.ts` | [ ] |
| Address validation blocks outside zones | `Addresses.test.tsx` | [ ] |

### Phase 3 Tests

| Test Case | File | Status |
|-----------|------|--------|
| Smart suggestions match user profile | `useSmartSuggestions.test.ts` | [ ] |
| NPS survey submits correctly | `NPSSurvey.test.tsx` | [ ] |

---

## Implementation Timeline

| Week | Tasks | Deliverables |
|------|-------|--------------|
| 1 | Onboarding progress + skip + auto-save | Reduced drop-off |
| 2 | Subscription gate + quiz + quota warning | Higher conversion |
| 3 | Order tracking hub + status unification | Better tracking UX |
| 4 | Push notifications + preferences | Proactive updates |
| 5-6 | Self-service cancellation + address validation | Reduced support tickets |
| 7-8 | Auto driver assignment + invoice emails | Operational efficiency |
| 9-10 | Smart suggestions + personalization | Engagement boost |
| 11-12 | NPS survey + feedback loop | Continuous improvement |

---

## Success Metrics

| Metric | Current | Target (90 days) |
|--------|---------|------------------|
| Onboarding completion rate | ~70% | 85% |
| Subscription conversion | ~45% | 60% |
| Order tracking satisfaction | Low | High (4.5+ rating) |
| Support tickets (order-related) | Baseline | -40% |
| NPS score | Unknown | 50+ |
| First order within 7 days | ~60% | 75% |

---

## Status

**Currently in Phase 0** - Plan approved, ready to begin implementation

- [ ] Phase 1: Critical Fixes (30 Days)
- [ ] Phase 2: Structural Improvements (60 Days)
- [ ] Phase 3: Optimization (90 Days)
