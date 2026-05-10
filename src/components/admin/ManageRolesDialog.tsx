import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Shield, Loader2, User, ShieldAlert, Bike, Store, Dumbbell, Users } from "lucide-react";

// Roles stored in user_roles table (fleet_manager is handled separately in fleet_managers table)
type DBUserRole = "user" | "admin" | "gym_owner" | "staff" | "restaurant" | "driver" | "partner";
type UserRole = DBUserRole | "fleet_manager";

interface ManageRolesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string | null;
  currentRoles: UserRole[];
  onRolesUpdated: (newRoles: UserRole[]) => void;
}

const availableRoles: { value: UserRole; label: string; description: string; icon: React.ElementType }[] = [
  { 
    value: "user", 
    label: "User", 
    description: "Standard customer account with access to meals, orders, and tracking",
    icon: User 
  },
  { 
    value: "admin", 
    label: "Admin", 
    description: "Full platform access including user management, settings, and analytics",
    icon: ShieldAlert 
  },
  { 
    value: "staff", 
    label: "Staff", 
    description: "Internal team member with elevated permissions",
    icon: Shield 
  },
  { 
    value: "restaurant", 
    label: "Restaurant Partner", 
    description: "Partner account for restaurant owners to manage menu and orders",
    icon: Store 
  },
  { 
    value: "driver", 
    label: "Driver", 
    description: "Delivery driver account for accepting and completing deliveries",
    icon: Bike 
  },
  { 
    value: "fleet_manager", 
    label: "Fleet Manager", 
    description: "Manages a fleet of drivers and oversees delivery operations",
    icon: Users 
  },
  { 
    value: "gym_owner", 
    label: "Gym Owner", 
    description: "Gym/fitness center owner with special pricing and features",
    icon: Dumbbell 
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

      const currentDbRoles: DBUserRole[] = existingRoles?.map((r) => r.role as DBUserRole) || [];

      // Roles to add (exclude fleet_manager as it's in separate table, and user is default)
      const dbRolesToAdd = selectedRoles.filter(
        (r): r is DBUserRole => 
          r !== "fleet_manager" && 
          r !== "user" && 
          !currentDbRoles.includes(r as DBUserRole)
      );
      
      // Roles to remove
      const dbRolesToRemove: DBUserRole[] = currentDbRoles.filter(
        (r) => !selectedRoles.includes(r as UserRole)
      );

      // Add new roles
      if (dbRolesToAdd.length > 0) {
        const { error: addError } = await supabase.from("user_roles").insert(
          dbRolesToAdd.map((role) => ({
            user_id: userId,
            role: role,
          }))
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
          description: "To fully assign fleet manager role, please use the 'Create Fleet Manager' button",
          variant: "default",
        });
      } else if (!isFleetManager && existingFleetManager) {
        // Remove from fleet_managers
        await supabase.from("fleet_managers").delete().eq("auth_user_id", userId);
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
      case "admin": return "bg-red-500/10 text-red-600 border-red-500/20";
      case "fleet_manager": return "bg-indigo-500/10 text-indigo-600 border-indigo-500/20";
      case "restaurant": return "bg-orange-500/10 text-orange-600 border-orange-500/20";
      case "driver": return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "gym_owner": return "bg-purple-500/10 text-purple-600 border-purple-500/20";
      case "staff": return "bg-amber-500/10 text-amber-600 border-amber-500/20";
      default: return "bg-slate-500/10 text-slate-600 border-slate-500/20";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Manage Roles
          </DialogTitle>
          <DialogDescription>
            Update roles for {userName || "Unnamed User"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {fetchingRoles ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-3">
              {availableRoles.map((role) => {
                const Icon = role.icon;
                const isSelected = selectedRoles.includes(role.value);
                const isUserRole = role.value === "user";

                return (
                  <div
                    key={role.value}
                    className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    } ${isUserRole && selectedRoles.length === 1 ? "opacity-50" : ""}`}
                    onClick={() => !isUserRole && handleRoleToggle(role.value)}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => handleRoleToggle(role.value)}
                      disabled={isUserRole && selectedRoles.length === 1}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">{role.label}</span>
                        {isSelected && (
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${getRoleBadgeColor(role.value)}`}
                          >
                            Active
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {role.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
            <p>
              <strong>Note:</strong> Users must have at least one role. The "User" role 
              provides basic customer access and cannot be removed unless other roles are assigned.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading || fetchingRoles}>
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
      </DialogContent>
    </Dialog>
  );
}
