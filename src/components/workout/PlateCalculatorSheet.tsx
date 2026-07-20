import { useEffect, useMemo, useState } from "react";
import { Check, Dumbbell, Minus, Plus, Save, Scale, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useLanguage } from "@/contexts/LanguageContext";
import type { WorkoutEquipmentProfile } from "@/hooks/useWorkoutEquipmentProfiles";
import { calculatePlateLoad, type PlatePair } from "@/lib/strength-training";
import { cn } from "@/lib/utils";

interface PlateCalculatorSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetWeightKg: number;
  profiles: WorkoutEquipmentProfile[];
  defaultProfile: WorkoutEquipmentProfile;
  onApply: (weightKg: number) => void;
  onSaveProfile: (input: {
    id?: string;
    name: string;
    barWeightKg: number;
    platePairs: PlatePair[];
    equipment: string[];
    makeDefault?: boolean;
  }) => Promise<void>;
}

export function PlateCalculatorSheet({
  open,
  onOpenChange,
  targetWeightKg,
  profiles,
  defaultProfile,
  onApply,
  onSaveProfile,
}: PlateCalculatorSheetProps) {
  const { isRTL } = useLanguage();
  const copy = isRTL ? {
    loadBar: "تحميل البار",
    description: "يستخدم الأوزان المتاحة في ملف النادي المحدد. الأعداد لكل جانب.",
    target: "المستهدف",
    loadable: "القابل للتحميل",
    eachSide: "كل جانب",
    barOnly: "البار فقط",
    profile: "ملف المعدات",
    pairs: "البار وأزواج الأوزان",
    profileName: "اسم الملف",
    barWeight: "وزن البار",
    equipment: "المعدات المتاحة",
    saving: "جارٍ الحفظ...",
    saveDefault: "حفظ كافتراضي",
    useWeight: (weight: number) => `استخدام ${weight} كجم`,
    saved: "تم حفظ ملف المعدات",
    saveError: "تعذر حفظ المعدات",
    myGym: "ناديي",
  } : {
    loadBar: "Load the bar",
    description: "Uses the plates available in your selected gym profile. Counts are per side.",
    target: "Target",
    loadable: "Loadable",
    eachSide: "Each side",
    barOnly: "Bar only",
    profile: "Equipment profile",
    pairs: "Bar and plate pairs",
    profileName: "Profile name",
    barWeight: "Bar weight",
    equipment: "Available equipment",
    saving: "Saving...",
    saveDefault: "Save as default",
    useWeight: (weight: number) => `Use ${weight} kg`,
    saved: "Equipment profile saved",
    saveError: "Could not save equipment",
    myGym: "My gym",
  };
  const [profileId, setProfileId] = useState(defaultProfile.id);
  const [profileName, setProfileName] = useState(defaultProfile.name);
  const [barWeightKg, setBarWeightKg] = useState(defaultProfile.bar_weight_kg);
  const [platePairs, setPlatePairs] = useState(defaultProfile.plate_pairs);
  const [equipment, setEquipment] = useState(defaultProfile.equipment);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setProfileId(defaultProfile.id);
    setProfileName(defaultProfile.name);
    setBarWeightKg(defaultProfile.bar_weight_kg);
    setPlatePairs(defaultProfile.plate_pairs);
    setEquipment(defaultProfile.equipment);
  }, [defaultProfile, open]);

  const calculation = useMemo(
    () => calculatePlateLoad(targetWeightKg || barWeightKg, barWeightKg, platePairs),
    [barWeightKg, platePairs, targetWeightKg],
  );

  const chooseProfile = (id: string) => {
    const profile = profiles.find((item) => item.id === id);
    if (!profile) return;
    setProfileId(id);
    setProfileName(profile.name);
    setBarWeightKg(profile.bar_weight_kg);
    setPlatePairs(profile.plate_pairs);
    setEquipment(profile.equipment);
  };

  const updatePlateCount = (weightKg: number, delta: number) => {
    setPlatePairs((current) => current.map((plate) =>
      plate.weightKg === weightKg
        ? { ...plate, count: Math.max(0, Math.min(8, plate.count + delta)) }
        : plate));
  };

  const save = async () => {
    setSaving(true);
    try {
      await onSaveProfile({
        id: profileId,
        name: profileName || copy.myGym,
        barWeightKg,
        platePairs,
        equipment,
        makeDefault: true,
      });
      toast.success(copy.saved);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : copy.saveError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        dir={isRTL ? "rtl" : "ltr"}
        side="bottom"
        className="inset-x-0 mx-auto flex max-h-[92dvh] w-full max-w-[430px] flex-col overflow-hidden rounded-t-[30px] border-0 bg-[#F6F8FB] p-0 shadow-[0_-24px_70px_rgba(2,6,23,0.2)]"
        closeButtonClassName="end-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#020617] opacity-100 ring-1 ring-[#E5EAF1]"
      >
        <SheetHeader className="shrink-0 bg-white px-5 pb-4 pt-5 text-start">
          <div className="flex h-11 w-11 items-center justify-center rounded-[15px] bg-[#F3F1FF] text-[#7C83F6]">
            <Dumbbell className="h-5 w-5" />
          </div>
          <SheetTitle className="pe-14 text-[21px] font-black text-[#020617]">{copy.loadBar}</SheetTitle>
          <SheetDescription className="text-[12px] font-semibold leading-5 text-[#94A3B8]">
            {copy.description}
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(28px,env(safe-area-inset-bottom))] pt-4">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {profiles.map((profile) => (
              <button
                key={profile.id}
                type="button"
                onClick={() => chooseProfile(profile.id)}
                className={cn(
                  "h-11 shrink-0 rounded-full px-4 text-[11px] font-extrabold transition active:scale-95",
                  profileId === profile.id
                    ? "bg-[#020617] text-white"
                    : "bg-white text-[#64748B] ring-1 ring-[#E5EAF1]",
                )}
              >
                {profile.name}
              </button>
            ))}
          </div>

          <section className="mt-4 overflow-hidden rounded-[24px] bg-white ring-1 ring-[#E5EAF1]">
            <div className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.13em] text-[#94A3B8]">{copy.target}</p>
                <p className="mt-1 text-[30px] font-black text-[#020617]">{targetWeightKg || barWeightKg}<span className="ms-1 text-[12px] text-[#94A3B8]">kg</span></p>
              </div>
              <div className="text-end">
                <p className="text-[10px] font-black uppercase tracking-[0.13em] text-[#94A3B8]">{copy.loadable}</p>
                <p className={cn("mt-1 text-[24px] font-black", calculation.exact ? "text-[#22C7A1]" : "text-[#FB6B7A]")}>{calculation.actualWeightKg}<span className="ms-1 text-[11px]">kg</span></p>
                {!calculation.exact && <p className="text-[9px] font-bold text-[#FB6B7A]">{calculation.differenceKg > 0 ? "+" : ""}{calculation.differenceKg} kg</p>}
              </div>
            </div>
            <div className="border-t border-[#E5EAF1] bg-[#F8FAFC] px-4 py-3">
              <div className="flex items-center gap-2 text-[11px] font-extrabold text-[#020617]">
                <Scale className="h-4 w-4 text-[#38BDF8]" />
                {copy.eachSide}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {calculation.perSide.length > 0 ? calculation.perSide.map((plate) => (
                  <span key={plate.weightKg} className="inline-flex h-10 min-w-10 items-center justify-center rounded-full bg-[#020617] px-2 text-[10px] font-black text-white ring-4 ring-white">
                    {plate.count > 1 ? `${plate.count}x` : ""}{plate.weightKg}
                  </span>
                )) : <span className="text-[11px] font-semibold text-[#94A3B8]">{copy.barOnly}</span>}
              </div>
            </div>
          </section>

          <section className="mt-4 rounded-[24px] bg-white p-4 ring-1 ring-[#E5EAF1]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.13em] text-[#7C83F6]">{copy.profile}</p>
                <h3 className="mt-1 text-[16px] font-black text-[#020617]">{copy.pairs}</h3>
              </div>
              <SlidersHorizontal className="h-5 w-5 text-[#7C83F6]" />
            </div>
            <label className="mt-4 block text-[10px] font-extrabold text-[#64748B]">
              {copy.profileName}
              <input value={profileName} onChange={(event) => setProfileName(event.target.value)} className="mt-1.5 h-11 w-full rounded-[14px] bg-[#F6F8FB] px-3 text-[12px] font-bold text-[#020617] outline-none ring-1 ring-[#E5EAF1] focus:ring-[#7C83F6]" />
            </label>
            <div className="mt-3 flex items-center justify-between rounded-[16px] bg-[#F6F8FB] px-3 py-2 ring-1 ring-[#E5EAF1]">
              <span className="text-[11px] font-extrabold text-[#020617]">{copy.barWeight}</span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setBarWeightKg((value) => Math.max(0, value - 5))} className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#64748B] ring-1 ring-[#E5EAF1]"><Minus className="h-4 w-4" /></button>
                <span className="w-12 text-center text-[13px] font-black text-[#020617]">{barWeightKg}kg</span>
                <button type="button" onClick={() => setBarWeightKg((value) => Math.min(100, value + 5))} className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#64748B] ring-1 ring-[#E5EAF1]"><Plus className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {platePairs.map((plate) => (
                <div key={plate.weightKg} className="flex items-center justify-between rounded-[15px] bg-[#F6F8FB] p-2 ring-1 ring-[#E5EAF1]">
                  <span className="text-[11px] font-black text-[#020617]">{plate.weightKg}kg</span>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => updatePlateCount(plate.weightKg, -1)} className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#64748B]"><Minus className="h-3.5 w-3.5" /></button>
                    <span className="w-4 text-center text-[11px] font-black text-[#7C83F6]">{plate.count}</span>
                    <button type="button" onClick={() => updatePlateCount(plate.weightKg, 1)} className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#64748B]"><Plus className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <p className="text-[10px] font-extrabold text-[#64748B]">{copy.equipment}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {["barbell", "dumbbell", "cable", "machine", "body weight", "kettlebell"].map((item) => {
                  const selected = equipment.includes(item);
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setEquipment((current) => selected
                        ? current.filter((value) => value !== item)
                        : [...current, item])}
                      className={cn(
                        "min-h-10 rounded-full px-3 text-[10px] font-extrabold capitalize transition active:scale-95",
                        selected ? "bg-[#020617] text-white" : "bg-[#F6F8FB] text-[#64748B] ring-1 ring-[#E5EAF1]",
                      )}
                    >
                      {selected && <Check className="me-1 inline h-3.5 w-3.5 text-[#22C7A1]" />}{item}
                    </button>
                  );
                })}
              </div>
            </div>
            <button type="button" disabled={saving} onClick={() => void save()} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-[14px] bg-[#F3F1FF] text-[11px] font-black text-[#656BD8] ring-1 ring-[#DCD8FF] disabled:opacity-50">
              <Save className="h-4 w-4" /> {saving ? copy.saving : copy.saveDefault}
            </button>
          </section>

          <button
            type="button"
            onClick={() => {
              onApply(calculation.actualWeightKg);
              onOpenChange(false);
            }}
            className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-[18px] bg-[#020617] text-[14px] font-black text-white shadow-[0_12px_26px_rgba(2,6,23,0.18)] active:scale-[0.98]"
          >
            <Check className="h-5 w-5 text-[#22C7A1]" /> {copy.useWeight(calculation.actualWeightKg)}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
