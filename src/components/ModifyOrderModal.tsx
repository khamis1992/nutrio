import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface ScheduledMeal {
  id: string;
  scheduled_date: string;
  meal_type: string;
  is_completed: boolean;
  order_status: string;
  created_at: string;
  meal_id: string;
  meal?: {
    name?: string;
    restaurant?: {
      name?: string;
    };
  };
}

interface ModifyOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedule: ScheduledMeal | null;
  onModified: () => void;
}

const MEAL_TYPES = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "snack", label: "Snack" },
];

// Generate next 14 days as selectable dates
const getAvailableDates = () => {
  const dates: { value: string; label: string }[] = [];
  const today = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const value = d.toISOString().split("T")[0];
    const label = d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    dates.push({ value, label });
  }
  return dates;
};

export const ModifyOrderModal = ({
  isOpen,
  onClose,
  schedule,
  onModified,
}: ModifyOrderModalProps) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [newDate, setNewDate] = useState<string>("");
  const [newMealType, setNewMealType] = useState<string>("");

  const availableDates = getAvailableDates();

  const handleSave = async () => {
    if (!schedule) return;
    setSaving(true);
    try {
      const updates: Record<string, string> = {};
      if (newDate) updates.scheduled_date = newDate;
      if (newMealType) updates.meal_type = newMealType;

      if (Object.keys(updates).length === 0) {
        toast({ title: "No changes", description: "Please select a new date or meal type." });
        setSaving(false);
        return;
      }

      const { error } = await supabase
        .from("meal_schedules")
        .update(updates)
        .eq("id", schedule.id);

      if (error) throw error;

      toast({ title: "Order modified", description: "Your order has been updated successfully." });
      onModified();
      onClose();
      setNewDate("");
      setNewMealType("");
    } catch (err) {
      console.error("Modify order error:", err);
      toast({
        title: "Failed to modify order",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setNewDate("");
    setNewMealType("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Modify Order</DialogTitle>
          <DialogDescription>
            {schedule?.meal?.name
              ? `Change the date or meal type for "${schedule.meal.name}"`
              : "Change the date or meal type for this order"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Current details */}
          <div className="p-3 bg-muted/50 rounded-xl text-sm space-y-1">
            <p className="text-muted-foreground">
              Current date:{" "}
              <span className="font-medium text-foreground">{schedule?.scheduled_date}</span>
            </p>
            <p className="text-muted-foreground">
              Current meal type:{" "}
              <span className="font-medium text-foreground capitalize">{schedule?.meal_type}</span>
            </p>
          </div>

          {/* New date */}
          <div className="space-y-2">
            <Label>New Date (optional)</Label>
            <Select value={newDate} onValueChange={setNewDate}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Keep current date" />
              </SelectTrigger>
              <SelectContent>
                {availableDates.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* New meal type */}
          <div className="space-y-2">
            <Label>New Meal Type (optional)</Label>
            <Select value={newMealType} onValueChange={setNewMealType}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Keep current meal type" />
              </SelectTrigger>
              <SelectContent>
                {MEAL_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={handleClose} className="flex-1 rounded-xl">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="flex-1 rounded-xl">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
