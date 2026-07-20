import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, ShieldCheck } from "lucide-react";
import type { FamilyMemberInput } from "@/hooks/useFamilyMembers";

const DIETARY_OPTIONS = [
  "halal", "keto", "vegan", "vegetarian", "gluten-free",
  "dairy-free", "low-carb", "high-protein", "mediterranean",
  "pescatarian", "paleo",
];

const ALLERGY_OPTIONS = ["milk", "eggs", "peanuts", "tree nuts", "wheat", "soy", "fish", "shellfish", "sesame"];

interface AddFamilyMemberSheetProps {
  open: boolean;
  onClose: () => void;
  onAdd: (input: FamilyMemberInput) => Promise<boolean>;
}

export function AddFamilyMemberSheet({ open, onClose, onAdd }: AddFamilyMemberSheetProps) {
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState<FamilyMemberInput["relationship"]>("other");
  const [gender, setGender] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [selectedDietary, setSelectedDietary] = useState<string[]>([]);
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>([]);
  const [authorizationConfirmed, setAuthorizationConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setName("");
      setRelationship("other");
      setGender("");
      setDateOfBirth("");
      setSelectedDietary([]);
      setSelectedAllergies([]);
      setAuthorizationConfirmed(false);
      setErrors({});
    }
  }, [open]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Name is required";
    if (!dateOfBirth) errs.dateOfBirth = "Date of birth is required";
    if (!authorizationConfirmed) errs.authorization = "Authorization is required to create this profile";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    const success = await onAdd({
      name: name.trim(),
      relationship,
      date_of_birth: dateOfBirth,
      gender: gender || undefined,
      dietary_preferences: selectedDietary.length > 0 ? selectedDietary : undefined,
      allergies: selectedAllergies,
      authorization_confirmed: authorizationConfirmed,
    });
    setSubmitting(false);
    if (success) onClose();
  };

  const toggleAllergy = (allergy: string) => {
    setSelectedAllergies((current) => current.includes(allergy)
      ? current.filter((item) => item !== allergy)
      : [...current, allergy]);
  };

  const toggleDietary = (pref: string) => {
    setSelectedDietary((prev) =>
      prev.includes(pref) ? prev.filter((p) => p !== pref) : [...prev, pref]
    );
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="bottom" className="max-h-[85vh] rounded-t-[24px] overflow-y-auto">
        <SheetHeader className="text-left mb-4">
          <SheetTitle>Add Family Member</SheetTitle>
          <SheetDescription>
            Add a family member to share your meal plan.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="fm-name">Name *</Label>
            <Input
              id="fm-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter name"
              className="rounded-xl"
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fm-relationship">Relationship *</Label>
            <Select value={relationship} onValueChange={(value) => setRelationship(value as FamilyMemberInput["relationship"])}>
              <SelectTrigger id="fm-relationship" className="min-h-11 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="spouse">Spouse</SelectItem>
                <SelectItem value="child">Child</SelectItem>
                <SelectItem value="parent">Parent</SelectItem>
                <SelectItem value="sibling">Sibling</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fm-gender">Gender</Label>
            <Select value={gender} onValueChange={setGender}>
              <SelectTrigger id="fm-gender" className="rounded-xl">
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fm-birthdate">Date of birth *</Label>
            <Input
              id="fm-birthdate"
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className="min-h-11 rounded-xl"
              max={new Date().toISOString().slice(0, 10)}
            />
            {errors.dateOfBirth && <p className="text-xs text-destructive">{errors.dateOfBirth}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Allergies</Label>
            <p className="text-xs text-muted-foreground">Meals with a matching structured allergen cannot be assigned to this profile.</p>
            <div className="flex flex-wrap gap-2">
              {ALLERGY_OPTIONS.map((allergy) => (
                <button
                  key={allergy}
                  type="button"
                  onClick={() => toggleAllergy(allergy)}
                  className={`min-h-10 rounded-full border px-3 text-xs font-bold transition-colors ${
                    selectedAllergies.includes(allergy)
                      ? "border-[#FB6B7A] bg-[#FFF1F3] text-[#D64D62]"
                      : "border-border bg-background text-muted-foreground"
                  }`}
                >
                  {allergy}
                </button>
              ))}
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-[#F6F8FB] p-3 ring-1 ring-slate-100">
            <Checkbox
              checked={authorizationConfirmed}
              onCheckedChange={(checked) => setAuthorizationConfirmed(checked === true)}
              className="mt-0.5"
            />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-sm font-bold text-[#020617]"><ShieldCheck className="h-4 w-4 text-[#22C7A1]" />Profile authorization</span>
              <span className="mt-1 block text-xs leading-5 text-[#64748B]">I am authorized to manage this adult's meal profile, or I am the legal guardian if this is a child.</span>
            </span>
          </label>
          {errors.authorization && <p className="text-xs text-destructive">{errors.authorization}</p>}

          <div className="space-y-1.5">
            <Label>Dietary Preferences</Label>
            <div className="flex flex-wrap gap-2">
              {DIETARY_OPTIONS.map((pref) => (
                <button
                  key={pref}
                  type="button"
                  onClick={() => toggleDietary(pref)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                    selectedDietary.includes(pref)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border hover:border-primary/40"
                  }`}
                >
                  {pref}
                </button>
              ))}
            </div>
          </div>
        </div>

        <SheetFooter className="mt-6">
          <Button variant="outline" className="rounded-xl" onClick={onClose}>
            Cancel
          </Button>
          <Button className="rounded-xl" onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" />Adding...</>
            ) : (
              <><Plus className="h-4 w-4 mr-2" />Add Member</>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
