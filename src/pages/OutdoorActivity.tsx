import { useEffect, useMemo, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import {
  ArrowLeft,
  Bike,
  Check,
  ChevronRight,
  CircleStop,
  Clock3,
  FileUp,
  Footprints,
  Gauge,
  LocateFixed,
  Lock,
  MapPin,
  Pause,
  Play,
  Route,
  ShieldCheck,
  Trash2,
  Volume2,
} from "lucide-react";
import { MapContainer, Polyline, TileLayer, useMap } from "react-leaflet";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useOutdoorActivityRecorder } from "@/hooks/useOutdoorActivityRecorder";
import { useProfile } from "@/hooks/useProfile";
import type { OutdoorActivityImport } from "@/lib/outdoor-activity-import";
import { importOutdoorActivity } from "@/lib/outdoor-activity-import";
import { garminFitImportAdapter } from "@/lib/fit-import-adapter";
import { formatDuration, formatPace, type OutdoorActivityType } from "@/lib/outdoor-activity";
import { clearOutdoorCheckpoint } from "@/lib/outdoor-activity-checkpoint";
import { completeRecordedOutdoorActivity, saveImportedOutdoorActivity } from "@/lib/outdoor-activity-service";
import { syncCommunityChallengeProgressQuietly } from "@/lib/community-challenge-service";
import { syncWorkoutSessionsToHealthDailyMetrics } from "@/lib/health-daily-metrics";
import { supportsNativeBackgroundLocation } from "@/services/native/backgroundLocation";

const activityOptions: Array<{
  type: OutdoorActivityType;
  labelKey: string;
  detailKey: string;
  icon: typeof Footprints;
  color: string;
  background: string;
}> = [
  { type: "walking", labelKey: "outdoor_walk", detailKey: "outdoor_walk_detail", icon: Footprints, color: "#13A873", background: "#E7FAF3" },
  { type: "running", labelKey: "outdoor_run", detailKey: "outdoor_run_detail", icon: Gauge, color: "#7C83F6", background: "#F0F0FF" },
  { type: "cycling", labelKey: "outdoor_cycle", detailKey: "outdoor_cycle_detail", icon: Bike, color: "#FF7A1A", background: "#FFF3E8" },
];

function RouteCamera({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 1) map.setView(points[0], 16);
    if (points.length > 1) map.fitBounds(points, { padding: [28, 28], maxZoom: 17 });
  }, [map, points]);
  return null;
}

function RouteMap({ points }: { points: [number, number][] }) {
  const { t } = useLanguage();
  const center: [number, number] = points.at(-1) ?? [25.2854, 51.531];
  return (
    <div className="h-[34vh] min-h-[240px] w-full overflow-hidden bg-[#E9F1F4]">
      <MapContainer center={center} zoom={14} className="h-full w-full" zoomControl={false} attributionControl={false}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
        {points.length > 1 && <Polyline positions={points} pathOptions={{ color: "#0BBF85", weight: 6, opacity: 0.95 }} />}
        <RouteCamera points={points} />
      </MapContainer>
      {points.length === 0 && (
        <div className="pointer-events-none absolute inset-x-0 top-[150px] z-[500] mx-auto flex w-fit items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-xs font-bold text-[#526074] shadow-sm">
          <LocateFixed className="h-4 w-4 text-[#12B981]" /> {t("outdoor_waiting_gps")}
        </div>
      )}
    </div>
  );
}

function PermissionPanel({
  permission,
  onRequest,
}: {
  permission: string;
  onRequest: () => void;
}) {
  const { t } = useLanguage();
  return (
    <section className="mx-4 rounded-[24px] border border-[#E1E8EE] bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.06)]">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#E7FAF3] text-[#0AA975]">
          <MapPin className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[17px] font-extrabold text-[#020617]">{t("outdoor_precise_location")}</p>
          <p className="mt-1 text-sm leading-5 text-[#69778D]">{t("outdoor_precise_location_desc")}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between rounded-[16px] bg-[#F6F8FB] px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-bold text-[#334155]">
          {permission === "granted" ? <ShieldCheck className="h-4 w-4 text-[#0AA975]" /> : <LocateFixed className="h-4 w-4 text-[#38BDF8]" />}
          {permission === "granted" ? t("outdoor_location_ready") : t("outdoor_permission_required")}
        </div>
        {permission !== "granted" && (
          <button onClick={onRequest} className="min-h-11 rounded-full bg-[#020617] px-5 text-sm font-bold text-white">{t("outdoor_allow")}</button>
        )}
      </div>
      <div className="mt-3 flex gap-3 rounded-[16px] border border-[#DCE5EC] px-4 py-3">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[#64748B]" />
        <p className="text-xs leading-5 text-[#64748B]">
          <strong className="text-[#334155]">
            {supportsNativeBackgroundLocation() ? t("outdoor_native_tracking") : t("outdoor_safe_mode")}
          </strong>{" "}
          {supportsNativeBackgroundLocation()
            ? t("outdoor_native_tracking_desc")
            : t("outdoor_safe_mode_desc")}
        </p>
      </div>
    </section>
  );
}

export default function OutdoorActivity() {
  const navigate = useNavigate();
  const { t, isRTL } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { profile } = useProfile();
  const requestedType = searchParams.get("type") as OutdoorActivityType | null;
  const [selectedType, setSelectedType] = useState<OutdoorActivityType>(
    activityOptions.some((option) => option.type === requestedType) ? requestedType! : "walking",
  );
  const [saving, setSaving] = useState(false);
  const [imported, setImported] = useState<OutdoorActivityImport | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const weightKg = profile?.current_weight_kg ?? 70;
  const recorder = useOutdoorActivityRecorder(user?.id ?? "anonymous", selectedType, weightKg);
  const { state, metrics } = recorder;
  const routePoints = useMemo<[number, number][]>(
    () => state.points.map((point) => [point.latitude, point.longitude]),
    [state.points],
  );
  const isActive = state.status === "recording" || state.status === "paused";
  const isReview = state.status === "completed";

  const selectType = (type: OutdoorActivityType) => {
    if (isActive) return;
    setSelectedType(type);
    setSearchParams({ type }, { replace: true });
  };

  const saveRecorded = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const result = await completeRecordedOutdoorActivity(state, weightKg, profile?.age);
      await clearOutdoorCheckpoint(user.id);
      await syncWorkoutSessionsToHealthDailyMetrics(user.id, new Date(state.startedAt!).toISOString().slice(0, 10));
      await syncCommunityChallengeProgressQuietly(user.id);
      toast.success(result.deduplicated ? t("outdoor_already_saved") : t("outdoor_saved"));
      navigate("/log-activity", { replace: true });
    } catch (error) {
      toast.error(t("outdoor_save_failed"), { description: error instanceof Error ? error.message : t("outdoor_try_again") });
    } finally {
      setSaving(false);
    }
  };

  const onImportFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      setImported(await importOutdoorActivity(file, garminFitImportAdapter));
    } catch (error) {
      toast.error(t("outdoor_read_failed"), { description: error instanceof Error ? error.message : t("outdoor_choose_another_file") });
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const confirmImport = async () => {
    if (!user || !imported) return;
    setSaving(true);
    try {
      const result = await saveImportedOutdoorActivity(user.id, imported);
      await syncWorkoutSessionsToHealthDailyMetrics(user.id, imported.startedAt.slice(0, 10));
      await syncCommunityChallengeProgressQuietly(user.id);
      toast.success(result.deduplicated ? t("outdoor_already_imported") : t("outdoor_imported_privately"));
      setImported(null);
      navigate("/log-activity", { replace: true });
    } catch (error) {
      toast.error(t("outdoor_import_failed"), { description: error instanceof Error ? error.message : t("outdoor_try_again") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className="mx-auto min-h-screen w-full max-w-[480px] bg-[#F6F8FB] pb-[calc(112px+env(safe-area-inset-bottom))] text-[#020617]">
      <header className="sticky top-0 z-[700] flex min-h-[68px] items-center justify-between border-b border-[#E6EBF0] bg-white/95 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <button onClick={() => navigate(-1)} className="flex h-11 w-11 items-center justify-center rounded-full border border-[#DEE5EC] bg-white" aria-label={t("back")}>
          <ArrowLeft className={`h-5 w-5 ${isRTL ? "rotate-180" : ""}`} />
        </button>
        <div className="text-center">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#0AA975]">{t("outdoor_activity")}</p>
          <h1 className="text-lg font-black">{t("outdoor_record_movement")}</h1>
        </div>
        <button onClick={() => inputRef.current?.click()} className="flex h-11 w-11 items-center justify-center rounded-full border border-[#DEE5EC] bg-white" aria-label={t("outdoor_import_activity")}>
          <FileUp className="h-5 w-5" />
        </button>
        <input ref={inputRef} type="file" accept=".gpx,.tcx,.fit" hidden onChange={(event) => void onImportFile(event.target.files?.[0])} />
      </header>

      {!isActive && !isReview && (
        <main className="space-y-5 py-5">
          <section className="px-4">
            <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.12em] text-[#8A99AC]">{t("outdoor_choose_activity")}</p>
            <div className="grid grid-cols-3 gap-2">
              {activityOptions.map((option) => {
                const Icon = option.icon;
                const selected = selectedType === option.type;
                return (
                  <button
                    key={option.type}
                    onClick={() => selectType(option.type)}
                    className={`min-h-[118px] rounded-[22px] border p-3 text-start transition ${selected ? "border-[#020617] bg-white shadow-[0_8px_22px_rgba(15,23,42,0.08)]" : "border-[#E1E7ED] bg-white"}`}
                    aria-pressed={selected}
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-full" style={{ color: option.color, background: option.background }}><Icon className="h-5 w-5" /></span>
                    <span className="mt-3 block text-sm font-extrabold">{t(option.labelKey)}</span>
                    <span className="mt-0.5 block text-[10px] leading-4 text-[#8491A4]">{t(option.detailKey)}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <PermissionPanel permission={recorder.permission} onRequest={() => void recorder.requestForegroundPermission()} />

          <section className="mx-4 rounded-[24px] border border-[#E1E8EE] bg-white px-5 py-4">
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm font-extrabold">{t("outdoor_auto_pause")}</p>
                <p className="mt-1 text-xs text-[#8190A4]">{t("outdoor_auto_pause_desc")}</p>
              </div>
              <Switch
                checked={state.autoPauseEnabled}
                onCheckedChange={recorder.setAutoPause}
                aria-label={t("outdoor_auto_pause")}
              />
            </div>
            <div className="my-4 h-px bg-[#ECF0F3]" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F1F5F9]"><Lock className="h-4 w-4" /></div>
                <div><p className="text-sm font-extrabold">{t("outdoor_route_privacy")}</p><p className="text-xs text-[#8190A4]">{t("outdoor_private_default")}</p></div>
              </div>
              <select
                value={state.routeVisibility}
                onChange={(event) => recorder.setPrivacy(event.target.value as "private" | "followers" | "public")}
                className="h-11 rounded-full border border-[#DEE5EC] bg-[#F8FAFC] px-3 text-xs font-bold outline-none"
              >
                <option value="private">{t("outdoor_only_me")}</option>
                <option value="followers">{t("outdoor_followers")}</option>
                <option value="public">{t("outdoor_public")}</option>
              </select>
            </div>
          </section>

          <button onClick={() => inputRef.current?.click()} className="mx-4 flex min-h-14 w-[calc(100%-2rem)] items-center justify-between rounded-[20px] border border-[#DDE5EC] bg-white px-5 text-start">
            <span className="flex items-center gap-3"><FileUp className="h-5 w-5 text-[#7C83F6]" /><span><strong className="block text-sm">{t("outdoor_import_activity")}</strong><small className="text-[#8190A4]">{t("outdoor_import_formats")}</small></span></span>
            <ChevronRight className={`h-5 w-5 text-[#94A3B8] ${isRTL ? "rotate-180" : ""}`} />
          </button>
        </main>
      )}

      {isActive && (
        <main>
          <div className="relative"><RouteMap points={routePoints} /></div>
          {recorder.foregroundOnly && (
            <div className="mx-4 -mt-4 relative z-[600] rounded-[18px] border border-[#FED7AA] bg-[#FFF7ED] px-4 py-3 text-xs leading-5 text-[#9A4B10]">
              {t("outdoor_background_paused")}
            </div>
          )}
          <section className="px-5 pb-5 pt-6">
            <div className="text-center">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#E7FAF3] px-3 py-1.5 text-xs font-extrabold text-[#09875F]">
                <span className={`h-2 w-2 rounded-full ${state.status === "recording" ? "animate-pulse bg-[#12B981]" : "bg-[#F59E0B]"}`} />
                {state.autoPaused ? t("outdoor_status_auto_paused") : state.status === "paused" ? t("outdoor_status_paused") : t("outdoor_status_recording")}
              </div>
              <p className="mt-3 font-mono text-[46px] font-black tracking-[-0.04em]">{formatDuration(metrics.elapsedMs)}</p>
            </div>
            <div className="mt-5 grid grid-cols-3 divide-x divide-[#E7ECF0] rounded-[22px] border border-[#E1E7ED] bg-white py-4">
              <div className="text-center"><p className="text-xl font-black">{metrics.distanceKm.toFixed(2)}</p><p className="mt-1 text-[10px] font-bold uppercase text-[#8A99AC]">{t("outdoor_kilometers")}</p></div>
              <div className="text-center"><p className="text-xl font-black">{formatPace(metrics.paceSecondsPerKm)}</p><p className="mt-1 text-[10px] font-bold uppercase text-[#8A99AC]">{t("outdoor_pace_per_km")}</p></div>
              <div className="text-center"><p className="text-xl font-black">{metrics.calories}</p><p className="mt-1 text-[10px] font-bold uppercase text-[#8A99AC]">{t("outdoor_estimated_kcal")}</p></div>
            </div>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-[#8A99AC]"><Volume2 className="h-3.5 w-3.5" /> {t("outdoor_estimate_note")}</p>
          </section>
        </main>
      )}

      {isReview && (
        <main className="px-4 py-6">
          <div className="rounded-[26px] border border-[#DDE5EC] bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.07)]">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E7FAF3] text-[#0AA975]"><Check className="h-6 w-6" /></div>
            <p className="mt-4 text-xs font-extrabold uppercase tracking-[0.12em] text-[#0AA975]">{t("outdoor_activity_complete")}</p>
            <h2 className="mt-1 text-2xl font-black">{t(`outdoor_${state.activityType}`)}</h2>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <div className="rounded-[18px] bg-[#F6F8FB] p-4"><Clock3 className="h-4 w-4 text-[#7C83F6]" /><p className="mt-3 text-xl font-black">{formatDuration(metrics.elapsedMs)}</p><p className="text-xs text-[#8491A4]">{t("outdoor_moving_time")}</p></div>
              <div className="rounded-[18px] bg-[#F6F8FB] p-4"><Route className="h-4 w-4 text-[#13A873]" /><p className="mt-3 text-xl font-black">{metrics.distanceKm.toFixed(2)} km</p><p className="text-xs text-[#8491A4]">{t("outdoor_gps_distance")}</p></div>
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-[16px] border border-[#DDE5EC] px-4 py-3 text-xs text-[#64748B]"><Lock className="h-4 w-4" /> {t("outdoor_route_visibility")}: <strong className="text-[#020617]">{t(`outdoor_${state.routeVisibility === "private" ? "only_me" : state.routeVisibility}`)}</strong></div>
          </div>
        </main>
      )}

      {(isActive || isReview || (!isActive && !isReview)) && (
        <div className="fixed inset-x-0 bottom-0 z-[800] mx-auto max-w-[480px] border-t border-[#E2E8EE] bg-white/96 px-4 pb-[calc(14px+env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl">
          {!isActive && !isReview && (
            <button onClick={() => void recorder.start()} disabled={recorder.permission === "unsupported"} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-[20px] bg-[#020617] text-base font-extrabold text-white disabled:bg-[#CBD5E1]">
              <Play className="h-5 w-5 fill-current" /> {t(`outdoor_start_${selectedType === "cycling" ? "ride" : selectedType === "running" ? "run" : "walk"}`)}
            </button>
          )}
          {isActive && (
            <div className="grid grid-cols-[1fr_1.5fr] gap-3">
              <button onClick={state.status === "recording" ? recorder.pause : recorder.resume} className="flex min-h-14 items-center justify-center gap-2 rounded-[20px] border border-[#DCE4EA] bg-[#F6F8FB] text-sm font-extrabold">
                {state.status === "recording" ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}{state.status === "recording" ? t("outdoor_pause") : t("outdoor_resume")}
              </button>
              <button onClick={recorder.finish} disabled={state.points.length < 2} className="flex min-h-14 items-center justify-center gap-2 rounded-[20px] bg-[#020617] text-sm font-extrabold text-white disabled:bg-[#CBD5E1]"><CircleStop className="h-5 w-5" /> {t("outdoor_finish")}</button>
            </div>
          )}
          {isReview && (
            <div className="grid grid-cols-[56px_1fr] gap-3">
              <button onClick={() => void recorder.discard().then(() => navigate("/log-activity"))} className="flex min-h-14 items-center justify-center rounded-[20px] border border-[#FFD5D9] bg-[#FFF1F3] text-[#E23D55]" aria-label={t("outdoor_discard")}><Trash2 className="h-5 w-5" /></button>
              <button onClick={() => void saveRecorded()} disabled={saving} className="min-h-14 rounded-[20px] bg-[#020617] text-sm font-extrabold text-white disabled:opacity-60">{saving ? t("outdoor_saving") : t("outdoor_save_activity")}</button>
            </div>
          )}
        </div>
      )}

      {recorder.recovery && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="outdoor-recovery-title"
          className="fixed inset-0 z-[1000] flex items-end bg-[#020617]/45 px-3 pb-[calc(88px+env(safe-area-inset-bottom))] pt-3 backdrop-blur-sm"
        >
          <div className="mx-auto max-h-[calc(100dvh-112px-env(safe-area-inset-bottom))] w-full max-w-[456px] overflow-y-auto rounded-[28px] bg-white p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#E7FAF3] text-[#0AA975]"><Route className="h-5 w-5" /></div>
            <h2 id="outdoor-recovery-title" className="mt-4 text-xl font-black">{t("outdoor_continue_activity")}</h2>
            <p className="mt-2 text-sm leading-5 text-[#6D7A8F]">{t("outdoor_recovery_desc", { activity: t(`outdoor_${recorder.recovery.activityType}`), distance: (recorder.recovery.distanceM / 1000).toFixed(2) })}</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button onClick={() => void recorder.dismissRecovery()} className="min-h-12 rounded-[18px] border border-[#DCE4EA] font-bold">{t("outdoor_discard")}</button>
              <button onClick={recorder.restore} className="min-h-12 rounded-[18px] bg-[#020617] font-bold text-white">{t("outdoor_recover")}</button>
            </div>
          </div>
        </div>
      )}

      {imported && (
        <div className="fixed inset-0 z-[1000] flex items-end bg-[#020617]/45 p-3 backdrop-blur-sm">
          <div className="mx-auto w-full max-w-[456px] rounded-[28px] bg-white p-5 pb-[calc(20px+env(safe-area-inset-bottom))]">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F0F0FF] text-[#7C83F6]"><FileUp className="h-5 w-5" /></div>
            <p className="mt-4 text-xs font-extrabold uppercase tracking-[0.12em] text-[#7C83F6]">{t("outdoor_file_ready", { format: imported.format })}</p>
            <h2 className="mt-1 text-xl font-black">{t("outdoor_import_title", { activity: t(`outdoor_${imported.activityType}`) })}</h2>
            <div className="mt-4 grid grid-cols-3 divide-x rounded-[18px] bg-[#F6F8FB] py-4 text-center">
              <div><strong className="block">{(imported.distanceM / 1000).toFixed(2)}</strong><small className="text-[#8491A4]">km</small></div>
              <div><strong className="block">{formatDuration(imported.durationSeconds * 1000)}</strong><small className="text-[#8491A4]">time</small></div>
              <div><strong className="block">{imported.calories ?? "--"}</strong><small className="text-[#8491A4]">kcal</small></div>
            </div>
            <p className="mt-3 flex items-center gap-2 text-xs text-[#64748B]"><Lock className="h-4 w-4" /> {t("outdoor_import_private")}</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button onClick={() => setImported(null)} className="min-h-12 rounded-[18px] border border-[#DCE4EA] font-bold">{t("cancel")}</button>
              <button onClick={() => void confirmImport()} disabled={saving} className="min-h-12 rounded-[18px] bg-[#020617] font-bold text-white">{saving ? t("outdoor_importing") : t("outdoor_import")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
