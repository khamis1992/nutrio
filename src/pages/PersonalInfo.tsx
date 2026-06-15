import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  User,
  Mail,
  Loader2,
  Check,
  Calendar,
  Pencil,
} from "lucide-react";
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
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 p-6 transition-colors",
        selected
          ? "border-emerald-500 bg-emerald-50"
          : "border-border bg-card hover:border-emerald-300/70"
      )}
      aria-pressed={selected}
      aria-label={isMale ? t("male") : t("female")}
    >
      {selected && (
        <span className="absolute right-3 top-3 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
          <Check className="h-3.5 w-3.5" />
        </span>
      )}
      <span className="text-3xl leading-none">{isMale ? "👨" : "👩"}</span>
      <span className="text-sm font-semibold capitalize text-foreground">
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
      <div className="flex min-h-screen items-center justify-center bg-muted/40">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/40 pb-20 pt-safe">
      <div className="sticky top-0 z-10 border-b border-border/50 bg-muted/60 backdrop-blur-md">
        <div className="flex items-center gap-3 px-4 py-4 rtl:flex-row-reverse">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="rounded-full"
            aria-label={t("go_back")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-6">
        <Card className="rounded-[24px] border-border/70 shadow-sm">
          <CardHeader className="relative pb-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-2xl font-bold tracking-tight">Profile Details</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">{t("personal_info_manage")}</p>
              </div>
              <div className="relative shrink-0">
                <div className="relative h-20 w-20 rounded-full border border-emerald-200 bg-emerald-50">
                  <div className="absolute inset-0 grid place-items-center">
                    <User className="h-8 w-8 text-emerald-600" />
                  </div>
                  <span className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full border border-emerald-200 bg-emerald-500 text-white shadow-sm">
                    <Pencil className="h-4 w-4" />
                  </span>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-5 pt-0">
            
            <div className="rounded-2xl border bg-card p-4">
              <div className="mb-3 flex items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-emerald-200 bg-emerald-50">
                  <User className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <Label htmlFor="fullName" className="text-sm font-semibold">
                    Full Name
                  </Label>
                  <p className="text-xs text-muted-foreground">{t("personal_info_display")}</p>
                </div>
              </div>
              <div className="relative">
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="KHAMIS AL-JABOR"
                  className="h-12 rounded-xl bg-muted/50 pr-12 text-sm"
                />
                <User className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>

            
            <div className="rounded-2xl border bg-card p-4">
              <div className="mb-3 flex items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-emerald-200 bg-emerald-50">
                  <User className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <Label className="text-sm font-semibold">{t("gender")}</Label>
                  <p className="text-xs text-muted-foreground">{t("personal_info_sex")}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {(["male", "female"] as Gender[]).map((g) => (
                  <GenderCard
                    key={g}
                    gender={g}
                    selected={gender === g}
                    onClick={() => setGender(g)}
                    t={t}
                  />
                ))}
              </div>
            </div>

            
            <div className="rounded-2xl border bg-card p-4">
              <div className="mb-3 flex items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-emerald-200 bg-emerald-50">
                  <Calendar className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <Label htmlFor="age" className="text-sm font-semibold">
                    Age
                  </Label>
                  <p className="text-xs text-muted-foreground">{t("personal_info_age")}</p>
                </div>
              </div>
              <div className="relative">
                <Input
                  id="age"
                  type="number"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="33"
                  min={13}
                  max={120}
                  className="h-12 rounded-xl bg-muted/50 pr-20 text-sm"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-muted px-3 py-1 text-xs text-muted-foreground">
                  years
                </span>
              </div>
            </div>

            
            <div className="rounded-2xl border bg-card p-4">
              <div className="mb-3 flex items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-emerald-200 bg-emerald-50">
                  <Mail className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <Label className="text-sm font-semibold">Email Address</Label>
                  <p className="text-xs text-muted-foreground">{t("personal_info_email_privacy")}</p>
                </div>
              </div>
              <div className="relative">
                <Input
                  value={user?.email || ""}
                  readOnly
                  className="h-12 cursor-default rounded-xl bg-muted/50 text-sm"
                />
              </div>
            </div>

            
            <Button
              onClick={handleSave}
              disabled={saving}
              className={cn(
                "w-full rounded-2xl py-6 text-base font-semibold text-white shadow-lg",
                "bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700"
              )}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <span className="mr-2 grid h-5 w-5 place-items-center rounded-full bg-white/15">
                    <Check className="h-4 w-4" />
                  </span>
                  Save Changes
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PersonalInfo;
