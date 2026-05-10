import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Upload, FileText, Plus, X, Loader2, Check,
  FlaskConical, Calendar,
} from "lucide-react";
import { fetchMarkerDefinitions, fetchBloodWorkRecords, createBloodWorkRecord, insertMarkers, uploadBloodReport } from "@/services/blood-work";
import { computeMarkerStatus, categoryIcon, categoryLabel, categoryLabelAr, type BloodMarkerDefinition, type MarkerCategory } from "@/lib/blood-markers";
import { cn } from "@/lib/utils";

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

export default function BloodWorkUpload() {
  const { t, language, isRTL } = useLanguage();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { toast } = useToast();

  const [mode, setMode] = useState<"choose" | "upload" | "manual">("choose");
  const [labName, setLabName] = useState("");
  const [testDate, setTestDate] = useState(new Date().toISOString().split("T")[0]);
  const [fasting, setFasting] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  // Manual state
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
        if (cancelled) return;
        setPrevRecords(records.map((r) => ({ id: r.id, date: r.test_date })));
      }
    }
    load();

    return () => { cancelled = true; };
  }, [user]);

  const categories: MarkerCategory[] = [
    "metabolic", "lipid", "liver", "kidney", "thyroid", "vitamins", "hormones", "blood", "inflammation",
  ];

  const filteredDefs = definitions.filter(
    (d) =>
      d.category === activeCategory &&
      (searchTerm === "" ||
        d.marker_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (d.marker_name_ar && d.marker_name_ar.includes(searchTerm)))
  );

  function addMarker(def: BloodMarkerDefinition) {
    if (selectedDefs.find((s) => s.defId === def.id)) return;
    setSelectedDefs([...selectedDefs, {
      defId: def.id,
      marker_name: def.marker_name,
      marker_name_ar: def.marker_name_ar,
      unit: def.unit,
      normal_min: def.normal_min,
      normal_max: def.normal_max,
      category: def.category,
      value: "",
    }]);
  }

  function removeMarker(defId: string) {
    setSelectedDefs(selectedDefs.filter((s) => s.defId !== defId));
  }

  function updateMarkerValue(defId: string, value: string) {
    setSelectedDefs(selectedDefs.map((s) => (s.defId === defId ? { ...s, value } : s)));
  }

  async function handleSubmit() {
    if (!user) return;
    setSubmitting(true);
    try {
      let reportUrl: string | undefined;
      if (mode === "upload" && uploadFile) {
        reportUrl = await uploadBloodReport(uploadFile, user.id);
      }

      const record = await createBloodWorkRecord({
        user_id: user.id,
        lab_name: labName || undefined,
        test_date: testDate,
        fasting,
        report_url: reportUrl,
      });

      if (mode === "manual") {
        const filledMarkers = selectedDefs
          .filter((s) => s.value.trim() !== "")
          .map((s) => {
            const val = parseFloat(s.value);
            return {
              record_id: record.id,
              marker_name: s.marker_name,
              marker_name_ar: s.marker_name_ar,
              value: val,
              unit: s.unit,
              normal_min: s.normal_min,
              normal_max: s.normal_max,
              status: computeMarkerStatus(val, s.normal_min, s.normal_max),
              category: s.category,
            };
          });
        if (filledMarkers.length > 0) {
          await insertMarkers(filledMarkers);
        }
      }

      toast({ title: isRTL ? "تم الحفظ بنجاح" : "Saved successfully!" });
      navigate("/health/blood-work/results");
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b">
        <div className="flex items-center gap-3 p-4 max-w-lg mx-auto">
          <button onClick={() => navigate(-1)} className="p-1">
            <ArrowLeft className={cn("w-5 h-5", isRTL && "rotate-180")} />
          </button>
          <h1 className="text-lg font-bold flex-1">
            {isRTL ? "🩸 إضافة تحليل دم" : "🩸 Add Blood Work"}
          </h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* Common fields */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div>
              <Label className="text-sm text-gray-600">{isRTL ? "اسم المختبر" : "Lab Name"}</Label>
              <Input
                value={labName}
                onChange={(e) => setLabName(e.target.value)}
                placeholder={isRTL ? "مثال: المختبر التخصصي" : "e.g., Al Borg Laboratories"}
              />
            </div>
            <div>
              <Label className="text-sm text-gray-600">{isRTL ? "تاريخ التحليل" : "Test Date"}</Label>
              <Input type="date" value={testDate} onChange={(e) => setTestDate(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="fasting"
                checked={fasting}
                onChange={(e) => setFasting(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="fasting">{isRTL ? "صائم" : "Fasting"}</Label>
            </div>
          </CardContent>
        </Card>

        {/* Mode selector */}
        {mode === "choose" && (
          <div className="space-y-3">
            <h2 className="font-semibold text-gray-700">{isRTL ? "كيف تريد إدخال النتائج؟" : "How would you like to enter results?"}</h2>
            <button
              onClick={() => setMode("manual")}
              className="w-full p-4 bg-white rounded-xl border-2 border-dashed border-gray-200 hover:border-emerald-400 transition text-left flex items-center gap-4"
            >
              <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center">
                <FlaskConical className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="font-semibold">{isRTL ? "إدخال يدوي" : "Enter Manually"}</p>
                <p className="text-sm text-gray-500">{isRTL ? "اختر التحاليل وأدخل القيم" : "Select tests and enter values"}</p>
              </div>
            </button>
            <button
              onClick={() => setMode("upload")}
              className="w-full p-4 bg-white rounded-xl border-2 border-dashed border-gray-200 hover:border-blue-400 transition text-left flex items-center gap-4"
            >
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold">{isRTL ? "رفع تقرير PDF" : "Upload PDF Report"}</p>
                <p className="text-sm text-gray-500">{isRTL ? "ارفع ملف التقرير" : "Upload your lab report file"}</p>
              </div>
            </button>
          </div>
        )}

        {/* Upload mode */}
        {mode === "upload" && (
          <Card>
            <CardContent className="p-4">
              <button
                onClick={() => setMode("choose")}
                className="text-sm text-gray-500 mb-3 hover:text-gray-700"
              >
                ← {isRTL ? "رجوع" : "Back"}
              </button>
              <div
                className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 transition"
                onClick={() => document.getElementById("pdf-upload")?.click()}
              >
                {uploadFile ? (
                  <div className="flex items-center gap-3 justify-center">
                    <Check className="w-5 h-5 text-green-500" />
                    <span className="font-medium">{uploadFile.name}</span>
                    <button onClick={(e) => { e.stopPropagation(); setUploadFile(null); }}>
                      <X className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                    <p className="font-medium">{isRTL ? "اضغط لرفع الملف" : "Tap to upload"}</p>
                    <p className="text-sm text-gray-400">PDF, JPG, PNG</p>
                  </>
                )}
              </div>
              <input
                id="pdf-upload"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              />
            </CardContent>
          </Card>
        )}

        {/* Manual mode */}
        {mode === "manual" && (
          <>
            <button onClick={() => setMode("choose")} className="text-sm text-gray-500 hover:text-gray-700">
              ← {isRTL ? "رجوع" : "Back"}
            </button>

            {/* Selected markers count */}
            {selectedDefs.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span>{selectedDefs.length} {isRTL ? "تحليل مختار" : "markers selected"}</span>
              </div>
            )}

            {/* Category tabs */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    "flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition",
                    activeCategory === cat
                      ? "bg-emerald-600 text-white"
                      : "bg-white text-gray-600 border"
                  )}
                >
                  {categoryIcon(cat)} {language === "ar" ? categoryLabelAr(cat) : categoryLabel(cat)}
                </button>
              ))}
            </div>

            {/* Search */}
            <Input
              placeholder={isRTL ? "ابحث عن تحليل..." : "Search marker..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            {/* Available markers */}
            <div className="grid grid-cols-1 gap-1.5">
              {filteredDefs.map((def) => {
                const isSelected = selectedDefs.find((s) => s.defId === def.id);
                return (
                  <button
                    key={def.id}
                    onClick={() => (isSelected ? removeMarker(def.id) : addMarker(def))}
                    className={cn(
                      "flex items-center gap-3 p-2.5 rounded-lg border transition text-left",
                      isSelected ? "bg-emerald-50 border-emerald-300" : "bg-white border-gray-100"
                    )}
                  >
                    <span className="text-sm font-medium flex-1">
                      {language === "ar" && def.marker_name_ar ? def.marker_name_ar : def.marker_name}
                    </span>
                    <span className="text-xs text-gray-400">{def.unit}</span>
                    {isSelected && <Check className="w-4 h-4 text-emerald-600" />}
                  </button>
                );
              })}
            </div>

            {/* Selected markers values */}
            {selectedDefs.length > 0 && (
              <Card className="border-emerald-200">
                <CardContent className="p-4 space-y-3">
                  <h3 className="font-semibold text-emerald-800 flex items-center gap-2">
                    <FlaskConical className="w-4 h-4" />
                    {isRTL ? "أدخل القيم" : "Enter Values"}
                  </h3>
                  {selectedDefs.map((marker) => (
                    <div key={marker.defId} className="flex items-center gap-2">
                      <span className="text-sm flex-1 truncate">
                        {language === "ar" && marker.marker_name_ar ? marker.marker_name_ar : marker.marker_name}
                      </span>
                      <span className="text-xs text-gray-400 w-16">{marker.unit}</span>
                      <Input
                        type="number"
                        step="any"
                        value={marker.value}
                        onChange={(e) => updateMarkerValue(marker.defId, e.target.value)}
                        placeholder="—"
                        className="w-24 text-center"
                      />
                      <button onClick={() => removeMarker(marker.defId)} className="p-1">
                        <X className="w-3.5 h-3.5 text-gray-400" />
                      </button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Submit */}
        {mode !== "choose" && (
          <Button
            onClick={handleSubmit}
            disabled={submitting || (mode === "manual" && selectedDefs.length === 0)}
            className="w-full py-6 text-base font-semibold"
          >
            {submitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : isRTL ? (
              "حفظ التحليل"
            ) : (
              "Save Blood Work"
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
