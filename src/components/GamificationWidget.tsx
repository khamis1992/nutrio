import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Trophy, 
  Star, 
  Zap, 
  Flame,
  Target,
  Medal,
  Crown,
  Award,
  Lock
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface UserGamification {
  xp: number;
  level: number;
  xpToNextLevel: number;
  totalBadges: number;
}

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  xpReward: number;
  unlocked: boolean;
  unlockedAt?: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

const BADGES: Badge[] = [
  {
    id: 'first_meal',
    name: 'First Bite',
    description: 'Log your first meal',
    icon: <Star className="w-6 h-6" />,
    xpReward: 50,
    unlocked: false,
    rarity: 'common',
  },
  {
    id: 'week_warrior',
    name: 'Week Warrior',
    description: 'Log meals for 7 days straight',
    icon: <Flame className="w-6 h-6" />,
    xpReward: 100,
    unlocked: false,
    rarity: 'common',
  },
  {
    id: 'nutrition_ninja',
    name: 'Nutrition Ninja',
    description: 'Hit your calorie goal 5 days in a row',
    icon: <Target className="w-6 h-6" />,
    xpReward: 150,
    unlocked: false,
    rarity: 'rare',
  },
  {
    id: 'streak_master',
    name: 'Streak Master',
    description: 'Maintain a 30-day streak',
    icon: <Zap className="w-6 h-6" />,
    xpReward: 300,
    unlocked: false,
    rarity: 'epic',
  },
  {
    id: 'variety_king',
    name: 'Variety King',
    description: 'Order from 10 different restaurants',
    icon: <Crown className="w-6 h-6" />,
    xpReward: 200,
    unlocked: false,
    rarity: 'rare',
  },
  {
    id: 'goal_crusher',
    name: 'Goal Crusher',
    description: 'Reach your target weight',
    icon: <Trophy className="w-6 h-6" />,
    xpReward: 500,
    unlocked: false,
    rarity: 'legendary',
  },
  {
    id: 'social_butterfly',
    name: 'Social Butterfly',
    description: 'Refer 3 friends who subscribe',
    icon: <Award className="w-6 h-6" />,
    xpReward: 250,
    unlocked: false,
    rarity: 'rare',
  },
  {
    id: 'subscription_hero',
    name: 'Subscription Hero',
    description: 'Maintain subscription for 6 months',
    icon: <Medal className="w-6 h-6" />,
    xpReward: 400,
    unlocked: false,
    rarity: 'epic',
  },
];

const RARITY_COLORS = {
  common: 'from-gray-400 to-gray-500',
  rare: 'from-blue-400 to-blue-600',
  epic: 'from-purple-400 to-purple-600',
  legendary: 'from-amber-400 to-amber-600',
};

const RARITY_BG = {
  common: 'bg-gray-50 border-gray-200',
  rare: 'bg-blue-50 border-blue-200',
  epic: 'bg-purple-50 border-purple-200',
  legendary: 'bg-amber-50 border-amber-200',
};

export function GamificationWidget() {
  const { user } = useAuth();
  const [gamification, setGamification] = useState<UserGamification>({
    xp: 0,
    level: 1,
    xpToNextLevel: 100,
    totalBadges: 0,
  });
  const [badges, setBadges] = useState<Badge[]>(BADGES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchGamificationData();
  }, [user]);

  const fetchGamificationData = async () => {
    try {
      // Get user XP and level
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('xp, level, streak_days, total_meals_logged')
        .eq('id', user?.id)
        .single();

      if (profileError) throw profileError;

      const xp = profile?.xp || 0;
      const level = profile?.level || 1;
      const xpToNextLevel = level * 100;

      setGamification({
        xp,
        level,
        xpToNextLevel,
        totalBadges: 0,
      });

      // Get unlocked badges
      const { data: unlockedBadges, error: badgesError } = await supabase
        .from('user_badges')
        .select('badge_id, unlocked_at')
        .eq('user_id', user?.id);

      if (badgesError) throw badgesError;

      const unlockedBadgeIds = new Set(unlockedBadges?.map(b => b.badge_id) || []);

      // Update badges with unlocked status
      const updatedBadges = BADGES.map(badge => ({
        ...badge,
        unlocked: unlockedBadgeIds.has(badge.id),
        unlockedAt: unlockedBadges?.find(b => b.badge_id === badge.id)?.unlocked_at,
      }));

      setBadges(updatedBadges);
      setGamification(prev => ({
        ...prev,
        totalBadges: unlockedBadgeIds.size,
      }));
    } catch (err) {
      console.error('Error fetching gamification data:', err);
    } finally {
      setLoading(false);
    }
  };

  const xpProgress = Math.min((gamification.xp / gamification.xpToNextLevel) * 100, 100);

  if (loading) return null;

  return (
    <Card className="bg-gradient-to-br from-violet-50 to-purple-50 border-violet-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-violet-600" />
            <CardTitle className="text-base font-semibold">Level {gamification.level}</CardTitle>
          </div>
          <Badge variant="outline" className="bg-white/50">
            <Star className="w-3 h-3 mr-1 text-amber-500" />
            {gamification.xp} XP
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* XP Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progress to Level {gamification.level + 1}</span>
            <span className="font-medium">{gamification.xp} / {gamification.xpToNextLevel} XP</span>
          </div>
          <Progress value={xpProgress} className="h-2" />
        </div>

        {/* Badges */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <p className="text-sm font-medium">Badges ({gamification.totalBadges}/{badges.length})</p>
          </div>
          
          <div className="grid grid-cols-4 gap-2">
            {badges.slice(0, 8).map((badge) => (
              <div
                key={badge.id}
                className={`relative aspect-square rounded-lg border flex flex-col items-center justify-center p-2 transition-all ${
                  badge.unlocked 
                    ? `${RARITY_BG[badge.rarity]} cursor-pointer hover:scale-105` 
                    : 'bg-gray-100 border-gray-200 opacity-50'
                }`}
                title={badge.unlocked ? `${badge.name}: ${badge.description}` : 'Locked'}
              >
                <div className={`${badge.unlocked ? '' : 'grayscale'}`}>
                  {badge.icon}
                </div>
                {!badge.unlocked && (
                  <Lock className="w-3 h-3 absolute bottom-1 right-1 text-gray-400" />
                )}
                {badge.unlocked && (
                  <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full bg-gradient-to-br ${RARITY_COLORS[badge.rarity]}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Recent Achievement */}
        {badges.find(b => b.unlocked)?.unlockedAt && (
          <div className="bg-white/60 p-3 rounded-lg border border-violet-200">
            <p className="text-xs text-muted-foreground mb-1">Latest Achievement</p>
            {(() => {
              const latestBadge = badges
                .filter(b => b.unlocked)
                .sort((a, b) => new Date(b.unlockedAt || 0).getTime() - new Date(a.unlockedAt || 0).getTime())[0];
              
              if (!latestBadge) return null;
              
              return (
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${RARITY_COLORS[latestBadge.rarity]} flex items-center justify-center text-white`}>
                    {latestBadge.icon}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{latestBadge.name}</p>
                    <p className="text-xs text-muted-foreground">+{latestBadge.xpReward} XP</p>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* How to earn XP */}
        <div className="text-xs text-muted-foreground">
          <p className="font-medium mb-1">Ways to earn XP:</p>
          <ul className="space-y-0.5 list-disc list-inside">
            <li>Log a meal (+10 XP)</li>
            <li>Maintain streak (+20 XP/day)</li>
            <li>Hit nutrition goals (+30 XP)</li>
            <li>Unlock badges (+50-500 XP)</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
