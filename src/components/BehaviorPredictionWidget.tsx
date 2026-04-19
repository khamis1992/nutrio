import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Brain, 
  TrendingDown, 
  AlertTriangle, 
  X,
  Lightbulb,
  Gift,
  Target
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';

interface BehaviorPrediction {
  id: string;
  churn_risk_score: number;
  boredom_risk_score: number;
  engagement_score: number;
  recommended_action: string;
  created_at: string;
}

export function BehaviorPredictionWidget() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [prediction, setPrediction] = useState<BehaviorPrediction | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user) return;
    const stored = localStorage.getItem(`behavior_prediction_dismissed_${user.id}`);
    if (stored) {
      const dismissedAt = new Date(stored);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      if (dismissedAt > sevenDaysAgo) {
        setDismissed(true);
      }
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    let channel: ReturnType<typeof supabase.channel>;

    const init = async () => {
      fetchPrediction();

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        supabase.realtime.setAuth(session.access_token);
      }

      channel = supabase
        .channel(`behavior-predictions-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'behavior_predictions',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            setPrediction(payload.new as BehaviorPrediction);
            setDismissed(false);
          }
        )
        .subscribe();
    };

    init();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchPrediction = async () => {
    try {
      const { data, error } = await supabase
        .from('behavior_predictions')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      
      // Only show if prediction is from last 7 days
      if (data) {
        const predictionDate = new Date(data.created_at);
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        if (predictionDate > sevenDaysAgo) {
          setPrediction(data);
        }
      }
    } catch (err) {
      console.error('Error fetching behavior prediction:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(`behavior_prediction_dismissed_${user?.id}`, new Date().toISOString());
  };

  const getActionDetails = (action: string) => {
    const actions: Record<string, { icon: React.ReactNode; title: string; description: string; color: string }> = {
      'personal_outreach': {
        icon: <AlertTriangle className="w-5 h-5" />,
        title: t('bp_we_miss_you') || 'We Miss You!',
        description: t('bp_personal_outreach_desc') || 'Your nutrition coach wants to check in with you.',
        color: 'bg-red-50 border-red-200 text-red-800',
      },
      'bonus_credit': {
        icon: <Gift className="w-5 h-5" />,
        title: t('bp_bonus_credit') || 'Special Bonus for You',
        description: t('bp_bonus_credit_desc') || "You've earned a bonus credit! Check your wallet.",
        color: 'bg-purple-50 border-purple-200 text-purple-800',
      },
      'cuisine_exploration': {
        icon: <Lightbulb className="w-5 h-5" />,
        title: t('bp_try_something_new') || 'Try Something New',
        description: t('bp_cuisine_exploration_desc') || 'Explore new restaurants and cuisines this week.',
        color: 'bg-amber-50 border-amber-200 text-amber-800',
      },
      'plan_regeneration': {
        icon: <Target className="w-5 h-5" />,
        title: t('bp_refresh_plan') || 'Refresh Your Meal Plan',
        description: t('bp_plan_regeneration_desc') || 'Your AI recommends regenerating your meal plan.',
        color: 'bg-blue-50 border-blue-200 text-blue-800',
      },
      'gamification': {
        icon: <TrendingDown className="w-5 h-5" />,
        title: t('bp_challenge_yourself') || 'Challenge Yourself',
        description: t('bp_gamification_desc') || "Complete this week's challenge to earn rewards!",
        color: 'bg-green-50 border-green-200 text-green-800',
      },
      'flexible_scheduling': {
        icon: <Lightbulb className="w-5 h-5" />,
        title: t('bp_scheduling_tip') || 'Scheduling Tip',
        description: t('bp_flexible_scheduling_desc') || 'Try flexible scheduling to match your lifestyle.',
        color: 'bg-indigo-50 border-indigo-200 text-indigo-800',
      },
    };

    return actions[action] || {
      icon: <Brain className="w-5 h-5" />,
      title: t('bp_ai_recommendation') || 'AI Recommendation',
      description: t('bp_ai_recommendation_desc') || 'Personalized suggestion based on your usage.',
      color: 'bg-primary/10 border-primary/20 text-primary',
    };
  };

  if (loading || dismissed || !prediction) return null;

  // Only show for significant predictions
  const shouldShow = prediction.churn_risk_score > 0.6 || 
                     prediction.boredom_risk_score > 0.6 ||
                     prediction.engagement_score < 40;

  if (!shouldShow) return null;

  const actionDetails = getActionDetails(prediction.recommended_action);

  return (
    <Card className={`relative overflow-hidden ${actionDetails.color}`}>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-6 w-6 opacity-50 hover:opacity-100"
        onClick={handleDismiss}
      >
        <X className="h-4 w-4" />
      </Button>
      
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5" />
          <CardTitle className="text-base font-semibold">{t('bp_ai_insight') || 'AI Insight'}</CardTitle>
          <Badge variant="outline" className="text-xs ml-auto">
            {Math.round(prediction.engagement_score)}% {t('bp_engagement') || 'engagement'}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5">{actionDetails.icon}</div>
          <div>
            <p className="font-medium">{actionDetails.title}</p>
            <p className="text-sm opacity-90">{actionDetails.description}</p>
          </div>
        </div>

        {prediction.churn_risk_score > 0.6 && (
          <div className="flex items-center gap-2 text-sm">
            <AlertTriangle className="w-4 h-4" />
            <span>{t('bp_churn_risk') || 'Churn risk'}: {Math.round(prediction.churn_risk_score * 100)}%</span>
          </div>
        )}

        {prediction.boredom_risk_score > 0.6 && (
          <div className="flex items-center gap-2 text-sm">
            <span>{t('bp_time_for_variety') || 'Time for variety!'}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
