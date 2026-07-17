import { useState } from "react";
import { AdminDialogContent } from "@/components/admin/AdminPrimitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Truck,
  Shield,
  Building2,
  Globe,
  UserPlus,
  Loader2,
} from "lucide-react";

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

export function CreateFleetManagerDialog({
  onSuccess,
}: CreateFleetManagerDialogProps) {
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
      const { data: authData, error: authError } =
        await supabase.auth.admin.createUser({
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
      const { error: roleError } = await supabase.from("user_roles").insert({
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
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to create fleet manager";
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
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
    let result = "";
    for (let i = 0; i < 12; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(result);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="h-11 gap-2 rounded-2xl border-[#E5EAF1] bg-white font-black text-[#020617]"
        >
          <Truck className="h-4 w-4" />
          Add Fleet Manager
        </Button>
      </DialogTrigger>
      <AdminDialogContent size="lg">
        <DialogHeader className="border-b border-[#E5EAF1] bg-[#F6F8FB] px-5 py-4 text-left">
          <DialogTitle className="flex items-center gap-2 text-xl font-black text-[#020617]">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#020617] text-white">
              <UserPlus className="h-5 w-5" />
            </span>
            Create Fleet Manager Account
          </DialogTitle>
          <DialogDescription className="font-semibold text-[#94A3B8]">
            Create a new fleet manager or super admin account with access to the
            Fleet Management Portal.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6 bg-[#F6F8FB] px-5 py-4">
            {/* Role Selection */}
            <div className="space-y-2">
              <Label className="font-black text-[#020617]">Account Type</Label>
              <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
                <button
                  type="button"
                  onClick={() => setRole("fleet_manager")}
                  className={`flex flex-col items-center gap-2 rounded-[22px] border p-4 transition-all ${
                    role === "fleet_manager"
                      ? "border-[#22C7A1]/45 bg-[#22C7A1]/10"
                      : "border-[#E5EAF1] bg-white hover:border-[#22C7A1]/35"
                  }`}
                >
                  <Building2
                    className={`h-8 w-8 ${role === "fleet_manager" ? "text-[#22C7A1]" : "text-[#94A3B8]"}`}
                  />
                  <div className="text-center">
                    <p className="font-black text-[#020617]">Fleet Manager</p>
                    <p className="text-xs font-semibold text-[#94A3B8]">
                      City-restricted access
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setRole("super_admin")}
                  className={`flex flex-col items-center gap-2 rounded-[22px] border p-4 transition-all ${
                    role === "super_admin"
                      ? "border-[#7C83F6]/45 bg-[#7C83F6]/10"
                      : "border-[#E5EAF1] bg-white hover:border-[#7C83F6]/35"
                  }`}
                >
                  <Shield
                    className={`h-8 w-8 ${role === "super_admin" ? "text-[#7C83F6]" : "text-[#94A3B8]"}`}
                  />
                  <div className="text-center">
                    <p className="font-black text-[#020617]">Super Admin</p>
                    <p className="text-xs font-semibold text-[#94A3B8]">
                      Full system access
                    </p>
                  </div>
                </button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Full Name */}
              <div className="space-y-2">
                <Label htmlFor="fullName" className="font-black text-[#020617]">
                  Full Name <span className="text-[#FB6B7A]">*</span>
                </Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g., Ahmed Al-Dosari"
                  required
                  className="h-11 rounded-2xl border-[#E5EAF1] bg-white font-bold text-[#020617]"
                />
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <Label htmlFor="phone" className="font-black text-[#020617]">
                  Phone Number
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+974 5000 1234"
                  className="h-11 rounded-2xl border-[#E5EAF1] bg-white font-bold text-[#020617]"
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="font-black text-[#020617]">
                Email Address <span className="text-[#FB6B7A]">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="fleet.manager@nutriofuel.qa"
                required
                className="h-11 rounded-2xl border-[#E5EAF1] bg-white font-bold text-[#020617]"
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password" className="font-black text-[#020617]">
                Password <span className="text-[#FB6B7A]">*</span>
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
                  className="h-11 rounded-2xl border-[#E5EAF1] bg-white font-bold text-[#020617]"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={generatePassword}
                  className="h-11 shrink-0 rounded-2xl border-[#E5EAF1] bg-white font-black text-[#020617]"
                >
                  Generate
                </Button>
              </div>
              <p className="text-xs font-semibold text-[#94A3B8]">
                Password must be at least 8 characters long
              </p>
            </div>

            {/* Country Selection (only for fleet_manager role) */}
            {role === "fleet_manager" && (
              <div className="space-y-2">
                <Label htmlFor="country" className="font-black text-[#020617]">
                  Assigned Country <span className="text-[#FB6B7A]">*</span>
                </Label>
                <div className="rounded-[22px] border border-[#E5EAF1] bg-white p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Globe className="h-4 w-4 text-[#38BDF8]" />
                    <span className="text-sm font-semibold text-[#94A3B8]">
                      Select the country this manager can access
                    </span>
                  </div>
                  <select
                    id="country"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="min-h-[44px] w-full rounded-2xl border border-[#E5EAF1] bg-white p-2 font-bold text-[#020617]"
                  >
                    {AVAILABLE_COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <div className="mt-3 border-t border-[#E5EAF1] pt-3">
                    <p className="mb-2 text-sm font-semibold text-[#94A3B8]">
                      Selected Country:
                    </p>
                    <Badge
                      variant="secondary"
                      className="bg-[#38BDF8]/10 text-[#38BDF8]"
                    >
                      {
                        AVAILABLE_COUNTRIES.find((c) => c.code === country)
                          ?.name
                      }
                    </Badge>
                  </div>
                </div>
              </div>
            )}

            {role === "super_admin" && (
              <div className="rounded-[22px] border border-[#F97316]/20 bg-[#F97316]/10 p-4">
                <div className="flex items-start gap-3">
                  <Shield className="mt-0.5 h-5 w-5 text-[#F97316]" />
                  <div>
                    <p className="font-black text-[#020617]">
                      Super Admin Access
                    </p>
                    <p className="text-sm font-semibold text-[#F97316]">
                      This account will have unrestricted access to all cities,
                      drivers, and fleet management features across the entire
                      system.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-3 border-t border-[#E5EAF1] bg-[#F6F8FB] px-5 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isLoading}
              className="h-11 rounded-2xl border-[#E5EAF1] bg-white font-black text-[#020617]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="h-11 rounded-2xl bg-[#020617] font-black text-white hover:bg-[#020617]/90"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Create{" "}
                  {role === "super_admin" ? "Super Admin" : "Fleet Manager"}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </AdminDialogContent>
    </Dialog>
  );
}
