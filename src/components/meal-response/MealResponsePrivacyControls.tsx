import { useState } from "react";
import { Download, Loader2, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  deleteMealResponseData,
  exportMealResponseData,
  revokeMealResponseScopes,
} from "@/lib/meal-response-privacy";

interface Props {
  isRTL: boolean;
  onChanged: () => Promise<unknown> | void;
}

export function MealResponsePrivacyControls({ isRTL, onChanged }: Props) {
  const [working, setWorking] = useState<"export" | "glucose" | "delete" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const copy = isRTL ? {
    title: "بياناتك وخصوصيتك",
    body: "يمكنك تنزيل بيانات الاستجابة أو إيقاف تحليل الجلوكوز أو حذف بيانات الاستجابة المشتقة. لا يؤدي الحذف إلى إزالة سجل وجباتك الغذائي.",
    export: "تنزيل نسخة JSON",
    stopGlucose: "إيقاف تحليل الجلوكوز",
    delete: "حذف بيانات الاستجابة",
    confirm: "تأكيد الحذف",
    cancel: "تراجع",
    exported: "تم تجهيز نسخة بياناتك",
    updated: "تم تحديث إعدادات الخصوصية",
    deleted: "حُذفت بيانات الاستجابة مع الاحتفاظ بسجل الوجبات",
    failed: "تعذر تنفيذ الطلب",
  } : {
    title: "Your data and privacy",
    body: "Download your response data, stop glucose analysis, or delete derived response data. Deletion does not remove your nutrition log.",
    export: "Download JSON copy",
    stopGlucose: "Stop glucose analysis",
    delete: "Delete response data",
    confirm: "Confirm deletion",
    cancel: "Cancel",
    exported: "Your data copy is ready",
    updated: "Privacy settings updated",
    deleted: "Response data deleted; nutrition history retained",
    failed: "Request could not be completed",
  };

  const run = async (action: "export" | "glucose" | "delete") => {
    setWorking(action);
    try {
      if (action === "export") {
        const data = await exportMealResponseData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `nutrio-meal-response-${new Date().toISOString().slice(0, 10)}.json`;
        anchor.click();
        URL.revokeObjectURL(url);
        toast.success(copy.exported);
      } else if (action === "glucose") {
        await revokeMealResponseScopes(["glucose_analysis"]);
        toast.success(copy.updated);
        await onChanged();
      } else {
        await deleteMealResponseData();
        setConfirmDelete(false);
        toast.success(copy.deleted);
        await onChanged();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : copy.failed);
    } finally {
      setWorking(null);
    }
  };

  return (
    <section className="rounded-3xl bg-white p-4 ring-1 ring-[#DCE4EE]">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#EFFFFA] text-[#22C7A1]"><ShieldCheck className="h-5 w-5" /></span>
        <div><h2 className="text-[14px] font-black text-[#020617]">{copy.title}</h2><p className="mt-1 text-[10px] font-semibold leading-4 text-[#64748B]">{copy.body}</p></div>
      </div>
      <div className="mt-4 space-y-2">
        <button type="button" disabled={working !== null} onClick={() => void run("export")} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-[#DCE4EE] text-[11px] font-black text-[#020617] disabled:opacity-50">{working === "export" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 text-[#38BDF8]" />}{copy.export}</button>
        <button type="button" disabled={working !== null} onClick={() => void run("glucose")} className="flex min-h-11 w-full items-center justify-center rounded-full bg-[#F6F8FB] px-4 text-[11px] font-black text-[#020617] disabled:opacity-50">{working === "glucose" ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}{copy.stopGlucose}</button>
        {!confirmDelete ? (
          <button type="button" disabled={working !== null} onClick={() => setConfirmDelete(true)} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-[#FFF0F2] px-4 text-[11px] font-black text-[#D94357]"><Trash2 className="h-4 w-4" />{copy.delete}</button>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={working !== null} onClick={() => void run("delete")} className="flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#FB6B7A] px-3 text-[11px] font-black text-white disabled:opacity-50">{working === "delete" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}{copy.confirm}</button>
            <button type="button" disabled={working !== null} onClick={() => setConfirmDelete(false)} className="min-h-11 rounded-full border border-[#DCE4EE] px-3 text-[11px] font-black text-[#020617]">{copy.cancel}</button>
          </div>
        )}
      </div>
    </section>
  );
}
