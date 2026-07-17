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
  Target,
} from "lucide-react";
import {
  AdminDialogContent,
  AdminAlertDialogContent,
  AdminEmptyState,
  AdminMetricTile,
  AdminPanel,
  AdminPanelHeader,
  AdminWorkbenchHeader,
} from "@/components/admin/AdminPrimitives";
import { Button } from "@/components/ui/button";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
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

type RewardType = "bonus_credit" | "free_meal" | "discount" | "badge";

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
  reward_type: "bonus_credit",
  reward_value: 10,
  reward_description: "",
  is_active: true,
};

const rewardTypeOptions = [
  { value: "bonus_credit", label: "Bonus Credit", icon: Gift },
  { value: "free_meal", label: "Free Meal", icon: Crown },
  { value: "discount", label: "Discount %", icon: TrendingUp },
  { value: "badge", label: "Badge", icon: Target },
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
  const [selectedReward, setSelectedReward] = useState<StreakReward | null>(
    null,
  );
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
        isRewardType(reward.reward_type)
          ? [{ ...reward, reward_type: reward.reward_type }]
          : [],
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
        if (c.reward_type === "bonus_credit" || c.reward_type === "discount") {
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
      const avgStreak =
        usersWithStreaks > 0
          ? Math.round(
              (streakData || []).reduce(
                (sum, p) => sum + (p.streak_days || 0),
                0,
              ) / usersWithStreaks,
            )
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
      toast({
        title: "Streak days must be at least 1",
        variant: "destructive",
      });
      return;
    }

    if (!formData.reward_description.trim()) {
      toast({
        title: "Reward description is required",
        variant: "destructive",
      });
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
        const { error } = await supabase.from("streak_rewards").insert({
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
      toast({
        title: "Error saving streak reward",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
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
      toast({
        title: "Error deleting streak reward",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const toggleActive = async (reward: StreakReward) => {
    try {
      const { error } = await supabase
        .from("streak_rewards")
        .update({
          is_active: !reward.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", reward.id);

      if (error) throw error;

      toast({
        title: `Streak reward ${reward.is_active ? "disabled" : "enabled"}`,
      });
      fetchRewards();
    } catch {
      toast({ title: "Error updating streak reward", variant: "destructive" });
    }
  };

  const getRewardTypeIcon = (type: string) => {
    const option = rewardTypeOptions.find((o) => o.value === type);
    return option?.icon || Gift;
  };

  const getRewardTypeLabel = (type: string) => {
    return rewardTypeOptions.find((o) => o.value === type)?.label || type;
  };

  const formatRewardValue = (reward: StreakReward) => {
    switch (reward.reward_type) {
      case "bonus_credit":
        return formatCurrency(reward.reward_value);
      case "discount":
        return `${reward.reward_value}% off`;
      case "free_meal":
        return `${reward.reward_value} free meal${reward.reward_value > 1 ? "s" : ""}`;
      case "badge":
        return reward.reward_description;
      default:
        return reward.reward_value.toString();
    }
  };

  const metricCards = [
    {
      label: "Total Rewards",
      value: stats.totalRewards,
      icon: Flame,
      accent: "#22C7A1" as const,
    },
    {
      label: "Active",
      value: stats.activeRewards,
      icon: Check,
      accent: "#22C7A1" as const,
    },
    {
      label: "Claims",
      value: stats.totalClaims,
      icon: Gift,
      accent: "#38BDF8" as const,
    },
    {
      label: "Value Claimed",
      value: formatCurrency(stats.totalValueClaimed),
      icon: TrendingUp,
      accent: "#7C83F6" as const,
    },
    {
      label: "Users w/ Streaks",
      value: stats.usersWithStreaks,
      icon: Users,
      accent: "#7C83F6" as const,
    },
    {
      label: "Avg Streak",
      value: stats.avgStreakDays,
      icon: Target,
      accent: "#FB6B7A" as const,
    },
  ];

  if (loading) {
    return (
      <AdminLayout
        title="Streak Rewards"
        subtitle="Manage user streak rewards and milestones"
      >
        <div className="flex h-64 items-center justify-center rounded-[28px] bg-[#F6F8FB]">
          <Loader2 className="h-8 w-8 animate-spin text-[#22C7A1]" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Streak Rewards"
      subtitle="Manage user streak rewards and milestones"
    >
      <div className="space-y-4 bg-[#F6F8FB] text-[#020617] sm:space-y-5">
        <AdminWorkbenchHeader
          eyebrow="Streak engine"
          title="Reward tiers workbench"
          icon={Flame}
          accent="#22C7A1"
          description="Manage meal logging milestones, active reward tiers, claim volume, and user streak engagement from one reward operations desk."
          meta={[
            { label: "Active rewards", value: stats.activeRewards },
            { label: "Claims", value: stats.totalClaims },
            { label: "Users with streaks", value: stats.usersWithStreaks },
          ]}
          actions={
            <Button
              onClick={() => handleOpenDialog()}
              variant="outline"
              className="h-12 rounded-2xl border-[#7C83F6]/30 bg-[#7C83F6]/10 px-5 font-extrabold text-[#020617] shadow-none hover:bg-[#7C83F6]/15"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Reward
            </Button>
          }
        />

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {metricCards.map((metric) => (
            <AdminMetricTile
              key={metric.label}
              label={metric.label}
              value={metric.value}
              icon={metric.icon}
              accent={metric.accent}
              className="bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-[0_18px_44px_rgba(2,6,23,0.075)]"
            />
          ))}
        </div>

        {/* Streak Rewards Table */}
        <AdminPanel>
          <AdminPanelHeader
            title="Streak Reward Tiers"
            eyebrow="Reward engine"
            actions={
              <Button
                onClick={() => handleOpenDialog()}
                variant="outline"
                className="h-11 rounded-2xl border-[#22C7A1]/30 bg-[#22C7A1]/10 font-extrabold text-[#020617] hover:bg-[#22C7A1]/15"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Reward
              </Button>
            }
          />
          <div className="p-0">
            <div className="grid gap-3 p-4 md:hidden">
              {rewards.length === 0 ? (
                <AdminEmptyState
                  icon={Gift}
                  title="No rewards yet"
                  description="Add your first streak reward tier."
                  className="rounded-[24px] bg-[#F6F8FB] px-5 py-10"
                />
              ) : (
                rewards.map((reward) => {
                  const Icon = getRewardTypeIcon(reward.reward_type);
                  return (
                    <article
                      key={reward.id}
                      className="rounded-[24px] border border-[#E5EAF1] bg-[#F6F8FB] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#22C7A1] shadow-[0_10px_24px_rgba(2,6,23,0.045)]">
                            <Flame className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-lg font-black text-[#020617]">
                              {reward.streak_days} days
                            </p>
                            <p className="text-xs font-bold text-[#94A3B8]">
                              {getRewardTypeLabel(reward.reward_type)}
                            </p>
                          </div>
                        </div>
                        <Switch
                          checked={reward.is_active}
                          onCheckedChange={() => toggleActive(reward)}
                        />
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
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
                          <div
                            className={cn(
                              "mb-2 h-4 w-4 rounded-full",
                              reward.is_active
                                ? "bg-[#22C7A1]"
                                : "bg-[#FB6B7A]",
                            )}
                          />
                          <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#94A3B8]">
                            Status
                          </p>
                          <p className="mt-1 text-sm font-black text-[#020617]">
                            {reward.is_active ? "Active" : "Disabled"}
                          </p>
                        </div>
                      </div>

                      <p className="mt-3 line-clamp-2 text-sm font-semibold text-[#94A3B8]">
                        {reward.reward_description}
                      </p>

                      <div className="mt-4 flex gap-2">
                        <Button
                          variant="outline"
                          className="h-11 flex-1 rounded-2xl border-[#E5EAF1] bg-white font-extrabold text-[#020617]"
                          onClick={() => handleOpenDialog(reward)}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          className="h-11 flex-1 rounded-2xl border-[#FB6B7A]/25 bg-white font-extrabold text-[#FB6B7A]"
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
                <TableHeader className="bg-[#F6F8FB]">
                  <TableRow className="border-[#E5EAF1] hover:bg-[#F6F8FB]">
                    <TableHead className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                      Streak Days
                    </TableHead>
                    <TableHead className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                      Reward Type
                    </TableHead>
                    <TableHead className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                      Reward Value
                    </TableHead>
                    <TableHead className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                      Description
                    </TableHead>
                    <TableHead className="text-center text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                      Status
                    </TableHead>
                    <TableHead className="text-right text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rewards.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="p-0">
                        <AdminEmptyState
                          icon={Gift}
                          title="No streak rewards configured"
                          description="Add your first reward tier."
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    rewards.map((reward) => {
                      const Icon = getRewardTypeIcon(reward.reward_type);
                      return (
                        <TableRow
                          key={reward.id}
                          className="border-[#E5EAF1] transition-colors hover:bg-[#F6F8FB]/70"
                        >
                          <TableCell>
                            <Badge
                              variant="outline"
                              className="gap-1 rounded-full border-[#22C7A1]/25 bg-[#22C7A1]/10 px-3 py-1 text-base font-black text-[#22C7A1]"
                            >
                              <Flame className="h-4 w-4" />
                              {reward.streak_days} days
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4 text-[#7C83F6]" />
                              <span className="font-bold text-[#020617]">
                                {getRewardTypeLabel(reward.reward_type)}
                              </span>
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
                                aria-label={`Edit streak reward for ${reward.streak_days} days`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="min-h-[44px] min-w-[44px] rounded-2xl text-[#FB6B7A] hover:bg-[#FB6B7A]/10 hover:text-[#FB6B7A]"
                                onClick={() => {
                                  setSelectedReward(reward);
                                  setDeleteDialogOpen(true);
                                }}
                                aria-label={`Delete streak reward for ${reward.streak_days} days`}
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
          </div>
        </AdminPanel>

        {/* Info Card */}
        <AdminPanel>
          <div className="p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#22C7A1]/12">
                <Flame className="h-5 w-5 text-[#22C7A1]" />
              </div>
              <div>
                <h3 className="mb-2 font-black text-[#020617]">
                  How Streak Rewards Work
                </h3>
                <ul className="list-inside list-disc space-y-1 text-sm font-semibold text-[#94A3B8]">
                  <li>
                    Users build streaks by logging meals on consecutive days
                  </li>
                  <li>
                    When a user reaches a streak milestone, they unlock the
                    reward
                  </li>
                  <li>Users can claim rewards from their profile page</li>
                  <li>
                    Rewards are automatically applied to their account (credits,
                    discounts, etc.)
                  </li>
                  <li>Missing a day resets the streak to 0</li>
                </ul>
              </div>
            </div>
          </div>
        </AdminPanel>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AdminDialogContent size="md">
          <DialogHeader className="border-b border-[#E5EAF1] bg-[#F6F8FB] px-5 py-4 text-left">
            <DialogTitle className="text-xl font-black text-[#020617]">
              {selectedReward ? "Edit Streak Reward" : "Add New Streak Reward"}
            </DialogTitle>
            <DialogDescription className="font-semibold text-[#94A3B8]">
              Configure a reward that users can earn by maintaining a meal
              logging streak.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 bg-[#F6F8FB] px-5 py-4">
            <div className="space-y-2">
              <Label
                htmlFor="streak_days"
                className="font-extrabold text-[#020617]"
              >
                Streak Days Required
              </Label>
              <Input
                id="streak_days"
                type="number"
                inputMode="numeric"
                min={1}
                value={formData.streak_days}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    streak_days: parseInt(e.target.value) || 0,
                  })
                }
                className="min-h-[44px] rounded-2xl border-[#E5EAF1] bg-[#F6F8FB] font-bold text-[#020617] sm:h-10"
                placeholder="e.g., 7"
              />
              <p className="text-xs font-semibold text-[#94A3B8]">
                Number of consecutive days users must log meals
              </p>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="reward_type"
                className="font-extrabold text-[#020617]"
              >
                Reward Type
              </Label>
              <Select
                value={formData.reward_type}
                onValueChange={(value: typeof formData.reward_type) =>
                  setFormData({ ...formData, reward_type: value })
                }
              >
                <SelectTrigger className="min-h-[44px] rounded-2xl border-[#E5EAF1] bg-[#F6F8FB] font-bold text-[#020617] sm:h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-[18px] border-[#E5EAF1] bg-white text-[#020617] shadow-[0_18px_42px_rgba(2,6,23,0.12)]">
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
              <Label
                htmlFor="reward_value"
                className="font-extrabold text-[#020617]"
              >
                {formData.reward_type === "discount"
                  ? "Discount Percentage"
                  : formData.reward_type === "free_meal"
                    ? "Number of Free Meals"
                    : formData.reward_type === "badge"
                      ? "Badge Level (cosmetic)"
                      : "Bonus Amount (QAR)"}
              </Label>
              <Input
                id="reward_value"
                type="number"
                inputMode="decimal"
                min={0}
                step={formData.reward_type === "discount" ? 1 : 0.01}
                value={formData.reward_value}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    reward_value: parseFloat(e.target.value) || 0,
                  })
                }
                className="min-h-[44px] rounded-2xl border-[#E5EAF1] bg-[#F6F8FB] font-bold text-[#020617] sm:h-10"
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="reward_description"
                className="font-extrabold text-[#020617]"
              >
                Reward Description
              </Label>
              <Textarea
                id="reward_description"
                placeholder="e.g., QAR 10 bonus credit for 7-day streak"
                value={formData.reward_description}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    reward_description: e.target.value,
                  })
                }
                className="min-h-[80px] rounded-2xl border-[#E5EAF1] bg-[#F6F8FB] font-bold text-[#020617] sm:min-h-[100px]"
              />
              <p className="text-xs font-semibold text-[#94A3B8]">
                This description will be shown to users when they unlock the
                reward
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
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_active: checked })
                }
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-3 border-t border-[#E5EAF1] bg-[#F6F8FB] px-5 py-4">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="h-11 rounded-2xl border-[#E5EAF1] bg-white font-extrabold text-[#020617]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={saving}
              className="h-11 rounded-2xl bg-[#22C7A1] font-extrabold text-white hover:bg-[#22C7A1]"
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {selectedReward ? "Save Changes" : "Create Reward"}
            </Button>
          </DialogFooter>
        </AdminDialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AdminAlertDialogContent>
          <AlertDialogHeader className="border-b border-[#E5EAF1] bg-[#F6F8FB] px-5 py-4 text-left">
            <AlertDialogTitle className="text-xl font-black text-[#020617]">
              Delete Streak Reward
            </AlertDialogTitle>
            <AlertDialogDescription className="font-semibold text-[#94A3B8]">
              Are you sure you want to delete the reward for{" "}
              {selectedReward?.streak_days} day streak? This will remove the
              reward from being available to users. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-3 border-t border-[#E5EAF1] bg-[#F6F8FB] px-5 py-4">
            <AlertDialogCancel className="h-11 rounded-2xl border-[#E5EAF1] bg-white font-extrabold text-[#020617]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="h-11 rounded-2xl bg-[#FB6B7A] font-extrabold text-white hover:bg-[#FB6B7A]"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AdminAlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
