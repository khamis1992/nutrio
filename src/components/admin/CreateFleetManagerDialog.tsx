import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Truck, Shield, Building2, Globe, UserPlus } from "lucide-react";

type FleetManagerRole = "fleet_manager" | "super_admin";

const AVAILABLE_COUNTRIES = [
  { code: "QA", name: "Qatar", nameAr: "قطر" },
  { code: "SA", name: "Saudi Arabia", nameAr: "السعودية" },
  { code: "AE", name: "United Arab Emirates", nameAr: "الإمارات" },
  { code: "KW", name: "Kuwait", nameAr: "الكويت" },
  { code: "BH", name: "Bahrain", nameAr: "البحرين" },
  { code: "OM", name: "Oman", nameAr: "عمان" },
];

interface CreateFleetManagerDialogProps {
  onSuccess?: () => void;
}

export function CreateFleetManagerDialog({ onSuccess }: CreateFleetManagerDialogProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [country, setCountry] = useState<string>("QA");
  
  // Form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<FleetManagerRole>("fleet_manager");

  // Handle dialog open
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      // Reset country to default when opening
      setCountry("QA");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!email || !password || !fullName) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (role === "fleet_manager" && !country) {
      toast({
        title: "Validation Error",
        description: "Please select a country for the fleet manager",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 8) {
      toast({
        title: "Validation Error",
        description: "Password must be at least 8 characters",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Step 1: Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          role: role === "super_admin" ? "admin" : "fleet_manager",
        },
      });

      if (authError) {
        if (authError.message.includes("already registered")) {
          throw new Error("A user with this email already exists");
        }
        throw authError;
      }

      if (!authData.user) {
        throw new Error("Failed to create user");
      }

      const authUserId = authData.user.id;

      // Step 2: Create fleet manager record
      const { error: fleetError } = await supabase
        .from("fleet_managers")
        .insert({
          auth_user_id: authUserId,
          email,
          full_name: fullName,
          phone: phone || null,
          role,
          country: role === "super_admin" ? null : country,
          is_active: true,
        });

      if (fleetError) {
        // Rollback: delete auth user if fleet manager creation fails
        await supabase.auth.admin.deleteUser(authUserId);
        throw fleetError;
      }

      // Step 3: Add to user_roles table for RBAC
      // Both fleet_manager and super_admin get "admin" role in user_roles
      // The specific fleet role is tracked in the fleet_managers table
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({
          user_id: authUserId,
          role: "admin",
        });

      if (roleError) {
        console.error("Error adding user role:", roleError);
        // Non-critical error, don't rollback
      }

      toast({
        title: "Success",
        description: `${role === "super_admin" ? "Super Admin" : "Fleet Manager"} created successfully`,
      });

      // Reset form
      setEmail("");
      setPassword("");
      setFullName("");
      setPhone("");
      setRole("fleet_manager");
      setCountry("QA");
      setIsOpen(false);
      
      onSuccess?.();
    } catch (error) {
      console.error("Error creating fleet manager:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to create fleet manager";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const generatePassword = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
    let result = "";
    for (let i = 0; i < 12; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(result);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Truck className="h-4 w-4" />
          Add Fleet Manager
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Create Fleet Manager Account
          </DialogTitle>
          <DialogDescription>
            Create a new fleet manager or super admin account with access to the Fleet Management Portal.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Role Selection */}
          <div className="space-y-2">
            <Label>Account Type</Label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setRole("fleet_manager")}
                className={`flex flex-col items-center gap-2 p-4 border rounded-lg transition-all ${
                  role === "fleet_manager"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <Building2 className={`h-8 w-8 ${role === "fleet_manager" ? "text-primary" : "text-muted-foreground"}`} />
                <div className="text-center">
                  <p className="font-medium">Fleet Manager</p>
                  <p className="text-xs text-muted-foreground">City-restricted access</p>
                </div>
              </button>
              
              <button
                type="button"
                onClick={() => setRole("super_admin")}
                className={`flex flex-col items-center gap-2 p-4 border rounded-lg transition-all ${
                  role === "super_admin"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <Shield className={`h-8 w-8 ${role === "super_admin" ? "text-primary" : "text-muted-foreground"}`} />
                <div className="text-center">
                  <p className="font-medium">Super Admin</p>
                  <p className="text-xs text-muted-foreground">Full system access</p>
                </div>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Full Name */}
            <div className="space-y-2">
              <Label htmlFor="fullName">
                Full Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g., Ahmed Al-Dosari"
                required
              />
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+974 5000 1234"
              />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">
              Email Address <span className="text-red-500">*</span>
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="fleet.manager@nutriofuel.qa"
              required
            />
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="password">
              Password <span className="text-red-500">*</span>
            </Label>
            <div className="flex gap-2">
              <Input
                id="password"
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 8 characters"
                required
                minLength={8}
              />
              <Button
                type="button"
                variant="outline"
                onClick={generatePassword}
                className="shrink-0"
              >
                Generate
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Password must be at least 8 characters long
            </p>
          </div>

          {/* Country Selection (only for fleet_manager role) */}
          {role === "fleet_manager" && (
            <div className="space-y-2">
              <Label htmlFor="country">
                Assigned Country <span className="text-red-500">*</span>
              </Label>
              <div className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Select the country this manager can access
                  </span>
                </div>
                <select
                  id="country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full p-2 border rounded-md bg-background"
                >
                  {AVAILABLE_COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name} ({c.nameAr})
                    </option>
                  ))}
                </select>
                <div className="mt-3 pt-3 border-t">
                  <p className="text-sm text-muted-foreground mb-2">Selected Country:</p>
                  <Badge variant="secondary">
                    {AVAILABLE_COUNTRIES.find(c => c.code === country)?.name}
                  </Badge>
                </div>
              </div>
            </div>
          )}

          {role === "super_admin" && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-900">Super Admin Access</p>
                  <p className="text-sm text-amber-700">
                    This account will have unrestricted access to all cities, drivers, and fleet management features across the entire system.
                  </p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  Creating...
                </>
              ) : (
            <>
              <UserPlus className="h-4 w-4 mr-2" />
              Create {role === "super_admin" ? "Super Admin" : "Fleet Manager"}
            </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
