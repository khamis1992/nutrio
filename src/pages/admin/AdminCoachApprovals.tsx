import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Check, X, Loader2, Users, AlertCircle } from "lucide-react";
import { AdminLayout } from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Application {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  bio: string;
  specialties: string[];
  qualifications: string | null;
  status: string;
  created_at: string;
}

const C = {
  text: "#020617",
  muted: "#94A3B8",
  surface: "#F6F8FB",
  water: "#38BDF8",
  danger: "#FB6B7A",
  protein: "#7C83F6",
  progress: "#22C7A1",
};

export default function AdminCoachApprovals() {
  const { toast } = useToast();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const { data: apps } = await supabase
        .from("coach_applications")
        .select("*")
        .order("created_at", { ascending: false });

      if (!apps?.length) {
        setApplications([]);
        setLoading(false);
        return;
      }

      const userIds = [...new Set(apps.map((a) => a.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);

      // Get emails via auth admin (may fail without admin rights, fallback gracefully)
      const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));

      setApplications(
        apps.map((a) => ({
          id: a.id,
          user_id: a.user_id,
          full_name: profileMap.get(a.user_id)?.full_name || "Unknown",
          email: null,
          bio: a.bio || "",
          specialties: a.specialties || [],
          qualifications: a.qualifications,
          status: a.status,
          created_at: a.created_at,
        }))
      );
    } catch (err) {
      console.error("Error fetching coach applications:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  const handleApprove = async (app: Application) => {
    setProcessingId(app.id);
    try {
      // Update application status
      await supabase
        .from("coach_applications")
        .update({ status: "approved", reviewed_by: (await supabase.auth.getUser()).data.user?.id })
        .eq("id", app.id);

      // Add coach role
      await supabase.from("user_roles").insert({
        user_id: app.user_id,
        role: "coach",
      });

      // Copy bio and specialties to profile
      await supabase
        .from("profiles")
        .update({
          bio: app.bio,
          specialties: app.specialties,
        })
        .eq("user_id", app.user_id);

      toast({ title: "Approved!", description: `${app.full_name} is now a coach.` });
      setApplications((prev) => prev.map((a) => (a.id === app.id ? { ...a, status: "approved" } : a)));
    } catch (err) {
      toast({
        title: "Failed",
        description: err instanceof Error ? err.message : "Could not approve. Try again.",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (app: Application) => {
    setProcessingId(app.id);
    try {
      await supabase
        .from("coach_applications")
        .update({ status: "rejected", reviewed_by: (await supabase.auth.getUser()).data.user?.id })
        .eq("id", app.id);

      toast({ title: "Rejected", description: `${app.full_name}'s application was declined.` });
      setApplications((prev) => prev.map((a) => (a.id === app.id ? { ...a, status: "rejected" } : a)));
    } catch (err) {
      toast({
        title: "Failed",
        description: err instanceof Error ? err.message : "Could not reject. Try again.",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const pending = applications.filter((a) => a.status === "pending");
  const processed = applications.filter((a) => a.status !== "pending");

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex h-96 items-center justify-center bg-[#F6F8FB]">
          <Loader2 className="h-8 w-8 animate-spin text-[#22C7A1]" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6 bg-[#F6F8FB] p-1 text-[#020617]">
        <div className="overflow-hidden rounded-3xl bg-white shadow-[0_18px_44px_rgba(2,6,23,0.06)] ring-1 ring-slate-100">
          <div className="flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-[0_14px_28px_rgba(34,199,161,0.22)]" style={{ backgroundColor: C.progress }}>
                <Users className="h-7 w-7" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: C.progress }}>
                  Coach control
                </p>
                <h1 className="mt-1 text-3xl font-black tracking-tight" style={{ color: C.text }}>
                  Coach Applications
                </h1>
                <p className="mt-2 max-w-2xl text-sm font-medium leading-6" style={{ color: C.muted }}>
                  Review applicant profiles, specialties, qualifications, and approve qualified coaches.
                </p>
              </div>
            </div>
            <div className="rounded-2xl bg-[#F6F8FB] px-4 py-3">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">Pending review</p>
              <p className="mt-1 text-2xl font-black text-[#020617]">{pending.length}</p>
            </div>
          </div>
          <div className="grid border-t border-slate-100 bg-[#F6F8FB]/70 px-6 py-4 text-sm font-semibold sm:grid-cols-3">
            <span style={{ color: C.muted }}>Total applications: <strong className="text-[#020617]">{applications.length}</strong></span>
            <span style={{ color: C.muted }}>Approved: <strong className="text-[#020617]">{applications.filter((app) => app.status === "approved").length}</strong></span>
            <span style={{ color: C.muted }}>Rejected: <strong className="text-[#020617]">{applications.filter((app) => app.status === "rejected").length}</strong></span>
          </div>
        </div>

      {applications.length === 0 ? (
        <div className="rounded-3xl border-0 bg-white p-12 text-center shadow-[0_18px_44px_rgba(2,6,23,0.06)] ring-1 ring-slate-100">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#7C83F6]/10">
            <Users className="h-8 w-8 text-[#7C83F6]" />
          </div>
          <h3 className="mb-2 text-lg font-black text-[#020617]">No applications</h3>
          <p className="text-sm font-medium text-[#94A3B8]">Coach applications will appear here for review.</p>
        </div>
      ) : (
        <>
          {/* Pending */}
          {pending.length > 0 && (
            <div className="rounded-3xl bg-white p-5 shadow-[0_18px_44px_rgba(2,6,23,0.06)] ring-1 ring-slate-100">
              <div className="mb-4 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-[#FB6B7A]" />
                <h2 className="text-sm font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                  Pending ({pending.length})
                </h2>
              </div>
              <div className="space-y-3">
              {pending.map((app) => (
                <motion.div
                  key={app.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4 rounded-3xl bg-[#F6F8FB] p-5 ring-1 ring-slate-100"
                >
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                      <h3 className="text-lg font-black text-[#020617]">{app.full_name}</h3>
                      <p className="text-xs font-semibold text-[#94A3B8]">
                        Applied {new Date(app.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleApprove(app)}
                        disabled={processingId === app.id}
                        className="flex h-10 items-center gap-1 rounded-xl bg-[#22C7A1] px-4 text-xs font-black text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                      >
                        {processingId === app.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(app)}
                        disabled={processingId === app.id}
                        className="flex h-10 items-center gap-1 rounded-xl border border-[#FB6B7A]/20 bg-white px-4 text-xs font-black text-[#FB6B7A] transition-colors hover:bg-[#FB6B7A]/10 disabled:opacity-50"
                      >
                        <X className="h-3.5 w-3.5" />
                        Reject
                      </button>
                    </div>
                  </div>
                  <p className="rounded-2xl bg-white p-4 text-sm font-medium leading-6 text-[#020617]">{app.bio}</p>
                  {app.specialties.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {app.specialties.map((s) => (
                        <span key={s} className="rounded-full bg-[#7C83F6]/10 px-2.5 py-1 text-[10px] font-black text-[#7C83F6]">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                  {app.qualifications && (
                    <p className="rounded-2xl bg-white px-4 py-3 text-xs font-semibold italic text-[#94A3B8]">{app.qualifications}</p>
                  )}
                </motion.div>
              ))}
              </div>
            </div>
          )}

          {/* Processed */}
          {processed.length > 0 && (
            <div className="rounded-3xl bg-white p-5 shadow-[0_18px_44px_rgba(2,6,23,0.06)] ring-1 ring-slate-100">
              <h2 className="mb-4 text-sm font-black uppercase tracking-[0.14em] text-[#94A3B8]">Processed</h2>
              <div className="space-y-2">
              {processed.map((app) => (
                <div
                  key={app.id}
                  className="flex items-center justify-between rounded-2xl bg-[#F6F8FB] p-4"
                >
                  <div>
                    <h3 className="text-sm font-black text-[#020617]">{app.full_name}</h3>
                    <p className="text-xs font-medium text-[#94A3B8]">
                      {new Date(app.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-[10px] font-black ${
                    app.status === "approved" ? "bg-[#22C7A1]/10 text-[#22C7A1]" : "bg-[#FB6B7A]/10 text-[#FB6B7A]"
                  }`}>
                    {app.status}
                  </span>
                </div>
              ))}
              </div>
            </div>
          )}
        </>
      )}
      </div>
    </AdminLayout>
  );
}
