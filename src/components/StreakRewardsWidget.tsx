import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Trophy, 
  Flame, 
  Gift, 
  CheckCircle2,
  Lock,
  Star
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/currency';

interface StreakReward {
  id: string;
  streakDays: number;
  rewardType: 'bonus_credit' | 'free_meal' | 'discount' | 'badge';
  rewardValue: number;
  rewardDescription: string;
  claimed: boolean;
  claimedAt?: string;
}

const STREAK_REWARDS: StreakReward[] = [
  {
    id: 'streak-7',
    streakDays: 7,
    rewardType: 'bonus_credit',
    rewardValue: 10,
    rewardDescription: 'QAR 10 bonus credit',
    claimed: false,
  },
  {
    id: 'streak-14',
    streakDays: 14,
    rewardType: 'discount',
    rewardValue: 20,
    rewardDescription: '20% off next order',
    claimed: false,
  },
  {
    id: 'streak-30',
    streakDays: 30,
    rewardType: 'free_meal',
    rewardValue: 1,
    rewardDescription: 'Free meal credit',
    claimed: false,
  },
  {
    id: 'streak-60',
    streakDays: 60,
    rewardType: 'bonus_credit',
    rewardValue: 50,
    rewardDescription: 'QAR 50 bonus credit',
    claimed: false,
  },
  {
    id: 'streak-90',
    streakDays: 90,
    rewardType: 'badge',
    rewardValue: 0,
    rewardDescription: 'Legendary Streak Badge',
    claimed: false,
  },
];

export function StreakRewardsWidget() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [streakDays, setStreakDays] = useState(0);
  const [claimedRewards, setClaimedRewards] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchStreakData();
  }, [user]);

  const fetchStreakData = async () => {
    try {
      // Get user's streak
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('streak_days')
        .eq('id', user?.id)
        .single();

      if (profileError) throw profileError;
      
      setStreakDays(profile?.streak_days || 0);

      // Get claimed rewards
      const { data: rewards, error: rewardsError } = await supabase
        .from('streak_rewards_claimed')
        .select('reward_id')
        .eq('user_id', user?.id);

      if (rewardsError) throw rewardsError;
      
      setClaimedRewards(rewards?.map(r => r.reward_id) || []);
    } catch (err) {
      console.error('Error fetching streak data:', err);
    } finally {
      setLoading(false);
    }
  };

  const claimReward = async (reward: StreakReward) => {
    try {
      // Record the claim
      const { error: claimError } = await supabase
        .from('streak_rewards_claimed')
        .insert({
          user_id: user?.id,
          reward_id: reward.id,
          streak_days: reward.streakDays,
          reward_type: reward.rewardType,
          reward_value: reward.rewardValue,
        });

      if (claimError) throw claimError;

      // Apply the reward
      if (reward.rewardType === 'bonus_credit') {
        await supabase.rpc('credit_wallet', {
          p_user_id: user?.id,
          p_amount: reward.rewardValue,
          p_type: 'bonus',
          p_reference_type: 'streak_reward',
          p_reference_id: reward.id,
          p_description: `Streak reward: ${reward.streakDays} days`,
        });
      }

      setClaimedRewards([...claimedRewards, reward.id]);
      
      toast({
        title: 'Reward Claimed!',
        description: `You've earned ${reward.rewardDescription}`,
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to claim reward. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const getNextMilestone = () => {
    return STREAK_REWARDS.find(r => r.streakDays > streakDays) || STREAK_REWARDS[STREAK_REWARDS.length - 1];
  };

  const nextMilestone = getNextMilestone();
  const progressToNext = Math.min((streakDays / (nextMilestone?.streakDays || 1)) * 100, 100);

  if (loading) return null;

  return (
    <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-600" />
            <CardTitle className="text-base font-semibold">Streak Rewards</CardTitle>
          </div>
          <Badge variant="outline" className="bg-white/50">
            <Flame className="w-3 h-3 mr-1 text-orange-500" />
            {streakDays} days
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Progress to next milestone */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Next reward</span>
            <span className="font-medium">{nextMilestone.streakDays} days</span>
          </div>
          <div className="w-full bg-amber-200 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-amber-500 to-orange-500 h-full rounded-full transition-all"
              style={{ width: `${progressToNext}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {nextMilestone.streakDays - streakDays} more days to unlock {nextMilestone.rewardDescription}
          </p>
        </div>

        {/* Available rewards */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Available Rewards</p>
          <div className="space-y-2">
            {STREAK_REWARDS.filter(r => r.streakDays <= streakDays && !claimedRewards.includes(r.id)).map((reward) => (
              <div 
                key={reward.id}
                className="flex items-center justify-between p-3 bg-white/60 rounded-lg border border-amber-200"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                    <Gift className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{reward.streakDays} Day Streak</p>
                    <p className="text-xs text-muted-foreground">{reward.rewardDescription}</p>
                  </div>
                </div>
                <Button size="sm" onClick={() => claimReward(reward)}>
                  Claim
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Locked rewards preview */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Upcoming</p>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {STREAK_REWARDS.filter(r => r.streakDays > streakDays).slice(0, 3).map((reward) => (
              <div 
                key={reward.id}
                className="flex-shrink-0 p-3 bg-white/40 rounded-lg border border-dashed border-amber-300 opacity-60"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Lock className="w-3 h-3" />
                  <span className="text-xs font-medium">{reward.streakDays} days</span>
                </div>
                <p className="text-xs text-muted-foreground">{reward.rewardDescription}</p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
