import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Trophy,
  Flame,
  Gift,
  Lock
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface StreakReward {
  id: string;
  streak_days: number;
  reward_type: 'bonus_credit' | 'free_meal' | 'discount' | 'badge';
  reward_value: number;
  reward_description: string;
  is_active: boolean;
}

export function StreakRewardsWidget() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [streakDays, setStreakDays] = useState(0);
  const [claimedRewards, setClaimedRewards] = useState<string[]>([]);
  const [rewards, setRewards] = useState<StreakReward[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchStreakData();
  }, [user]);

  const fetchStreakData = async () => {
    try {
      // Fetch available rewards from database
      const { data: rewardsData, error: rewardsError } = await supabase
        .from('streak_rewards')
        .select('*')
        .eq('is_active', true)
        .order('streak_days', { ascending: true });

      if (rewardsError) throw rewardsError;
      setRewards(rewardsData || []);

      // Get user's streak
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('streak_days')
        .eq('user_id', user?.id)
        .single();

      if (profileError) throw profileError;

      setStreakDays(profile?.streak_days || 0);

      // Get claimed rewards
      const { data: claimedData, error: claimedError } = await supabase
        .from('streak_rewards_claimed')
        .select('reward_id')
        .eq('user_id', user?.id);

      if (claimedError) throw claimedError;

      setClaimedRewards(claimedData?.map(r => r.reward_id) || []);
    } catch (err) {
      console.error('Error fetching streak data:', err);
    } finally {
      setLoading(false);
    }
  };

  const claimReward = async (reward: StreakReward) => {
    if (!user?.id) return;

    try {
      // Record the claim
      const { error: claimError } = await supabase
        .from('streak_rewards_claimed')
        .insert({
          user_id: user.id,
          reward_id: reward.id,
          streak_days: reward.streak_days,
          reward_type: reward.reward_type,
          reward_value: reward.reward_value,
        });

      if (claimError) throw claimError;

      // Apply the reward
      if (reward.reward_type === 'bonus_credit') {
        const { error: walletError } = await supabase.rpc('credit_wallet', {
          p_user_id: user.id,
          p_amount: reward.reward_value,
          p_type: 'bonus',
          p_reference_type: 'streak_reward',
          p_reference_id: reward.id,
          p_description: `Streak reward: ${reward.streak_days} days`,
        });

        if (walletError) {
          console.error('Wallet credit error:', walletError);
          // Don't throw - the claim was already recorded
          toast({
            title: 'Reward Claimed',
            description: 'Your reward has been recorded. Wallet credit will be applied shortly.',
          });
        }
      }

      setClaimedRewards([...claimedRewards, reward.id]);

      toast({
        title: 'Reward Claimed!',
        description: `You've earned ${reward.reward_description}`,
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
    return rewards.find(r => r.streak_days > streakDays) || rewards[rewards.length - 1];
  };

  const formatRewardValue = (reward: StreakReward) => {
    switch (reward.reward_type) {
      case 'bonus_credit':
        return `QAR ${reward.reward_value} bonus credit`;
      case 'discount':
        return `${reward.reward_value}% off next order`;
      case 'free_meal':
        return `${reward.reward_value} free meal${reward.reward_value > 1 ? 's' : ''}`;
      case 'badge':
        return reward.reward_description;
      default:
        return reward.reward_description;
    }
  };

  const nextMilestone = getNextMilestone();
  const progressToNext = nextMilestone
    ? Math.min((streakDays / nextMilestone.streak_days) * 100, 100)
    : 100;

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
        {nextMilestone && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Next reward</span>
              <span className="font-medium">{nextMilestone.streak_days} days</span>
            </div>
            <div className="w-full bg-amber-200 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-amber-500 to-orange-500 h-full rounded-full transition-all"
                style={{ width: `${progressToNext}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {Math.max(0, nextMilestone.streak_days - streakDays)} more days to unlock {formatRewardValue(nextMilestone)}
            </p>
          </div>
        )}

        {/* Available rewards */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Available Rewards</p>
          <div className="space-y-2">
            {rewards.filter(r => r.streak_days <= streakDays && !claimedRewards.includes(r.id)).map((reward) => (
              <div
                key={reward.id}
                className="flex items-center justify-between p-3 bg-white/60 rounded-lg border border-amber-200"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                    <Gift className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{reward.streak_days} Day Streak</p>
                    <p className="text-xs text-muted-foreground">{formatRewardValue(reward)}</p>
                  </div>
                </div>
                <Button size="sm" onClick={() => claimReward(reward)}>
                  Claim
                </Button>
              </div>
            ))}
            {rewards.filter(r => r.streak_days <= streakDays && !claimedRewards.includes(r.id)).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">
                No rewards available to claim. Keep logging meals!
              </p>
            )}
          </div>
        </div>

        {/* Locked rewards preview */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Upcoming</p>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {rewards.filter(r => r.streak_days > streakDays).slice(0, 3).map((reward) => (
              <div
                key={reward.id}
                className="flex-shrink-0 p-3 bg-white/40 rounded-lg border border-dashed border-amber-300 opacity-60"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Lock className="w-3 h-3" />
                  <span className="text-xs font-medium">{reward.streak_days} days</span>
                </div>
                <p className="text-xs text-muted-foreground">{formatRewardValue(reward)}</p>
              </div>
            ))}
            {rewards.filter(r => r.streak_days > streakDays).length === 0 && (
              <p className="text-xs text-muted-foreground">All rewards unlocked! Amazing work!</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
