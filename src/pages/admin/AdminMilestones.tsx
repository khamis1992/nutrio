import { useState, useEffect } from "react";
import { 
  Trophy, 
  Plus, 
  Pencil, 
  Trash2, 
  Check, 
  X, 
  Loader2,
  DollarSign,
  Users,
  Gift
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
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null);
  const [formData, setFormData] = useState(defaultFormData);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchMilestones();
  }, []);

  const fetchMilestones = async () => {
    try {
      const { data: milestonesData, error: milestonesError } = await supabase
        .from("referral_milestones")
        .select("*")
        .order("referral_count", { ascending: true });

      if (milestonesError) throw milestonesError;

      setMilestones(milestonesData || []);

      // Calculate stats
      const active = (milestonesData || []).filter((m) => m.is_active);
      const totalBonus = (milestonesData || []).reduce((sum, m) => sum + Number(m.bonus_amount), 0);

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
  };

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
        const { error } = await supabase
          .from("referral_milestones")
          .insert({
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
    } catch (error: any) {
      console.error("Error saving milestone:", error);
      toast({ title: "Error saving milestone", description: error.message, variant: "destructive" });
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
    } catch (error: any) {
      console.error("Error deleting milestone:", error);
      toast({ title: "Error deleting milestone", description: error.message, variant: "destructive" });
    }
  };

  const toggleActive = async (milestone: Milestone) => {
    try {
      const { error } = await supabase
        .from("referral_milestones")
        .update({ is_active: !milestone.is_active, updated_at: new Date().toISOString() })
        .eq("id", milestone.id);

      if (error) throw error;

      toast({ title: `Milestone ${milestone.is_active ? "disabled" : "enabled"}` });
      fetchMilestones();
    } catch (error: any) {
      toast({ title: "Error updating milestone", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <AdminLayout title="Referral Milestones" subtitle="Manage milestone bonuses">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Referral Milestones" subtitle="Manage milestone bonuses">
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Trophy className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalMilestones}</p>
                  <p className="text-xs text-muted-foreground">Total Milestones</p>
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
                  <p className="text-2xl font-bold">{stats.activeMilestones}</p>
                  <p className="text-xs text-muted-foreground">Active</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatCurrency(stats.totalBonusValue)}</p>
                  <p className="text-xs text-muted-foreground">Total Bonus Value</p>
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
                  <p className="text-2xl font-bold">{stats.totalAchievements}</p>
                  <p className="text-xs text-muted-foreground">Achievements Unlocked</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Milestones Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Milestone Bonuses
            </CardTitle>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Milestone
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Milestone</TableHead>
                  <TableHead className="text-center">Referrals Required</TableHead>
                  <TableHead className="text-center">Bonus Amount</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {milestones.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No milestones configured. Add your first milestone bonus!
                    </TableCell>
                  </TableRow>
                ) : (
                  milestones.map((milestone) => (
                    <TableRow key={milestone.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{milestone.name}</p>
                          {milestone.description && (
                            <p className="text-sm text-muted-foreground">
                              {milestone.description.replace(/\$/g, "QAR ")}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="gap-1">
                          <Users className="h-3 w-3" />
                          {milestone.referral_count}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-bold text-green-600">
                          {formatCurrency(milestone.bonus_amount)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={milestone.is_active}
                          onCheckedChange={() => toggleActive(milestone)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="min-h-[44px] min-w-[44px]"
                            onClick={() => handleOpenDialog(milestone)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="min-h-[44px] min-w-[44px] text-destructive hover:text-destructive"
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
        <DialogContent className="max-w-[95vw] sm:max-w-md mx-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedMilestone ? "Edit Milestone" : "Add New Milestone"}
            </DialogTitle>
            <DialogDescription>
              Configure a referral milestone bonus that affiliates can earn.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Milestone Name</Label>
              <Input
                id="name"
                placeholder="e.g., Rising Star"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="h-12 sm:h-10 min-h-[44px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="e.g., Earn QAR 25 bonus for reaching 10 referrals"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="min-h-[100px] sm:min-h-[120px]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="referral_count">Referrals Required</Label>
                <Input
                  id="referral_count"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={formData.referral_count}
                  onChange={(e) => setFormData({ ...formData, referral_count: parseInt(e.target.value) || 0 })}
                  className="h-12 sm:h-10 min-h-[44px]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bonus_amount">Bonus Amount (QAR)</Label>
                <Input
                  id="bonus_amount"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={0.01}
                  value={formData.bonus_amount}
                  onChange={(e) => setFormData({ ...formData, bonus_amount: parseFloat(e.target.value) || 0 })}
                  className="h-12 sm:h-10 min-h-[44px]"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Active</Label>
                <p className="text-sm text-muted-foreground">
                  Enable this milestone for affiliates
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
              {selectedMilestone ? "Save Changes" : "Create Milestone"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Milestone</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedMilestone?.name}"? This will also remove all achievement records for this milestone. This action cannot be undone.
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
