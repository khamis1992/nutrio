import { useState, useEffect } from 'react';
import { Trophy, Flame, Gift, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';

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
  const { t } = useLanguage();
  const { toast } = useToast();
  const [streakDays, setStreakDays] = useState(0);
  const [claimedRewards, setClaimedRewards] = useState<string[]>([]);
  const [rewards, setRewards] = useState<StreakReward[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchStreakData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchStreakData = async () => {
    try {
      const { data: rewardsData, error: rewardsError } = await supabase
        .from('streak_rewards')
        .select('*')
        .eq('is_active', true)
        .order('streak_days', { ascending: true });

      if (rewardsError) throw rewardsError;
      setRewards(rewardsData || []);

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('streak_days')
        .eq('user_id', user?.id)
        .single();

      if (profileError) throw profileError;
      setStreakDays(profile?.streak_days || 0);

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

      if (reward.reward_type === 'bonus_credit') {
        const { error: walletError } = await supabase.rpc('credit_wallet', {
          p_user_id: user.id,
          p_amount: reward.reward_value,
          p_type: 'bonus',
          p_reference_type: 'streak_reward',
          p_reference_id: reward.id,
          p_description: `${t('streakRewardTitle')}: ${reward.streak_days} ${t('days')}`,
        });

        if (walletError) {
          console.error('Wallet credit error:', walletError);
        }
      }

      setClaimedRewards([...claimedRewards, reward.id]);
      toast({
        title: t('rewardClaimed'),
        description: t('earnedReward', { description: reward.reward_description }),
      });
    } catch (err) {
      toast({
        title: t('error'),
        description: t('failedToClaimReward'),
        variant: 'destructive',
      });
    }
  };

  const getNextMilestone = () =>
    rewards.find(r => r.streak_days > streakDays) || rewards[rewards.length - 1];

  const formatRewardValue = (reward: StreakReward) => {
    switch (reward.reward_type) {
      case 'bonus_credit': return t('streak_reward_credit', { amount: reward.reward_value });
      case 'discount': return t('streak_reward_discount', { value: reward.reward_value });
      case 'free_meal': return t('streak_reward_free_meal');
      case 'badge':
        if (reward.streak_days === 7) return t('streak_7_day_desc');
        if (reward.streak_days === 30) return t('streak_30_day_desc');
        if (reward.streak_days === 60) return t('streak_60_day_desc');
        if (reward.streak_days === 90) return t('streak_90_day_desc');
        return reward.reward_description;
      default: return reward.reward_description;
    }
  };

  if (loading) return null;

  const nextMilestone = getNextMilestone();
  const progressToNext = nextMilestone
    ? Math.min((streakDays / nextMilestone.streak_days) * 100, 100)
    : 100;

  const claimableRewards = rewards.filter(
    r => r.streak_days <= streakDays && !claimedRewards.includes(r.id)
  );
  const upcomingRewards = rewards.filter(r => r.streak_days > streakDays);

  return (
    <>
      {/* Streak Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-orange-400 px-5 pt-5 pb-5">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl pointer-events-none" />

        <div className="relative flex items-center gap-4">
          <div className="flex flex-col items-center justify-center w-16 h-16 rounded-2xl bg-white/20 shrink-0">
            <Flame className="w-6 h-6 text-white" />
            <span className="text-white text-xl font-bold leading-none mt-0.5">{streakDays}</span>
          </div>
          <div className="flex-1">
            <p className="text-white font-bold text-lg leading-tight">
              {streakDays === 0 ? t('start_your_streak') : `${streakDays} ${t('day_streak')}`}
            </p>
            <p className="text-white/75 text-sm mt-0.5">
              {streakDays === 0
                ? t('order_today_to_begin')
                : streakDays === 1
                ? t('great_start_keep_going')
                : t('keep_ordering_to_earn')}
            </p>
          </div>
          <div className="flex flex-col items-center gap-0.5 shrink-0">
            <Trophy className="w-5 h-5 text-white/60" />
            <span className="text-white/60 text-[10px] font-medium">{t('rewards')}</span>
          </div>
        </div>

        {nextMilestone && (
          <div className="relative mt-4 space-y-1.5">
            <div className="flex justify-between text-xs text-white/80">
              <span>{t('next')}: {nextMilestone.streak_days} {t('day_reward')}</span>
              <span>{streakDays}/{nextMilestone.streak_days}</span>
            </div>
            <div className="w-full bg-white/25 rounded-full h-1.5">
              <div
                className="bg-white h-full rounded-full transition-all duration-700"
                style={{ width: `${progressToNext}%` }}
              />
            </div>
            <p className="text-xs text-white/70">
              {Math.max(0, nextMilestone.streak_days - streakDays) === 0
                ? `${t('ready_to_claim')}: ${formatRewardValue(nextMilestone)}`
                : `${Math.max(0, nextMilestone.streak_days - streakDays)} ${t('days_to_unlock')} ${formatRewardValue(nextMilestone)}`}
            </p>
          </div>
        )}
      </div>

      {/* Ready to Claim */}
      {claimableRewards.length > 0 && (
        <>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-1">{t('ready_to_claim')}</p>
          <div className="bg-card rounded-2xl overflow-hidden shadow-sm border border-border/50">
            {claimableRewards.map((reward, idx, arr) => (
              <div key={reward.id}>
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                    <Gift className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{reward.streak_days} {t('dayStreak')}</p>
                    <p className="text-xs text-muted-foreground truncate">{formatRewardValue(reward)}</p>
                  </div>
                  <button
                    onClick={() => claimReward(reward)}
                    className="shrink-0 px-3 py-1.5 rounded-full bg-amber-500 text-white text-xs font-semibold active:opacity-80 transition-opacity"
                  >
                    {t('claim')}
                  </button>
                </div>
                {idx < arr.length - 1 && <div className="h-px bg-border/60 ml-[52px]" />}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Upcoming Milestones */}
      {upcomingRewards.length > 0 && (
        <>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-1">{t('upcoming')}</p>
          <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
            {upcomingRewards.slice(0, 6).map((reward) => (
              <div
                key={reward.id}
                className="flex-shrink-0 flex flex-col items-center gap-1.5 px-4 py-3 bg-card rounded-2xl border border-border/50 min-w-[80px]"
              >
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <p className="text-xs font-bold text-foreground">{reward.streak_days}d</p>
                <p className="text-[10px] text-muted-foreground text-center leading-tight line-clamp-2">{formatRewardValue(reward)}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
