import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  AlertCircle,
  Calendar,
  Check,
  FileText,
  FlaskConical,
  History,
  Loader2,
  Plus,
  Search,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import {
  categoryIcon,
  categoryLabel,
  categoryLabelAr,
  computeMarkerStatus,
  type BloodMarkerDefinition,
  type MarkerCategory,
} from "@/lib/blood-markers";
import { cn } from "@/lib/utils";
import {
  createBloodWorkRecord,
  fetchBloodWorkRecords,
  fetchMarkerDefinitions,
  insertMarkers,
  uploadBloodReport,
} from "@/services/blood-work";
import { extractBloodMarkersFromPdf } from "@/services/blood-work-extractor";

interface ManualMarker {
  defId: string;
  marker_name: string;
  marker_name_ar: string | null;
  unit: string;
  normal_min: number | null;
  normal_max: number | null;
  category: MarkerCategory;
  value: string;
}

const categories: MarkerCategory[] = [
  "metabolic",
  "lipid",
  "liver",
  "kidney",
  "thyroid",
  "vitamins",
  "hormones",
  "blood",
  "inflammation",
];

export default function BloodWorkUpload() {
  const { language, isRTL } = useLanguage();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [mode, setMode] = useState<"choose" | "upload" | "manual">("choose");
  const [labName, setLabName] = useState("");
  const [testDate, setTestDate] = useState(new Date().toISOString().split("T")[0]);
  const [fasting, setFasting] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractionMessage, setExtractionMessage] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [definitions, setDefinitions] = useState<BloodMarkerDefinition[]>([]);
  const [selectedDefs, setSelectedDefs] = useState<ManualMarker[]>([]);
  const [activeCategory, setActiveCategory] = useState<MarkerCategory>("metabolic");
  const [searchTerm, setSearchTerm] = useState("");
  const [prevRecords, setPrevRecords] = useState<{ id: string; date: string }[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const defs = await fetchMarkerDefinitions();
      if (cancelled) return;
      setDefinitions(defs);

      if (user) {
        const records = await fetchBloodWorkRecords(user.id);
        if (!cancelled) {
          setPrevRecords(records.map((record) => ({ id: record.id, date: record.test_date })));
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const filteredDefs = definitions.filter(
    (definition) =>
      definition.category === activeCategory &&
      (searchTerm === "" ||
        definition.marker_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (definition.marker_name_ar && definition.marker_name_ar.includes(searchTerm))),
  );

  const hasManualValues = selectedDefs.some((marker) => marker.value.trim() !== "");
  const canSubmit = mode === "upload" ? Boolean(uploadFile) : selectedDefs.length > 0 && hasManualValues;

  function addMarker(definition: BloodMarkerDefinition) {
    if (selectedDefs.some((selected) => selected.defId === definition.id)) return;
    setSelectedDefs([
      ...selectedDefs,
      {
        defId: definition.id,
        marker_name: definition.marker_name,
        marker_name_ar: definition.marker_name_ar,
        unit: definition.unit,
        normal_min: definition.normal_min,
        normal_max: definition.normal_max,
        category: definition.category,
        value: "",
      },
    ]);
  }

  function removeMarker(defId: string) {
    setSelectedDefs(selectedDefs.filter((selected) => selected.defId !== defId));
  }

  function updateMarkerValue(defId: string, value: string) {
    setSelectedDefs(
      selectedDefs.map((selected) => (selected.defId === defId ? { ...selected, value } : selected)),
    );
  }

  async function handleSubmit() {
    if (!user) return;

    setSubmitting(true);
    try {
      const reportUrl = mode === "upload" && uploadFile ? await uploadBloodReport(uploadFile, user.id) : undefined;
      const record = await createBloodWorkRecord({
        user_id: user.id,
        lab_name: labName || undefined,
        test_date: testDate,
        fasting,
        report_url: reportUrl,
      });

      if (mode === "manual" || mode === "upload") {
        const filledMarkers = selectedDefs
          .filter((selected) => selected.value.trim() !== "")
          .map((selected) => {
            const value = parseFloat(selected.value);
            return {
              record_id: record.id,
              marker_name: selected.marker_name,
              marker_name_ar: selected.marker_name_ar,
              value,
              unit: selected.unit,
              normal_min: selected.normal_min,
              normal_max: selected.normal_max,
              status: computeMarkerStatus(value, selected.normal_min, selected.normal_max),
              category: selected.category,
              notes: null,
            };
          });

        if (filledMarkers.length > 0) {
          await insertMarkers(filledMarkers);
        }
      }

      toast({ title: isRTL ? "تم الحفظ بنجاح" : "Saved successfully" });
      navigate("/health/blood-work/results");
    } catch (error: unknown) {
      toast({
        title: isRTL ? "تعذر الحفظ" : "Could not save",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUploadFile(file: File | null) {
    setUploadFile(null);
    setExtractionMessage(null);

    if (!file) return;

    if (file.type !== "application/pdf") {
      toast({
        title: isRTL ? "نوع الملف غير مدعوم" : "Unsupported file type",
        description: isRTL ? "ارفع ملف PDF فقط." : "Please upload a PDF report only.",
        variant: "destructive",
      });
      return;
    }

    setUploadFile(file);
    setExtracting(true);
    try {
      const extracted = await extractBloodMarkersFromPdf(file, definitions);
      if (extracted.length === 0) {
        setSelectedDefs([]);
        setExtractionMessage(
          isRTL
            ? "تم حفظ الملف، لكن لم نتمكن من قراءة القيم تلقائيًا. يمكنك حفظه كمرجع أو إدخال القيم يدويًا."
            : "The file can be saved, but no marker values were detected. You can save it as a reference or enter values manually.",
        );
        return;
      }

      setSelectedDefs(
        extracted.map(({ definition, value }) => ({
          defId: definition.id,
          marker_name: definition.marker_name,
          marker_name_ar: definition.marker_name_ar,
          unit: definition.unit,
          normal_min: definition.normal_min,
          normal_max: definition.normal_max,
          category: definition.category,
          value,
        })),
      );
      setExtractionMessage(
        isRTL
          ? `تم استخراج ${extracted.length} مؤشر. راجع القيم قبل الحفظ.`
          : `${extracted.length} markers found. Review the values before saving.`,
      );
    } catch {
      setSelectedDefs([]);
      setExtractionMessage(
        isRTL
          ? "لم نتمكن من قراءة هذا التقرير تلقائيًا. يمكنك حفظه كمرجع أو إدخال القيم يدويًا."
          : "We could not read this report automatically. You can save it as a reference or enter values manually.",
      );
    } finally {
      setExtracting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F6F8FB] text-[#020617]" dir={isRTL ? "rtl" : "ltr"}>
      <header className="sticky top-0 z-30 border-b border-[#E5EAF1] bg-[#F6F8FB]/90 pt-safe backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[430px] items-center gap-3 px-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#020617] shadow-[0_8px_22px_rgba(15,23,42,0.08)] ring-1 ring-[#E5EAF1] active:scale-95"
            aria-label={isRTL ? "رجوع" : "Back"}
          >
            <ArrowLeft className={cn("h-5 w-5", isRTL && "rotate-180")} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#22C7A1]">
              {isRTL ? "الصحة" : "Health"}
            </p>
            <h1 className="truncate text-[19px] font-black tracking-[-0.03em]">
              {isRTL ? "فحوصات الدم" : "Blood work"}
            </h1>
          </div>
          <button
            type="button"
            onClick={() => navigate("/health/blood-work/results")}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#020617] shadow-[0_8px_22px_rgba(15,23,42,0.08)] ring-1 ring-[#E5EAF1] active:scale-95"
            aria-label={isRTL ? "السجل" : "History"}
          >
            <History className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[430px] space-y-4 px-4 pb-28 pt-4">
        <section className="overflow-hidden rounded-[30px] border border-[#E5EAF1] bg-white p-5 shadow-[0_18px_42px_rgba(15,23,42,0.07)]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#22C7A1]">
                {isRTL ? "مختبرك الصحي" : "Lab snapshot"}
              </p>
              <h2 className="mt-2 text-[25px] font-black leading-[1.08] tracking-[-0.04em]">
                {isRTL ? "أضف نتائجك بدقة" : "Add your results clearly"}
              </h2>
              <p className="mt-2 max-w-[280px] text-[13px] font-semibold leading-5 text-[#64748B]">
                {isRTL
                  ? "ارفع التقرير أو أدخل المؤشرات يدويًا لمتابعة الاتجاهات الصحية."
                  : "Upload a report or enter markers manually to track health trends."}
              </p>
            </div>
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px] bg-[#EFF9FF] text-[#38BDF8] ring-1 ring-[#D8F1FF]">
              <FlaskConical className="h-7 w-7" />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 overflow-hidden rounded-[22px] border border-[#E5EAF1] bg-[#F6F8FB]">
            <div className="p-3">
              <p className="text-[10px] font-black uppercase text-[#94A3B8]">{isRTL ? "المؤشرات" : "Markers"}</p>
              <p className="mt-1 text-[20px] font-black">{selectedDefs.length}</p>
            </div>
            <div className="border-x border-[#E5EAF1] p-3">
              <p className="text-[10px] font-black uppercase text-[#94A3B8]">{isRTL ? "السجلات" : "Records"}</p>
              <p className="mt-1 text-[20px] font-black">{prevRecords.length}</p>
            </div>
            <div className="p-3">
              <p className="text-[10px] font-black uppercase text-[#94A3B8]">{isRTL ? "الحالة" : "Status"}</p>
              <p className="mt-1 text-[13px] font-black text-[#22C7A1]">
                {fasting ? (isRTL ? "صائم" : "Fasting") : isRTL ? "غير صائم" : "Fed"}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-[#E5EAF1] bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.06)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                {isRTL ? "تفاصيل التحليل" : "Test details"}
              </p>
              <h3 className="mt-1 text-[19px] font-black tracking-[-0.03em] text-[#020617]">
                {isRTL ? "المختبر والتاريخ" : "Lab and date"}
              </h3>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-[#EFFFFA] text-[#22C7A1]">
              <Calendar className="h-5 w-5" />
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="blood-lab-name" className="text-[12px] font-black text-[#020617]">
                {isRTL ? "اسم المختبر" : "Lab name"}
              </Label>
              <Input
                id="blood-lab-name"
                value={labName}
                onChange={(event) => setLabName(event.target.value)}
                placeholder={isRTL ? "مثال: مختبر البرج" : "e.g., Al Borg Laboratories"}
                className="h-12 rounded-[18px] border-[#E5EAF1] bg-[#F6F8FB] text-[14px] font-bold text-[#020617] placeholder:text-[#94A3B8]"
              />
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="blood-test-date" className="text-[12px] font-black text-[#020617]">
                  {isRTL ? "تاريخ التحليل" : "Test date"}
                </Label>
                <Input
                  id="blood-test-date"
                  type="date"
                  value={testDate}
                  onChange={(event) => setTestDate(event.target.value)}
                  className="h-12 rounded-[18px] border-[#E5EAF1] bg-[#F6F8FB] text-[14px] font-bold text-[#020617]"
                />
              </div>
              <label className="mt-[26px] flex h-12 min-w-[104px] items-center justify-center gap-2 rounded-[18px] border border-[#E5EAF1] bg-[#F6F8FB] px-3 text-[12px] font-black text-[#020617]">
                <input
                  type="checkbox"
                  checked={fasting}
                  onChange={(event) => setFasting(event.target.checked)}
                  className="sr-only"
                />
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full border",
                    fasting ? "border-[#22C7A1] bg-[#22C7A1]" : "border-[#CBD5E1] bg-white",
                  )}
                >
                  {fasting && <Check className="h-3 w-3 text-white" />}
                </span>
                {isRTL ? "صائم" : "Fasting"}
              </label>
            </div>
          </div>
        </section>

        {mode === "choose" && (
          <section className="space-y-3">
            <div className="px-1">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                {isRTL ? "طريقة الإدخال" : "Input method"}
              </p>
              <h3 className="mt-1 text-[20px] font-black tracking-[-0.03em] text-[#020617]">
                {isRTL ? "كيف تريد إضافة النتائج؟" : "How do you want to add results?"}
              </h3>
            </div>
            <button
              onClick={() => setMode("manual")}
              className="flex w-full items-center gap-4 rounded-[26px] border border-[#CFF8ED] bg-white p-4 text-start shadow-[0_14px_34px_rgba(15,23,42,0.06)] active:scale-[0.99]"
            >
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px] bg-[#EFFFFA] text-[#22C7A1]">
                <FlaskConical className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-black text-[#020617]">{isRTL ? "إدخال يدوي" : "Enter manually"}</p>
                <p className="mt-1 text-[12px] font-semibold leading-5 text-[#94A3B8]">
                  {isRTL ? "اختر المؤشرات وأدخل القيم بنفسك." : "Choose markers and enter exact values yourself."}
                </p>
              </div>
              <Plus className="h-5 w-5 text-[#94A3B8]" />
            </button>
            <button
              onClick={() => setMode("upload")}
              className="flex w-full items-center gap-4 rounded-[26px] border border-[#D8F1FF] bg-white p-4 text-start shadow-[0_14px_34px_rgba(15,23,42,0.06)] active:scale-[0.99]"
            >
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px] bg-[#EFF9FF] text-[#38BDF8]">
                <FileText className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-black text-[#020617]">{isRTL ? "رفع التقرير" : "Upload report"}</p>
                <p className="mt-1 text-[12px] font-semibold leading-5 text-[#94A3B8]">
                  {isRTL ? "ارفع PDF أو صورة من تقرير المختبر." : "Attach a PDF or image from your lab."}
                </p>
              </div>
              <Upload className="h-5 w-5 text-[#94A3B8]" />
            </button>
          </section>
        )}

        {mode === "upload" && (
          <section className="rounded-[24px] border border-[#E5EAF1] bg-white p-3 shadow-[0_10px_26px_rgba(15,23,42,0.05)]">
            <div className="mb-3 flex items-center justify-between">
              <button onClick={() => setMode("choose")} className="text-[13px] font-black text-[#64748B]">
                {isRTL ? "رجوع" : "Back"}
              </button>
              <span className="rounded-full bg-[#EFF9FF] px-3 py-1 text-[11px] font-black text-[#38BDF8]">
                PDF
              </span>
            </div>
            <div
              className="cursor-pointer rounded-[22px] border-2 border-dashed border-[#BDEBFF] bg-[#EFF9FF] px-5 py-6 text-center transition active:scale-[0.99]"
              onClick={() => document.getElementById("blood-report-upload")?.click()}
            >
              {uploadFile ? (
                <div className="flex items-center justify-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#22C7A1] text-white">
                    <Check className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 truncate text-sm font-black text-[#020617]">{uploadFile.name}</span>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setUploadFile(null);
                      setSelectedDefs([]);
                      setExtractionMessage(null);
                    }}
                  >
                    <X className="h-4 w-4 text-[#94A3B8]" />
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="mx-auto mb-2 h-8 w-8 text-[#38BDF8]" />
                  <p className="text-[15px] font-black text-[#020617]">{isRTL ? "اضغط لرفع الملف" : "Tap to upload"}</p>
                  <p className="mt-1 text-sm font-semibold text-[#94A3B8]">
                    {isRTL ? "اختر تقرير المختبر من جهازك" : "Choose a lab report from your device"}
                  </p>
                </>
              )}
            </div>
            {extracting && (
              <div className="mt-3 flex items-center gap-3 rounded-[18px] bg-[#F6F8FB] p-3 text-sm font-bold text-[#64748B]">
                <Loader2 className="h-4 w-4 animate-spin text-[#38BDF8]" />
                {isRTL ? "Ø¬Ø§Ø±ÙŠ Ù‚Ø±Ø§Ø¡Ø© Ø§Ù„ØªÙ‚Ø±ÙŠØ±..." : "Reading report..."}
              </div>
            )}
            {extractionMessage && !extracting && (
              <div className="mt-3 flex gap-3 rounded-[18px] bg-[#F6F8FB] p-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#38BDF8]" />
                <p className="text-sm font-semibold leading-5 text-[#64748B]">{extractionMessage}</p>
              </div>
            )}
            {selectedDefs.length > 0 && (
              <div className="mt-4 rounded-[22px] border border-[#CFF8ED] bg-[#F8FFFC] p-3">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#22C7A1]">
                      {isRTL ? "Ù…Ø±Ø§Ø¬Ø¹Ø©" : "Review"}
                    </p>
                    <h3 className="text-[16px] font-black text-[#020617]">
                      {isRTL ? "Ø§Ù„Ù‚ÙŠÙ… Ø§Ù„Ù…Ø³ØªØ®Ø±Ø¬Ø©" : "Extracted values"}
                    </h3>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-[#22C7A1]">
                    {selectedDefs.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {selectedDefs.map((marker) => (
                    <div key={marker.defId} className="grid grid-cols-[1fr_104px_32px] items-center gap-2 rounded-[16px] bg-white p-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-[#020617]">
                          {language === "ar" && marker.marker_name_ar ? marker.marker_name_ar : marker.marker_name}
                        </p>
                        <p className="text-[11px] font-bold text-[#94A3B8]">{marker.unit}</p>
                      </div>
                      <Input
                        type="number"
                        step="any"
                        value={marker.value}
                        onChange={(event) => updateMarkerValue(marker.defId, event.target.value)}
                        className="h-11 rounded-[14px] border-[#E5EAF1] bg-[#F6F8FB] text-center font-black"
                      />
                      <button
                        type="button"
                        onClick={() => removeMarker(marker.defId)}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F6F8FB] text-[#94A3B8]"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <input
              id="blood-report-upload"
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(event) => {
                void handleUploadFile(event.target.files?.[0] || null);
                event.target.value = "";
              }}
            />
          </section>
        )}

        {mode === "manual" && (
          <>
            <section className="rounded-[28px] border border-[#E5EAF1] bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.06)]">
              <div className="mb-3 flex items-center justify-between gap-3">
                <button onClick={() => setMode("choose")} className="text-[13px] font-black text-[#64748B]">
                  {isRTL ? "رجوع" : "Back"}
                </button>
                <span className="rounded-full bg-[#EFFFFA] px-3 py-1 text-[11px] font-black text-[#22C7A1]">
                  {selectedDefs.length} {isRTL ? "محدد" : "selected"}
                </span>
              </div>

              <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {categories.map((category) => (
                  <button
                    key={category}
                    onClick={() => setActiveCategory(category)}
                    className={cn(
                      "flex-shrink-0 rounded-full px-3 py-2 text-xs font-black transition",
                      activeCategory === category
                        ? "bg-[#020617] text-white"
                        : "border border-[#E5EAF1] bg-[#F6F8FB] text-[#64748B]",
                    )}
                  >
                    {categoryIcon(category)} {language === "ar" ? categoryLabelAr(category) : categoryLabel(category)}
                  </button>
                ))}
              </div>

              <div className="relative">
                <Search className="absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
                <Input
                  placeholder={isRTL ? "ابحث عن مؤشر..." : "Search marker..."}
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="h-12 rounded-[18px] border-[#E5EAF1] bg-[#F6F8FB] ps-11 text-[14px] font-bold"
                />
              </div>

              <div className="mt-3 grid max-h-[300px] grid-cols-1 gap-2 overflow-y-auto pe-1">
                {filteredDefs.map((definition) => {
                  const isSelected = selectedDefs.some((selected) => selected.defId === definition.id);
                  return (
                    <button
                      key={definition.id}
                      onClick={() => (isSelected ? removeMarker(definition.id) : addMarker(definition))}
                      className={cn(
                        "flex items-center gap-3 rounded-[16px] border p-3 text-start transition",
                        isSelected ? "border-[#22C7A1] bg-[#EFFFFA]" : "border-[#E5EAF1] bg-white",
                      )}
                    >
                      <span className="flex-1 text-sm font-black text-[#020617]">
                        {language === "ar" && definition.marker_name_ar ? definition.marker_name_ar : definition.marker_name}
                      </span>
                      <span className="text-xs font-bold text-[#94A3B8]">{definition.unit}</span>
                      {isSelected && <Check className="h-4 w-4 text-[#22C7A1]" />}
                    </button>
                  );
                })}
              </div>
            </section>

            {selectedDefs.length > 0 && (
              <section className="rounded-[28px] border border-[#CFF8ED] bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.06)]">
                <h3 className="mb-3 flex items-center gap-2 text-[17px] font-black text-[#020617]">
                  <ShieldCheck className="h-5 w-5 text-[#22C7A1]" />
                  {isRTL ? "أدخل القيم" : "Enter values"}
                </h3>
                {selectedDefs.map((marker) => (
                  <div
                    key={marker.defId}
                    className="mb-2 grid grid-cols-[1fr_104px_32px] items-center gap-2 rounded-[16px] bg-[#F6F8FB] p-2 last:mb-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-[#020617]">
                        {language === "ar" && marker.marker_name_ar ? marker.marker_name_ar : marker.marker_name}
                      </p>
                      <p className="text-[11px] font-bold text-[#94A3B8]">{marker.unit}</p>
                    </div>
                    <Input
                      type="number"
                      step="any"
                      value={marker.value}
                      onChange={(event) => updateMarkerValue(marker.defId, event.target.value)}
                      placeholder="-"
                      className="h-11 rounded-[14px] border-[#E5EAF1] bg-white text-center font-black"
                    />
                    <button
                      onClick={() => removeMarker(marker.defId)}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#94A3B8]"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </section>
            )}
          </>
        )}

        {mode !== "choose" && (
          <div className="fixed inset-x-0 bottom-[72px] z-40 border-t border-[#E5EAF1] bg-white/95 px-4 pb-3 pt-3 backdrop-blur-xl">
            <div className="mx-auto max-w-[430px]">
              <Button
                onClick={handleSubmit}
                disabled={submitting || !canSubmit}
                className="h-14 w-full rounded-[22px] bg-[#020617] text-[15px] font-black text-white shadow-[0_16px_32px_rgba(2,6,23,0.22)] hover:bg-[#111827] disabled:bg-[#E2E8F0] disabled:text-[#94A3B8]"
              >
                {submitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : isRTL ? (
                  "حفظ التحليل"
                ) : (
                  "Save blood work"
                )}
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
