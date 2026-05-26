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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus } from "lucide-react";
import type { FamilyMemberInput } from "@/hooks/useFamilyMembers";

const DIETARY_OPTIONS = [
  "halal", "keto", "vegan", "vegetarian", "gluten-free",
  "dairy-free", "low-carb", "high-protein", "mediterranean",
  "pescatarian", "paleo",
];

interface AddFamilyMemberSheetProps {
  open: boolean;
  onClose: () => void;
  onAdd: (input: FamilyMemberInput) => Promise<boolean>;
}

export function AddFamilyMemberSheet({ open, onClose, onAdd }: AddFamilyMemberSheetProps) {
  const [name, setName] = useState("");
  const [gender, setGender] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [selectedDietary, setSelectedDietary] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setName("");
      setGender("");
      setBirthYear("");
      setSelectedDietary([]);
      setErrors({});
    }
  }, [open]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Name is required";
    if (birthYear) {
      const y = parseInt(birthYear, 10);
      const currentYear = new Date().getFullYear();
      if (isNaN(y) || y < currentYear - 120 || y > currentYear) {
        errs.birthYear = `Enter a valid year (${currentYear - 120}-${currentYear})`;
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    const success = await onAdd({
      name: name.trim(),
      gender: gender || undefined,
      birth_year: birthYear ? parseInt(birthYear, 10) : undefined,
      dietary_preferences: selectedDietary.length > 0 ? selectedDietary : undefined,
    });
    setSubmitting(false);
    if (success) onClose();
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
            <Label htmlFor="fm-birthyear">Birth Year</Label>
            <Input
              id="fm-birthyear"
              type="number"
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value)}
              placeholder={`e.g. ${new Date().getFullYear() - 30}`}
              className="rounded-xl"
              min={new Date().getFullYear() - 120}
              max={new Date().getFullYear()}
            />
            {errors.birthYear && <p className="text-xs text-destructive">{errors.birthYear}</p>}
          </div>

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
