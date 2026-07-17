import { useState, useEffect } from "react";
import { AdminDialogContent } from "@/components/admin/AdminPrimitives";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Shield,
  Loader2,
  User,
  ShieldAlert,
  Bike,
  Store,
  Dumbbell,
  Users,
} from "lucide-react";

// Roles stored in user_roles table (fleet_manager is handled separately in fleet_managers table)
type DBUserRole =
  | "user"
  | "admin"
  | "gym_owner"
  | "staff"
  | "restaurant"
  | "driver"
  | "partner";
type UserRole = DBUserRole | "fleet_manager";

interface ManageRolesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string | null;
  currentRoles: UserRole[];
  onRolesUpdated: (newRoles: UserRole[]) => void;
}

const availableRoles: {
  value: UserRole;
  label: string;
  description: string;
  icon: React.ElementType;
}[] = [
  {
    value: "user",
    label: "User",
    description:
      "Standard customer account with access to meals, orders, and tracking",
    icon: User,
  },
  {
    value: "admin",
    label: "Admin",
    description:
      "Full platform access including user management, settings, and analytics",
    icon: ShieldAlert,
  },
  {
    value: "staff",
    label: "Staff",
    description: "Internal team member with elevated permissions",
    icon: Shield,
  },
  {
    value: "restaurant",
    label: "Restaurant Partner",
    description:
      "Partner account for restaurant owners to manage menu and orders",
    icon: Store,
  },
  {
    value: "driver",
    label: "Driver",
    description:
      "Delivery driver account for accepting and completing deliveries",
    icon: Bike,
  },
  {
    value: "fleet_manager",
    label: "Fleet Manager",
    description: "Manages a fleet of drivers and oversees delivery operations",
    icon: Users,
  },
  {
    value: "gym_owner",
    label: "Gym Owner",
    description: "Gym/fitness center owner with special pricing and features",
    icon: Dumbbell,
  },
];

export function ManageRolesDialog({
  isOpen,
  onClose,
  userId,
  userName,
  currentRoles,
  onRolesUpdated,
}: ManageRolesDialogProps) {
  const { toast } = useToast();
  const [selectedRoles, setSelectedRoles] = useState<UserRole[]>(currentRoles);
  const [loading, setLoading] = useState(false);
  const [fetchingRoles, setFetchingRoles] = useState(false);

  // Fetch fresh roles when dialog opens
  useEffect(() => {
    if (isOpen && userId) {
      fetchCurrentRoles();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, userId]);

  const fetchCurrentRoles = async () => {
    setFetchingRoles(true);
    try {
      const { data: roles, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (error) throw error;

      const userRoles = roles?.map((r) => r.role as UserRole) || ["user"];

      // Also check fleet_managers table
      const { data: fleetManager } = await supabase
        .from("fleet_managers")
        .select("auth_user_id")
        .eq("auth_user_id", userId)
        .single();

      if (fleetManager && !userRoles.includes("fleet_manager")) {
        userRoles.push("fleet_manager");
      }

      setSelectedRoles(userRoles.length > 0 ? userRoles : ["user"]);
    } catch (error) {
      console.error("Error fetching roles:", error);
      // Fallback to passed roles
      setSelectedRoles(currentRoles);
    } finally {
      setFetchingRoles(false);
    }
  };

  const handleRoleToggle = (role: UserRole) => {
    setSelectedRoles((prev) => {
      if (prev.includes(role)) {
        // Don't allow removing the last role (must have at least "user")
        if (prev.length === 1) {
          return prev;
        }
        return prev.filter((r) => r !== role);
      } else {
        return [...prev, role];
      }
    });
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // Get current roles from database
      const { data: existingRoles, error: fetchError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (fetchError) throw fetchError;

      const currentDbRoles: DBUserRole[] =
        existingRoles?.map((r) => r.role as DBUserRole) || [];

      // Roles to add (exclude fleet_manager as it's in separate table, and user is default)
      const dbRolesToAdd = selectedRoles.filter(
        (r): r is DBUserRole =>
          r !== "fleet_manager" &&
          r !== "user" &&
          !currentDbRoles.includes(r as DBUserRole),
      );

      // Roles to remove
      const dbRolesToRemove: DBUserRole[] = currentDbRoles.filter(
        (r) => !selectedRoles.includes(r as UserRole),
      );

      // Add new roles
      if (dbRolesToAdd.length > 0) {
        const { error: addError } = await supabase.from("user_roles").insert(
          dbRolesToAdd.map((role) => ({
            user_id: userId,
            role: role,
          })),
        );
        if (addError) throw addError;
      }

      // Remove old roles
      if (dbRolesToRemove.length > 0) {
        const { error: removeError } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .in("role", dbRolesToRemove);
        if (removeError) throw removeError;
      }

      // Handle fleet_manager specially
      const isFleetManager = selectedRoles.includes("fleet_manager");
      const { data: existingFleetManager } = await supabase
        .from("fleet_managers")
        .select("auth_user_id")
        .eq("auth_user_id", userId)
        .single();

      if (isFleetManager && !existingFleetManager) {
        // Need to create fleet manager record - this requires additional info
        toast({
          title: "Fleet Manager Role",
          description:
            "To fully assign fleet manager role, please use the 'Create Fleet Manager' button",
          variant: "default",
        });
      } else if (!isFleetManager && existingFleetManager) {
        // Remove from fleet_managers
        await supabase
          .from("fleet_managers")
          .delete()
          .eq("auth_user_id", userId);
      }

      toast({
        title: "Roles Updated",
        description: `Successfully updated roles for ${userName || "user"}`,
      });

      onRolesUpdated(selectedRoles);
      onClose();
    } catch (error) {
      console.error("Error updating roles:", error);
      toast({
        title: "Error",
        description: "Failed to update roles. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case "admin":
        return "border-[#FB6B7A]/25 bg-[#FB6B7A]/10 text-[#FB6B7A]";
      case "fleet_manager":
        return "border-[#7C83F6]/25 bg-[#7C83F6]/10 text-[#7C83F6]";
      case "restaurant":
        return "border-[#F97316]/25 bg-[#F97316]/10 text-[#F97316]";
      case "driver":
        return "border-[#38BDF8]/25 bg-[#38BDF8]/10 text-[#38BDF8]";
      case "gym_owner":
        return "border-[#7C83F6]/25 bg-[#7C83F6]/10 text-[#7C83F6]";
      case "staff":
        return "border-[#F97316]/25 bg-[#F97316]/10 text-[#F97316]";
      default:
        return "border-[#E5EAF1] bg-[#F6F8FB] text-[#94A3B8]";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <AdminDialogContent size="md">
        <DialogHeader className="border-b border-[#E5EAF1] bg-[#F6F8FB] px-5 py-4 text-left">
          <DialogTitle className="flex items-center gap-2 text-xl font-black text-[#020617]">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#020617] text-white">
              <Shield className="h-5 w-5" />
            </span>
            Manage Roles
          </DialogTitle>
          <DialogDescription className="font-semibold text-[#94A3B8]">
            Update roles for {userName || "Unnamed User"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 bg-[#F6F8FB] px-5 py-4">
          {fetchingRoles ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-[#22C7A1]" />
            </div>
          ) : (
            <div className="space-y-3">
              {availableRoles.map((role) => {
                const Icon = role.icon;
                const isSelected = selectedRoles.includes(role.value);
                const isUserRole = role.value === "user";
                const roleInputId = `admin-role-${role.value}`;

                return (
                  <div
                    key={role.value}
                    className={`flex items-start gap-3 rounded-[20px] border p-3 transition-all ${
                      isSelected
                        ? "border-[#22C7A1]/45 bg-[#22C7A1]/10"
                        : "border-[#E5EAF1] bg-white hover:border-[#22C7A1]/35"
                    } ${isUserRole && selectedRoles.length === 1 ? "opacity-50" : ""}`}
                  >
                    <Checkbox
                      id={roleInputId}
                      checked={isSelected}
                      onCheckedChange={() => handleRoleToggle(role.value)}
                      disabled={isUserRole && selectedRoles.length === 1}
                      className="mt-1 border-[#E5EAF1] data-[state=checked]:border-[#22C7A1] data-[state=checked]:bg-[#22C7A1]"
                    />
                    <Label
                      htmlFor={roleInputId}
                      className="flex-1 cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-[#94A3B8]" />
                        <span className="font-black text-[#020617]">
                          {role.label}
                        </span>
                        {isSelected && (
                          <Badge
                            variant="outline"
                            className={`text-xs ${getRoleBadgeColor(role.value)}`}
                          >
                            Active
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-sm font-semibold text-[#94A3B8]">
                        {role.description}
                      </p>
                    </Label>
                  </div>
                );
              })}
            </div>
          )}

          <div className="rounded-[18px] border border-[#E5EAF1] bg-white p-3 text-sm font-semibold text-[#94A3B8]">
            <p>
              <strong>Note:</strong> Users must have at least one role. The
              "User" role provides basic customer access and cannot be removed
              unless other roles are assigned.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-3 border-t border-[#E5EAF1] bg-[#F6F8FB] px-5 py-4">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="h-11 rounded-2xl border-[#E5EAF1] bg-white font-black text-[#020617]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading || fetchingRoles}
            className="h-11 rounded-2xl bg-[#020617] font-black text-white hover:bg-[#020617]/90"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </DialogFooter>
      </AdminDialogContent>
    </Dialog>
  );
}
