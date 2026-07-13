import { useState, useEffect, useCallback } from "react";
import {
  Trophy,
  Plus,
  Pencil,
  Trash2,
  Check,
  Loader2,
  DollarSign,
  Users,
  Gift,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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

interface Milestone {
  id: string;
  referral_count: number;
  bonus_amount: number;
  bonus_type: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

interface MilestoneStats {
  totalMilestones: number;
  activeMilestones: number;
  totalBonusValue: number;
  totalAchievements: number;
}

const defaultFormData = {
  name: "",
  description: "",
  referral_count: 10,
  bonus_amount: 25,
  bonus_type: "cash",
  is_active: true,
};

export default function AdminMilestones() {
  const { toast } = useToast();
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [stats, setStats] = useState<MilestoneStats>({
    totalMilestones: 0,
    activeMilestones: 0,
    totalBonusValue: 0,
    totalAchievements: 0,
  });
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(
    null,
  );
  const [formData, setFormData] = useState(defaultFormData);
  const [saving, setSaving] = useState(false);

  const fetchMilestones = useCallback(async () => {
    try {
      const { data: milestonesData, error: milestonesError } = await supabase
        .from("referral_milestones")
        .select("*")
        .order("referral_count", { ascending: true });

      if (milestonesError) throw milestonesError;

      setMilestones(milestonesData || []);

      // Calculate stats
      const active = (milestonesData || []).filter((m) => m.is_active);
      const totalBonus = (milestonesData || []).reduce(
        (sum, m) => sum + Number(m.bonus_amount),
        0,
      );

      // Get total achievements count
      const { count: achievementsCount } = await supabase
        .from("user_milestone_achievements")
        .select("*", { count: "exact", head: true });

      setStats({
        totalMilestones: milestonesData?.length || 0,
        activeMilestones: active.length,
        totalBonusValue: totalBonus,
        totalAchievements: achievementsCount || 0,
      });
    } catch (error) {
      console.error("Error fetching milestones:", error);
      toast({ title: "Error fetching milestones", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchMilestones();
  }, [fetchMilestones]);

  const handleOpenDialog = (milestone?: Milestone) => {
    if (milestone) {
      setSelectedMilestone(milestone);
      setFormData({
        name: milestone.name,
        description: milestone.description || "",
        referral_count: milestone.referral_count,
        bonus_amount: milestone.bonus_amount,
        bonus_type: milestone.bonus_type,
        is_active: milestone.is_active,
      });
    } else {
      setSelectedMilestone(null);
      setFormData(defaultFormData);
    }
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      if (selectedMilestone) {
        // Update existing milestone
        const { error } = await supabase
          .from("referral_milestones")
          .update({
            name: formData.name,
            description: formData.description || null,
            referral_count: formData.referral_count,
            bonus_amount: formData.bonus_amount,
            bonus_type: formData.bonus_type,
            is_active: formData.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq("id", selectedMilestone.id);

        if (error) throw error;
        toast({ title: "Milestone updated successfully" });
      } else {
        // Create new milestone
        const { error } = await supabase.from("referral_milestones").insert({
          name: formData.name,
          description: formData.description || null,
          referral_count: formData.referral_count,
          bonus_amount: formData.bonus_amount,
          bonus_type: formData.bonus_type,
          is_active: formData.is_active,
        });

        if (error) throw error;
        toast({ title: "Milestone created successfully" });
      }

      setDialogOpen(false);
      fetchMilestones();
    } catch (error: unknown) {
      console.error("Error saving milestone:", error);
      const message =
        error instanceof Error ? error.message : "Error saving milestone";
      toast({
        title: "Error saving milestone",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedMilestone) return;

    try {
      const { error } = await supabase
        .from("referral_milestones")
        .delete()
        .eq("id", selectedMilestone.id);

      if (error) throw error;

      toast({ title: "Milestone deleted successfully" });
      setDeleteDialogOpen(false);
      setSelectedMilestone(null);
      fetchMilestones();
    } catch (error: unknown) {
      console.error("Error deleting milestone:", error);
      const message =
        error instanceof Error ? error.message : "Error deleting milestone";
      toast({
        title: "Error deleting milestone",
        description: message,
        variant: "destructive",
      });
    }
  };

  const toggleActive = async (milestone: Milestone) => {
    try {
      const { error } = await supabase
        .from("referral_milestones")
        .update({
          is_active: !milestone.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", milestone.id);

      if (error) throw error;

      toast({
        title: `Milestone ${milestone.is_active ? "disabled" : "enabled"}`,
      });
      fetchMilestones();
    } catch (error: unknown) {
      toast({ title: "Error updating milestone", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <AdminLayout
        title="Affiliate Milestones"
        subtitle="Manage affiliate milestone bonuses"
      >
        <div className="flex h-64 items-center justify-center bg-[#F6F8FB] text-[#020617]">
          <Loader2 className="h-8 w-8 animate-spin text-[#7C83F6]" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Affiliate Milestones"
      subtitle="Manage affiliate milestone bonuses"
    >
      <div className="space-y-6 bg-[#F6F8FB] text-[#020617]">
        <section className="overflow-hidden rounded-[28px] border border-[#E5EAF1] bg-white p-5 text-[#020617] shadow-[0_18px_44px_rgba(2,6,23,0.06)] sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#7C83F6]/15 bg-[#7C83F6]/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-[#7C83F6]">
                <Trophy className="h-3.5 w-3.5" />
                Affiliate growth
              </div>
              <h2 className="text-2xl font-black tracking-tight sm:text-3xl">
                Milestone bonus rules
              </h2>
              <p className="mt-2 max-w-xl text-sm font-semibold leading-6 text-[#94A3B8]">
                Configure referral thresholds, reward values, and active
                campaigns affiliates can unlock.
              </p>
            </div>
            <Button
              onClick={() => handleOpenDialog()}
              className="min-h-[48px] rounded-2xl bg-[#020617] px-5 font-bold text-white hover:bg-[#020617]/90"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Milestone
            </Button>
          </div>
        </section>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="rounded-[24px] border-[#E5EAF1] bg-white shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#7C83F6]/10">
                  <Trophy className="h-5 w-5 text-[#7C83F6]" />
                </div>
                <div>
                  <p className="text-2xl font-black text-[#020617]">
                    {stats.totalMilestones}
                  </p>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#94A3B8]">
                    Total
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[24px] border-[#E5EAF1] bg-white shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#22C7A1]/10">
                  <Check className="h-5 w-5 text-[#22C7A1]" />
                </div>
                <div>
                  <p className="text-2xl font-black text-[#020617]">
                    {stats.activeMilestones}
                  </p>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#94A3B8]">
                    Active
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[24px] border-[#E5EAF1] bg-white shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F97316]/10">
                  <DollarSign className="h-5 w-5 text-[#F97316]" />
                </div>
                <div>
                  <p className="text-2xl font-black text-[#020617]">
                    {formatCurrency(stats.totalBonusValue)}
                  </p>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#94A3B8]">
                    Bonus Value
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[24px] border-[#E5EAF1] bg-white shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#38BDF8]/10">
                  <Gift className="h-5 w-5 text-[#38BDF8]" />
                </div>
                <div>
                  <p className="text-2xl font-black text-[#020617]">
                    {stats.totalAchievements}
                  </p>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#94A3B8]">
                    Unlocked
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Milestones Table */}
        <Card className="overflow-hidden rounded-[28px] border-[#E5EAF1] bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between border-b border-[#E5EAF1] p-5">
            <CardTitle className="flex items-center gap-2 text-lg font-black text-[#020617]">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#F97316]/10">
                <Trophy className="h-5 w-5 text-[#F97316]" />
              </span>
              Milestone Bonuses
            </CardTitle>
            <Button
              onClick={() => handleOpenDialog()}
              className="min-h-[44px] rounded-2xl bg-[#020617] px-4 font-bold text-white hover:bg-[#020617]/90"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Milestone
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-[#F6F8FB]">
                  <TableRow className="border-[#E5EAF1] hover:bg-[#F6F8FB]">
                    <TableHead className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                      Milestone
                    </TableHead>
                    <TableHead className="text-center text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                      Referrals
                    </TableHead>
                    <TableHead className="text-center text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                      Bonus
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
                  {milestones.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="py-12 text-center font-semibold text-[#94A3B8]"
                      >
                        No milestones configured. Add your first milestone
                        bonus.
                      </TableCell>
                    </TableRow>
                  ) : (
                    milestones.map((milestone) => (
                      <TableRow
                        key={milestone.id}
                        className="border-[#E5EAF1] hover:bg-[#F6F8FB]"
                      >
                        <TableCell>
                          <div>
                            <p className="font-black text-[#020617]">
                              {milestone.name}
                            </p>
                            {milestone.description && (
                              <p className="mt-1 max-w-md text-sm font-medium text-[#64748B]">
                                {milestone.description.replace(/\$/g, "QAR ")}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant="outline"
                            className="gap-1 rounded-full border-[#7C83F6]/25 bg-[#7C83F6]/10 px-3 py-1 font-bold text-[#7C83F6]"
                          >
                            <Users className="h-3 w-3" />
                            {milestone.referral_count}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="font-black text-[#22C7A1]">
                            {formatCurrency(milestone.bonus_amount)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Switch
                              checked={milestone.is_active}
                              onCheckedChange={() => toggleActive(milestone)}
                            />
                            <span className="sr-only">
                              {milestone.is_active ? "Active" : "Inactive"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="min-h-[44px] min-w-[44px] rounded-2xl text-[#94A3B8] hover:bg-[#F6F8FB] hover:text-[#020617]"
                              onClick={() => handleOpenDialog(milestone)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="min-h-[44px] min-w-[44px] rounded-2xl text-[#FB6B7A] hover:bg-[#FB6B7A]/10 hover:text-[#FB6B7A]"
                              onClick={() => {
                                setSelectedMilestone(milestone);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="mx-4 max-h-[90vh] max-w-[95vw] overflow-y-auto rounded-[28px] border-[#E5EAF1] bg-white text-[#020617] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-[#020617]">
              {selectedMilestone ? "Edit Milestone" : "Add New Milestone"}
            </DialogTitle>
            <DialogDescription className="font-medium text-[#94A3B8]">
              Configure an affiliate milestone bonus that affiliates can earn.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="font-bold text-[#020617]">
                Milestone Name
              </Label>
              <Input
                id="name"
                placeholder="e.g., Rising Star"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="min-h-[48px] rounded-2xl border-[#E5EAF1] bg-[#F6F8FB] text-[#020617] placeholder:text-[#94A3B8]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="font-bold text-[#020617]">
                Description (Optional)
              </Label>
              <Textarea
                id="description"
                placeholder="e.g., Earn QAR 25 bonus for reaching 10 referrals"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="min-h-[110px] rounded-2xl border-[#E5EAF1] bg-[#F6F8FB] text-[#020617] placeholder:text-[#94A3B8]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-2">
                <Label
                  htmlFor="referral_count"
                  className="font-bold text-[#020617]"
                >
                  Referrals Required
                </Label>
                <Input
                  id="referral_count"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={formData.referral_count}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      referral_count: parseInt(e.target.value) || 0,
                    })
                  }
                  className="min-h-[48px] rounded-2xl border-[#E5EAF1] bg-[#F6F8FB] text-[#020617]"
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="bonus_amount"
                  className="font-bold text-[#020617]"
                >
                  Bonus Amount (QAR)
                </Label>
                <Input
                  id="bonus_amount"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={0.01}
                  value={formData.bonus_amount}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      bonus_amount: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="min-h-[48px] rounded-2xl border-[#E5EAF1] bg-[#F6F8FB] text-[#020617]"
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-[22px] border border-[#E5EAF1] bg-[#F6F8FB] p-4">
              <div className="space-y-0.5">
                <Label className="font-bold text-[#020617]">Active</Label>
                <p className="text-sm font-medium text-[#94A3B8]">
                  Enable this milestone for affiliates
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

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="min-h-[44px] rounded-2xl border-[#E5EAF1] bg-white px-5 font-bold text-[#020617] hover:bg-[#F6F8FB]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={saving}
              className="min-h-[44px] rounded-2xl bg-[#020617] px-5 font-bold text-white hover:bg-[#020617]/90"
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {selectedMilestone ? "Save Changes" : "Create Milestone"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-[28px] border-[#E5EAF1] bg-white text-[#020617]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black text-[#020617]">
              Delete Milestone
            </AlertDialogTitle>
            <AlertDialogDescription className="font-medium text-[#94A3B8]">
              Are you sure you want to delete "{selectedMilestone?.name}"? This
              will also remove all achievement records for this milestone. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-[44px] rounded-2xl border-[#E5EAF1] bg-white px-5 font-bold text-[#020617] hover:bg-[#F6F8FB]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="min-h-[44px] rounded-2xl bg-[#FB6B7A] px-5 font-bold text-white hover:bg-[#FB6B7A]/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
