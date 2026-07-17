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
import {
  AdminDialogContent,
  AdminAlertDialogContent,
  AdminEmptyState,
  AdminKpiStrip,
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

  const metricCards = [
    {
      label: "Total",
      value: stats.totalMilestones,
      icon: Trophy,
      accent: "#7C83F6" as const,
    },
    {
      label: "Active",
      value: stats.activeMilestones,
      icon: Check,
      accent: "#22C7A1" as const,
    },
    {
      label: "Bonus Value",
      value: formatCurrency(stats.totalBonusValue),
      icon: DollarSign,
      accent: "#F97316" as const,
    },
    {
      label: "Unlocked",
      value: stats.totalAchievements,
      icon: Gift,
      accent: "#38BDF8" as const,
    },
  ];

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
        <AdminWorkbenchHeader
          eyebrow="Affiliate growth"
          title="Milestone bonus rules"
          icon={Trophy}
          accent="#7C83F6"
          description="Configure referral thresholds, reward values, and active campaigns affiliates can unlock."
          meta={[
            { label: "Active milestones", value: stats.activeMilestones },
            { label: "Achievements", value: stats.totalAchievements },
            {
              label: "Bonus value",
              value: formatCurrency(stats.totalBonusValue),
            },
          ]}
          actions={
            <Button
              onClick={() => handleOpenDialog()}
              variant="outline"
              className="min-h-[48px] rounded-2xl border-[#7C83F6]/30 bg-[#7C83F6]/10 px-5 font-bold text-[#020617] hover:bg-[#7C83F6]/15"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Milestone
            </Button>
          }
        />

        {/* Stats Cards */}
        <AdminKpiStrip items={metricCards} />

        {/* Milestones Table */}
        <AdminPanel>
          <AdminPanelHeader
            title="Milestone Bonuses"
            eyebrow="Reward rules"
            actions={
              <Button
                onClick={() => handleOpenDialog()}
                variant="outline"
                className="min-h-[44px] rounded-2xl border-[#22C7A1]/30 bg-[#22C7A1]/10 px-4 font-bold text-[#020617] hover:bg-[#22C7A1]/15"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Milestone
              </Button>
            }
          />
          <div className="p-0">
            <div className="grid gap-3 p-4 md:hidden">
              {milestones.length === 0 ? (
                <AdminEmptyState
                  icon={Trophy}
                  title="No milestones configured"
                  description="Add your first milestone bonus."
                  className="rounded-[22px] border border-dashed border-[#E5EAF1] bg-[#F6F8FB] p-8"
                />
              ) : (
                milestones.map((milestone) => (
                  <div
                    key={milestone.id}
                    className="rounded-[24px] border border-[#E5EAF1] bg-white p-4 shadow-[0_12px_30px_rgba(2,6,23,0.05)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-black text-[#020617]">
                          {milestone.name}
                        </p>
                        {milestone.description && (
                          <p className="mt-1 line-clamp-2 text-sm font-medium text-[#94A3B8]">
                            {milestone.description.replace(/\$/g, "QAR ")}
                          </p>
                        )}
                      </div>
                      <Switch
                        checked={milestone.is_active}
                        onCheckedChange={() => toggleActive(milestone)}
                      />
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div className="rounded-2xl border border-[#E5EAF1] bg-[#7C83F6]/10 p-3">
                        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#7C83F6]">
                          Referrals
                        </p>
                        <p className="mt-1 text-lg font-black text-[#020617]">
                          {milestone.referral_count}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-[#E5EAF1] bg-[#22C7A1]/10 p-3">
                        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#22C7A1]">
                          Bonus
                        </p>
                        <p className="mt-1 text-lg font-black text-[#020617]">
                          {formatCurrency(milestone.bonus_amount)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between rounded-2xl bg-[#F6F8FB] px-3 py-2">
                      <Badge
                        variant="outline"
                        className={
                          milestone.is_active
                            ? "border-[#22C7A1]/20 bg-[#22C7A1]/10 font-black text-[#22C7A1]"
                            : "border-[#E5EAF1] bg-white font-black text-[#94A3B8]"
                        }
                      >
                        {milestone.is_active ? "Active" : "Inactive"}
                      </Badge>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="min-h-[44px] min-w-[44px] rounded-2xl text-[#020617] hover:bg-white"
                          onClick={() => handleOpenDialog(milestone)}
                          aria-label={`Edit milestone ${milestone.name}`}
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
                          aria-label={`Delete milestone ${milestone.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="hidden overflow-x-auto md:block">
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
                      <TableCell colSpan={5} className="p-0">
                        <AdminEmptyState
                          icon={Trophy}
                          title="No milestones configured"
                          description="Add your first milestone bonus."
                        />
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
                              <p className="mt-1 max-w-md text-sm font-medium text-[#94A3B8]">
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
                              aria-label={`Edit milestone ${milestone.name}`}
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
                              aria-label={`Delete milestone ${milestone.name}`}
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
          </div>
        </AdminPanel>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AdminDialogContent size="md">
          <DialogHeader className="border-b border-[#E5EAF1] bg-[#F6F8FB] px-5 py-4 text-left">
            <DialogTitle className="text-xl font-black text-[#020617]">
              {selectedMilestone ? "Edit Milestone" : "Add New Milestone"}
            </DialogTitle>
            <DialogDescription className="font-medium text-[#94A3B8]">
              Configure an affiliate milestone bonus that affiliates can earn.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 bg-[#F6F8FB] px-5 py-4">
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

          <DialogFooter className="gap-2 sm:gap-3 border-t border-[#E5EAF1] bg-[#F6F8FB] px-5 py-4">
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
              variant="outline"
              className="min-h-[44px] rounded-2xl border-[#22C7A1]/30 bg-[#22C7A1]/10 px-5 font-bold text-[#020617] hover:bg-[#22C7A1]/15"
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {selectedMilestone ? "Save Changes" : "Create Milestone"}
            </Button>
          </DialogFooter>
        </AdminDialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AdminAlertDialogContent>
          <AlertDialogHeader className="border-b border-[#E5EAF1] bg-[#F6F8FB] px-5 py-4 text-left">
            <AlertDialogTitle className="text-xl font-black text-[#020617]">
              Delete Milestone
            </AlertDialogTitle>
            <AlertDialogDescription className="font-medium text-[#94A3B8]">
              Are you sure you want to delete "{selectedMilestone?.name}"? This
              will also remove all achievement records for this milestone. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-3 border-t border-[#E5EAF1] bg-[#F6F8FB] px-5 py-4">
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
        </AdminAlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
