import { useState, useEffect, useCallback } from "react";
import { 
  Flame, 
  Plus, 
  Pencil, 
  Trash2, 
  Check, 
  X, 
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

interface StreakReward {
  id: string;
  streak_days: number;
  reward_type: 'bonus_credit' | 'free_meal' | 'discount' | 'badge';
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

const defaultFormData = {
  streak_days: 7,
  reward_type: 'bonus_credit' as const,
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

      setRewards(rewardsData || []);

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
        totalRewards: rewardsData?.length || 0,
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
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Streak Rewards" subtitle="Manage user streak rewards and milestones">
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Flame className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalRewards}</p>
                  <p className="text-xs text-muted-foreground">Total Rewards</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <Check className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.activeRewards}</p>
                  <p className="text-xs text-muted-foreground">Active</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                  <Gift className="h-5 w-5 text-cyan-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalClaims}</p>
                  <p className="text-xs text-muted-foreground">Claims</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatCurrency(stats.totalValueClaimed)}</p>
                  <p className="text-xs text-muted-foreground">Value Claimed</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.usersWithStreaks}</p>
                  <p className="text-xs text-muted-foreground">Users w/ Streaks</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-rose-500/10 flex items-center justify-center">
                  <Target className="h-5 w-5 text-rose-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.avgStreakDays}</p>
                  <p className="text-xs text-muted-foreground">Avg Streak</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Streak Rewards Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Flame className="h-5 w-5" />
              Streak Reward Tiers
            </CardTitle>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Reward
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Streak Days</TableHead>
                    <TableHead>Reward Type</TableHead>
                    <TableHead>Reward Value</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rewards.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No streak rewards configured. Add your first reward tier!
                      </TableCell>
                    </TableRow>
                  ) : (
                    rewards.map((reward) => {
                      const Icon = getRewardTypeIcon(reward.reward_type);
                      return (
                        <TableRow key={reward.id}>
                          <TableCell>
                            <Badge variant="outline" className="gap-1 text-base px-3 py-1">
                              <Flame className="h-4 w-4 text-orange-500" />
                              {reward.streak_days} days
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4 text-muted-foreground" />
                              <span>{getRewardTypeLabel(reward.reward_type)}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-semibold text-green-600">
                              {formatRewardValue(reward)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm text-muted-foreground max-w-[200px] truncate">
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
                                className="min-h-[44px] min-w-[44px]"
                                onClick={() => handleOpenDialog(reward)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="min-h-[44px] min-w-[44px] text-destructive hover:text-destructive"
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
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Flame className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-2">How Streak Rewards Work</h3>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
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
        <DialogContent className="max-w-[95vw] sm:max-w-md mx-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedReward ? "Edit Streak Reward" : "Add New Streak Reward"}
            </DialogTitle>
            <DialogDescription>
              Configure a reward that users can earn by maintaining a meal logging streak.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="streak_days">Streak Days Required</Label>
              <Input
                id="streak_days"
                type="number"
                inputMode="numeric"
                min={1}
                value={formData.streak_days}
                onChange={(e) => setFormData({ ...formData, streak_days: parseInt(e.target.value) || 0 })}
                className="h-12 sm:h-10 min-h-[44px]"
                placeholder="e.g., 7"
              />
              <p className="text-xs text-muted-foreground">
                Number of consecutive days users must log meals
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reward_type">Reward Type</Label>
              <Select
                value={formData.reward_type}
                onValueChange={(value: typeof formData.reward_type) => setFormData({ ...formData, reward_type: value })}
              >
                <SelectTrigger className="h-12 sm:h-10 min-h-[44px]">
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
              <Label htmlFor="reward_value">
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
                className="h-12 sm:h-10 min-h-[44px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reward_description">Reward Description</Label>
              <Textarea
                id="reward_description"
                placeholder="e.g., QAR 10 bonus credit for 7-day streak"
                value={formData.reward_description}
                onChange={(e) => setFormData({ ...formData, reward_description: e.target.value })}
                className="min-h-[80px] sm:min-h-[100px]"
              />
              <p className="text-xs text-muted-foreground">
                This description will be shown to users when they unlock the reward
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Active</Label>
                <p className="text-sm text-muted-foreground">
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
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {selectedReward ? "Save Changes" : "Create Reward"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Streak Reward</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the reward for {selectedReward?.streak_days} day streak? 
              This will remove the reward from being available to users. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
