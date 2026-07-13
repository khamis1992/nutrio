import { useState, useEffect, useCallback } from "react";
import { 
  Flame, 
  Plus, 
  Pencil, 
  Trash2, 
  Check, 
  Loader2,
  Gift,
  Users,
  Crown,
  TrendingUp,
  Target
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdminLayout } from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";

type RewardType = 'bonus_credit' | 'free_meal' | 'discount' | 'badge';

interface StreakReward {
  id: string;
  streak_days: number;
  reward_type: RewardType;
  reward_value: number;
  reward_description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface StreakStats {
  totalRewards: number;
  activeRewards: number;
  totalClaims: number;
  totalValueClaimed: number;
  usersWithStreaks: number;
  avgStreakDays: number;
}

interface StreakRewardFormData {
  streak_days: number;
  reward_type: RewardType;
  reward_value: number;
  reward_description: string;
  is_active: boolean;
}

const defaultFormData: StreakRewardFormData = {
  streak_days: 7,
  reward_type: 'bonus_credit',
  reward_value: 10,
  reward_description: '',
  is_active: true,
};

const rewardTypeOptions = [
  { value: 'bonus_credit', label: 'Bonus Credit', icon: Gift },
  { value: 'free_meal', label: 'Free Meal', icon: Crown },
  { value: 'discount', label: 'Discount %', icon: TrendingUp },
  { value: 'badge', label: 'Badge', icon: Target },
];

const isRewardType = (value: string): value is RewardType =>
  rewardTypeOptions.some((option) => option.value === value);

export default function AdminStreakRewards() {
  const { toast } = useToast();
  const [rewards, setRewards] = useState<StreakReward[]>([]);
  const [stats, setStats] = useState<StreakStats>({
    totalRewards: 0,
    activeRewards: 0,
    totalClaims: 0,
    totalValueClaimed: 0,
    usersWithStreaks: 0,
    avgStreakDays: 0,
  });
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedReward, setSelectedReward] = useState<StreakReward | null>(null);
  const [formData, setFormData] = useState(defaultFormData);
  const [saving, setSaving] = useState(false);

  const fetchRewards = useCallback(async () => {
    try {
      // Fetch streak rewards
      const { data: rewardsData, error: rewardsError } = await supabase
        .from("streak_rewards")
        .select("*")
        .order("streak_days", { ascending: true });

      if (rewardsError) throw rewardsError;

      const validRewards = (rewardsData || []).flatMap((reward) =>
        isRewardType(reward.reward_type) ? [{ ...reward, reward_type: reward.reward_type }] : []
      );
      setRewards(validRewards);

      // Calculate stats
      const active = (rewardsData || []).filter((r) => r.is_active);
      
      // Get claimed rewards stats
      const { data: claimedData, error: claimedError } = await supabase
        .from("streak_rewards_claimed")
        .select("reward_value, reward_type");

      if (claimedError) throw claimedError;

      const totalValue = (claimedData || []).reduce((sum, c) => {
        if (c.reward_type === 'bonus_credit' || c.reward_type === 'discount') {
          return sum + Number(c.reward_value);
        }
        return sum;
      }, 0);

      // Get users with streaks
      const { data: streakData, error: streakError } = await supabase
        .from("profiles")
        .select("streak_days")
        .gt("streak_days", 0);

      if (streakError) throw streakError;

      const usersWithStreaks = streakData?.length || 0;
      const avgStreak = usersWithStreaks > 0 
        ? Math.round((streakData || []).reduce((sum, p) => sum + (p.streak_days || 0), 0) / usersWithStreaks)
        : 0;

      setStats({
        totalRewards: validRewards.length,
        activeRewards: active.length,
        totalClaims: claimedData?.length || 0,
        totalValueClaimed: totalValue,
        usersWithStreaks,
        avgStreakDays: avgStreak,
      });
    } catch (error) {
      console.error("Error fetching streak rewards:", error);
      toast({ title: "Error fetching streak rewards", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchRewards();
  }, [fetchRewards]);

  const handleOpenDialog = (reward?: StreakReward) => {
    if (reward) {
      setSelectedReward(reward);
      setFormData({
        streak_days: reward.streak_days,
        reward_type: reward.reward_type,
        reward_value: reward.reward_value,
        reward_description: reward.reward_description,
        is_active: reward.is_active,
      });
    } else {
      setSelectedReward(null);
      setFormData(defaultFormData);
    }
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (formData.streak_days < 1) {
      toast({ title: "Streak days must be at least 1", variant: "destructive" });
      return;
    }

    if (!formData.reward_description.trim()) {
      toast({ title: "Reward description is required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      if (selectedReward) {
        // Update existing reward
        const { error } = await supabase
          .from("streak_rewards")
          .update({
            streak_days: formData.streak_days,
            reward_type: formData.reward_type,
            reward_value: formData.reward_value,
            reward_description: formData.reward_description,
            is_active: formData.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq("id", selectedReward.id);

        if (error) throw error;
        toast({ title: "Streak reward updated successfully" });
      } else {
        // Create new reward
        const { error } = await supabase
          .from("streak_rewards")
          .insert({
            streak_days: formData.streak_days,
            reward_type: formData.reward_type,
            reward_value: formData.reward_value,
            reward_description: formData.reward_description,
            is_active: formData.is_active,
          });

        if (error) throw error;
        toast({ title: "Streak reward created successfully" });
      }

      setDialogOpen(false);
      fetchRewards();
    } catch (error: unknown) {
      console.error("Error saving streak reward:", error);
      toast({ title: "Error saving streak reward", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedReward) return;

    try {
      const { error } = await supabase
        .from("streak_rewards")
        .delete()
        .eq("id", selectedReward.id);

      if (error) throw error;

      toast({ title: "Streak reward deleted successfully" });
      setDeleteDialogOpen(false);
      setSelectedReward(null);
      fetchRewards();
    } catch (error: unknown) {
      console.error("Error deleting streak reward:", error);
      toast({ title: "Error deleting streak reward", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    }
  };

  const toggleActive = async (reward: StreakReward) => {
    try {
      const { error } = await supabase
        .from("streak_rewards")
        .update({ is_active: !reward.is_active, updated_at: new Date().toISOString() })
        .eq("id", reward.id);

      if (error) throw error;

      toast({ title: `Streak reward ${reward.is_active ? "disabled" : "enabled"}` });
      fetchRewards();
    } catch {
      toast({ title: "Error updating streak reward", variant: "destructive" });
    }
  };

  const getRewardTypeIcon = (type: string) => {
    const option = rewardTypeOptions.find(o => o.value === type);
    return option?.icon || Gift;
  };

  const getRewardTypeLabel = (type: string) => {
    return rewardTypeOptions.find(o => o.value === type)?.label || type;
  };

  const formatRewardValue = (reward: StreakReward) => {
    switch (reward.reward_type) {
      case 'bonus_credit':
        return formatCurrency(reward.reward_value);
      case 'discount':
        return `${reward.reward_value}% off`;
      case 'free_meal':
        return `${reward.reward_value} free meal${reward.reward_value > 1 ? 's' : ''}`;
      case 'badge':
        return reward.reward_description;
      default:
        return reward.reward_value.toString();
    }
  };

  if (loading) {
    return (
      <AdminLayout title="Streak Rewards" subtitle="Manage user streak rewards and milestones">
        <div className="flex h-64 items-center justify-center rounded-[28px] bg-[#F6F8FB]">
          <Loader2 className="h-8 w-8 animate-spin text-[#22C7A1]" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Streak Rewards" subtitle="Manage user streak rewards and milestones">
      <div className="space-y-4 bg-[#F6F8FB] text-[#020617] sm:space-y-5">
        <section className="overflow-hidden rounded-[28px] border border-[#E2E8F0] bg-white shadow-[0_18px_45px_rgba(2,6,23,0.06)]">
          <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl bg-[#22C7A1]/15 text-[#047857]">
                <Flame className="h-7 w-7" />
              </div>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#22C7A1]">
                  Streak engine
                </p>
                <h1 className="mt-1 text-[28px] font-black leading-tight text-[#020617]">
                  Streak Rewards
                </h1>
                <p className="mt-1 max-w-lg text-sm font-semibold leading-5 text-[#94A3B8]">
                  Manage meal logging milestones, active reward tiers, claims, and user streak engagement.
                </p>
              </div>
            </div>
            <Button
              onClick={() => handleOpenDialog()}
              className="h-12 rounded-2xl bg-[#020617] px-5 font-extrabold text-white shadow-[0_12px_24px_rgba(2,6,23,0.16)] hover:bg-[#020617]/90"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Reward
            </Button>
          </div>
        </section>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Card className="rounded-[24px] border-[#E2E8F0] bg-white shadow-[0_14px_34px_rgba(2,6,23,0.05)]">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#22C7A1]/12">
                  <Flame className="h-5 w-5 text-[#047857]" />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-black text-[#020617]">{stats.totalRewards}</p>
                  <p className="text-xs font-bold text-[#94A3B8]">Total Rewards</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[24px] border-[#E2E8F0] bg-white shadow-[0_14px_34px_rgba(2,6,23,0.05)]">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#22C7A1]/12">
                  <Check className="h-5 w-5 text-[#047857]" />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-black text-[#020617]">{stats.activeRewards}</p>
                  <p className="text-xs font-bold text-[#94A3B8]">Active</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[24px] border-[#E2E8F0] bg-white shadow-[0_14px_34px_rgba(2,6,23,0.05)]">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#38BDF8]/12">
                  <Gift className="h-5 w-5 text-[#0369A1]" />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-black text-[#020617]">{stats.totalClaims}</p>
                  <p className="text-xs font-bold text-[#94A3B8]">Claims</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[24px] border-[#E2E8F0] bg-white shadow-[0_14px_34px_rgba(2,6,23,0.05)]">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#7C83F6]/12">
                  <TrendingUp className="h-5 w-5 text-[#5B5FE8]" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xl font-black text-[#020617]">{formatCurrency(stats.totalValueClaimed)}</p>
                  <p className="text-xs font-bold text-[#94A3B8]">Value Claimed</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[24px] border-[#E2E8F0] bg-white shadow-[0_14px_34px_rgba(2,6,23,0.05)]">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#7C83F6]/12">
                  <Users className="h-5 w-5 text-[#5B5FE8]" />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-black text-[#020617]">{stats.usersWithStreaks}</p>
                  <p className="text-xs font-bold text-[#94A3B8]">Users w/ Streaks</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[24px] border-[#E2E8F0] bg-white shadow-[0_14px_34px_rgba(2,6,23,0.05)]">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FB6B7A]/12">
                  <Target className="h-5 w-5 text-[#BE123C]" />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-black text-[#020617]">{stats.avgStreakDays}</p>
                  <p className="text-xs font-bold text-[#94A3B8]">Avg Streak</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Streak Rewards Table */}
        <Card className="overflow-hidden rounded-[28px] border-[#E2E8F0] bg-white shadow-[0_14px_34px_rgba(2,6,23,0.05)]">
          <CardHeader className="flex flex-row items-center justify-between border-b border-[#E2E8F0]">
            <CardTitle className="flex items-center gap-2 text-lg font-black text-[#020617]">
              <Flame className="h-5 w-5 text-[#22C7A1]" />
              Streak Reward Tiers
            </CardTitle>
            <Button
              onClick={() => handleOpenDialog()}
              className="h-11 rounded-2xl bg-[#22C7A1] font-extrabold text-white hover:bg-[#1DB492]"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Reward
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid gap-3 p-4 md:hidden">
              {rewards.length === 0 ? (
                <div className="rounded-[24px] bg-[#F6F8FB] px-5 py-10 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-white text-[#94A3B8]">
                    <Gift className="h-7 w-7" />
                  </div>
                  <p className="mt-4 text-lg font-black text-[#020617]">No rewards yet</p>
                  <p className="mt-1 text-sm font-semibold text-[#94A3B8]">
                    Add your first streak reward tier.
                  </p>
                </div>
              ) : (
                rewards.map((reward) => {
                  const Icon = getRewardTypeIcon(reward.reward_type);
                  return (
                    <article
                      key={reward.id}
                      className="rounded-[24px] border border-[#E2E8F0] bg-[#F6F8FB] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#22C7A1] shadow-sm">
                            <Flame className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-lg font-black text-[#020617]">{reward.streak_days} days</p>
                            <p className="text-xs font-bold text-[#94A3B8]">{getRewardTypeLabel(reward.reward_type)}</p>
                          </div>
                        </div>
                        <Switch
                          checked={reward.is_active}
                          onCheckedChange={() => toggleActive(reward)}
                        />
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <div className="rounded-2xl bg-white p-3">
                          <Icon className="mb-2 h-4 w-4 text-[#7C83F6]" />
                          <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#94A3B8]">
                            Reward
                          </p>
                          <p className="mt-1 truncate text-sm font-black text-[#020617]">
                            {formatRewardValue(reward)}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-white p-3">
                          <div className={cn(
                            "mb-2 h-4 w-4 rounded-full",
                            reward.is_active ? "bg-[#22C7A1]" : "bg-[#FB6B7A]"
                          )} />
                          <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#94A3B8]">
                            Status
                          </p>
                          <p className="mt-1 text-sm font-black text-[#020617]">
                            {reward.is_active ? "Active" : "Disabled"}
                          </p>
                        </div>
                      </div>

                      <p className="mt-3 line-clamp-2 text-sm font-semibold text-[#64748B]">
                        {reward.reward_description}
                      </p>

                      <div className="mt-4 flex gap-2">
                        <Button
                          variant="outline"
                          className="h-11 flex-1 rounded-2xl border-[#E2E8F0] bg-white font-extrabold text-[#020617]"
                          onClick={() => handleOpenDialog(reward)}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          className="h-11 flex-1 rounded-2xl border-[#FB6B7A]/25 bg-white font-extrabold text-[#BE123C]"
                          onClick={() => {
                            setSelectedReward(reward);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </article>
                  );
                })
              )}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#F6F8FB] hover:bg-[#F6F8FB]">
                    <TableHead className="font-extrabold text-[#94A3B8]">Streak Days</TableHead>
                    <TableHead className="font-extrabold text-[#94A3B8]">Reward Type</TableHead>
                    <TableHead className="font-extrabold text-[#94A3B8]">Reward Value</TableHead>
                    <TableHead className="font-extrabold text-[#94A3B8]">Description</TableHead>
                    <TableHead className="text-center font-extrabold text-[#94A3B8]">Status</TableHead>
                    <TableHead className="text-right font-extrabold text-[#94A3B8]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rewards.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center font-semibold text-[#94A3B8]">
                        No streak rewards configured. Add your first reward tier!
                      </TableCell>
                    </TableRow>
                  ) : (
                    rewards.map((reward) => {
                      const Icon = getRewardTypeIcon(reward.reward_type);
                      return (
                        <TableRow key={reward.id}>
                          <TableCell>
                            <Badge variant="outline" className="gap-1 rounded-full border-[#22C7A1]/25 bg-[#22C7A1]/10 px-3 py-1 text-base font-black text-[#047857]">
                              <Flame className="h-4 w-4" />
                              {reward.streak_days} days
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4 text-[#7C83F6]" />
                              <span className="font-bold text-[#020617]">{getRewardTypeLabel(reward.reward_type)}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-black text-[#22C7A1]">
                              {formatRewardValue(reward)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <p className="max-w-[200px] truncate text-sm font-semibold text-[#94A3B8]">
                              {reward.reward_description}
                            </p>
                          </TableCell>
                          <TableCell className="text-center">
                            <Switch
                              checked={reward.is_active}
                              onCheckedChange={() => toggleActive(reward)}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="min-h-[44px] min-w-[44px] rounded-2xl text-[#94A3B8] hover:bg-[#F6F8FB] hover:text-[#020617]"
                                onClick={() => handleOpenDialog(reward)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="min-h-[44px] min-w-[44px] rounded-2xl text-[#FB6B7A] hover:bg-[#FB6B7A]/10 hover:text-[#BE123C]"
                                onClick={() => {
                                  setSelectedReward(reward);
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="rounded-[28px] border-[#E2E8F0] bg-white shadow-[0_14px_34px_rgba(2,6,23,0.05)]">
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#22C7A1]/12">
                <Flame className="h-5 w-5 text-[#047857]" />
              </div>
              <div>
                <h3 className="mb-2 font-black text-[#020617]">How Streak Rewards Work</h3>
                <ul className="list-inside list-disc space-y-1 text-sm font-semibold text-[#94A3B8]">
                  <li>Users build streaks by logging meals on consecutive days</li>
                  <li>When a user reaches a streak milestone, they unlock the reward</li>
                  <li>Users can claim rewards from their profile page</li>
                  <li>Rewards are automatically applied to their account (credits, discounts, etc.)</li>
                  <li>Missing a day resets the streak to 0</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="mx-4 max-h-[90vh] max-w-[95vw] overflow-y-auto rounded-[28px] border-[#E2E8F0] bg-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-[#020617]">
              {selectedReward ? "Edit Streak Reward" : "Add New Streak Reward"}
            </DialogTitle>
            <DialogDescription className="font-semibold text-[#94A3B8]">
              Configure a reward that users can earn by maintaining a meal logging streak.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="streak_days" className="font-extrabold text-[#020617]">Streak Days Required</Label>
              <Input
                id="streak_days"
                type="number"
                inputMode="numeric"
                min={1}
                value={formData.streak_days}
                onChange={(e) => setFormData({ ...formData, streak_days: parseInt(e.target.value) || 0 })}
                className="min-h-[44px] rounded-2xl border-[#E2E8F0] bg-[#F6F8FB] font-bold text-[#020617] sm:h-10"
                placeholder="e.g., 7"
              />
              <p className="text-xs font-semibold text-[#94A3B8]">
                Number of consecutive days users must log meals
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reward_type" className="font-extrabold text-[#020617]">Reward Type</Label>
              <Select
                value={formData.reward_type}
                onValueChange={(value: typeof formData.reward_type) => setFormData({ ...formData, reward_type: value })}
              >
                <SelectTrigger className="min-h-[44px] rounded-2xl border-[#E2E8F0] bg-[#F6F8FB] font-bold text-[#020617] sm:h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {rewardTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <option.icon className="h-4 w-4" />
                        {option.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reward_value" className="font-extrabold text-[#020617]">
                {formData.reward_type === 'discount' ? 'Discount Percentage' : 
                 formData.reward_type === 'free_meal' ? 'Number of Free Meals' : 
                 formData.reward_type === 'badge' ? 'Badge Level (cosmetic)' : 'Bonus Amount (QAR)'}
              </Label>
              <Input
                id="reward_value"
                type="number"
                inputMode="decimal"
                min={0}
                step={formData.reward_type === 'discount' ? 1 : 0.01}
                value={formData.reward_value}
                onChange={(e) => setFormData({ ...formData, reward_value: parseFloat(e.target.value) || 0 })}
                className="min-h-[44px] rounded-2xl border-[#E2E8F0] bg-[#F6F8FB] font-bold text-[#020617] sm:h-10"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reward_description" className="font-extrabold text-[#020617]">Reward Description</Label>
              <Textarea
                id="reward_description"
                placeholder="e.g., QAR 10 bonus credit for 7-day streak"
                value={formData.reward_description}
                onChange={(e) => setFormData({ ...formData, reward_description: e.target.value })}
                className="min-h-[80px] rounded-2xl border-[#E2E8F0] bg-[#F6F8FB] font-bold text-[#020617] sm:min-h-[100px]"
              />
              <p className="text-xs font-semibold text-[#94A3B8]">
                This description will be shown to users when they unlock the reward
              </p>
            </div>

            <div className="flex items-center justify-between rounded-2xl bg-[#F6F8FB] p-3">
              <div className="space-y-0.5">
                <Label className="font-extrabold text-[#020617]">Active</Label>
                <p className="text-sm font-semibold text-[#94A3B8]">
                  Enable this reward for users to earn
                </p>
              </div>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="h-11 rounded-2xl border-[#E2E8F0] bg-white font-extrabold text-[#020617]">
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saving} className="h-11 rounded-2xl bg-[#22C7A1] font-extrabold text-white hover:bg-[#1DB492]">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {selectedReward ? "Save Changes" : "Create Reward"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-[28px] border-[#E2E8F0] bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black text-[#020617]">Delete Streak Reward</AlertDialogTitle>
            <AlertDialogDescription className="font-semibold text-[#94A3B8]">
              Are you sure you want to delete the reward for {selectedReward?.streak_days} day streak? 
              This will remove the reward from being available to users. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11 rounded-2xl border-[#E2E8F0] bg-white font-extrabold text-[#020617]">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="h-11 rounded-2xl bg-[#FB6B7A] font-extrabold text-white hover:bg-[#E85D6C]">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
