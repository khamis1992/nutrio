import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, User, Mail, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

type Gender = "male" | "female" | "prefer_not_to_say";

const GenderCard = ({
  gender,
  selected,
  onClick,
  t,
}: {
  gender: Gender;
  selected: boolean;
  onClick: () => void;
  t: (key: string) => string;
}) => {
  const isMale = gender === "male";
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all duration-200",
        selected ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/40"
      )}
    >
      <span className="text-2xl">{isMale ? "👨" : "👩"}</span>
      <span className="text-sm font-medium capitalize">
        {gender === "prefer_not_to_say" ? t("prefer_not_to_say") : t(gender)}
      </span>
    </button>
  );
};

const PersonalInfo = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { profile, loading, updateProfile } = useProfile();

  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState<Gender | null>(null);
  const [age, setAge] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setGender(profile.gender);
      setAge(profile.age?.toString() || "");
    }
  }, [profile]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await updateProfile({
        full_name: fullName,
        gender,
        age: age ? parseInt(age) : null,
      });
      if (error) throw error;
      toast({
        title: "Profile updated",
        description: "Your personal information has been saved.",
      });
    } catch {
      toast({
        title: "Error saving profile",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/50">
        <div className="flex items-center gap-3 px-4 py-4 rtl:flex-row-reverse">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">Personal Information</h1>
            <p className="text-xs text-muted-foreground">Update your profile details</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-6 space-y-4 max-w-2xl mx-auto">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Profile Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Full Name */}
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-sm font-medium">Full Name</Label>
              <div className="relative">
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                  className="h-12 rounded-xl pr-12"
                />
                <User className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              </div>
            </div>

            {/* Gender */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">{t("gender")}</Label>
              <div className="grid grid-cols-2 gap-3">
                {(["male", "female"] as Gender[]).map((g) => (
                  <GenderCard key={g} gender={g} selected={gender === g} onClick={() => setGender(g)} t={t} />
                ))}
              </div>
            </div>

            {/* Age */}
            <div className="space-y-2">
              <Label htmlFor="age" className="text-sm font-medium">Age</Label>
              <div className="relative">
                <Input
                  id="age"
                  type="number"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="25"
                  min={13}
                  max={120}
                  className="h-12 rounded-xl"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">years</span>
              </div>
            </div>

            {/* Email (read-only) */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Email Address</Label>
              <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-xl">
                <Mail className="w-5 h-5 text-muted-foreground shrink-0" />
                <p className="font-medium text-sm">{user?.email}</p>
              </div>
            </div>

            {/* Save Button */}
            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full h-12 rounded-xl"
            >
              {saving ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving...</>
              ) : (
                <><Check className="w-4 h-4 mr-2" />Save Changes</>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PersonalInfo;
