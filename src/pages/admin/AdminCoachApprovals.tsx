import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Check, X, Loader2, Users, AlertCircle } from "lucide-react";
import { AdminLayout } from "@/components/AdminLayout";
import {
  AdminEmptyState,
  AdminPanel,
  AdminWorkbenchHeader,
} from "@/components/admin/AdminPrimitives";
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
        })),
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
        .update({
          status: "approved",
          reviewed_by: (await supabase.auth.getUser()).data.user?.id,
        })
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

      toast({
        title: "Approved!",
        description: `${app.full_name} is now a coach.`,
      });
      setApplications((prev) =>
        prev.map((a) => (a.id === app.id ? { ...a, status: "approved" } : a)),
      );
    } catch (err) {
      toast({
        title: "Failed",
        description:
          err instanceof Error ? err.message : "Could not approve. Try again.",
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
        .update({
          status: "rejected",
          reviewed_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .eq("id", app.id);

      toast({
        title: "Rejected",
        description: `${app.full_name}'s application was declined.`,
      });
      setApplications((prev) =>
        prev.map((a) => (a.id === app.id ? { ...a, status: "rejected" } : a)),
      );
    } catch (err) {
      toast({
        title: "Failed",
        description:
          err instanceof Error ? err.message : "Could not reject. Try again.",
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
      <AdminLayout
        title="Coach Applications"
        subtitle="Review coach applicants and approve qualified profiles"
      >
        <div className="flex h-96 items-center justify-center bg-[#F6F8FB]">
          <Loader2 className="h-8 w-8 animate-spin text-[#22C7A1]" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Coach Applications"
      subtitle={`${pending.length} pending review`}
    >
      <div className="space-y-6 bg-[#F6F8FB] p-1 text-[#020617]">
        <AdminWorkbenchHeader
          eyebrow="Coach control"
          title="Coach application review"
          icon={Users}
          accent="#22C7A1"
          description="Review applicant profiles, specialties, qualifications, and approve qualified coaches for the coaching marketplace."
          meta={[
            { label: "Pending review", value: pending.length },
            { label: "Total applications", value: applications.length },
            {
              label: "Approved",
              value: applications.filter((app) => app.status === "approved")
                .length,
            },
          ]}
        />

        {applications.length === 0 ? (
          <AdminEmptyState
            icon={Users}
            title="No applications"
            description="Coach applications will appear here for review."
          />
        ) : (
          <>
            {/* Pending */}
            {pending.length > 0 && (
              <AdminPanel className="p-5">
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
                      className="space-y-4 rounded-[26px] bg-[#F6F8FB] p-5 shadow-[0_10px_26px_rgba(2,6,23,0.035)] ring-1 ring-[#E5EAF1] transition hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_16px_38px_rgba(2,6,23,0.065)]"
                    >
                      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                        <div>
                          <h3 className="text-lg font-black text-[#020617]">
                            {app.full_name}
                          </h3>
                          <p className="text-xs font-semibold text-[#94A3B8]">
                            Applied{" "}
                            {new Date(app.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleApprove(app)}
                            disabled={processingId === app.id}
                            className="flex min-h-11 items-center gap-1 rounded-full border border-[#22C7A1]/30 bg-[#22C7A1]/10 px-4 text-xs font-black text-[#020617] transition-opacity hover:bg-[#22C7A1]/15 disabled:opacity-50"
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
                            className="flex min-h-11 items-center gap-1 rounded-full border border-[#FB6B7A]/20 bg-white px-4 text-xs font-black text-[#FB6B7A] transition-colors hover:bg-[#FB6B7A]/10 disabled:opacity-50"
                          >
                            <X className="h-3.5 w-3.5" />
                            Reject
                          </button>
                        </div>
                      </div>
                      <p className="rounded-2xl bg-white p-4 text-sm font-medium leading-6 text-[#020617]">
                        {app.bio}
                      </p>
                      {app.specialties.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {app.specialties.map((s) => (
                            <span
                              key={s}
                              className="rounded-full bg-[#7C83F6]/10 px-2.5 py-1 text-[10px] font-black text-[#7C83F6]"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                      {app.qualifications && (
                        <p className="rounded-2xl bg-white px-4 py-3 text-xs font-semibold italic text-[#94A3B8]">
                          {app.qualifications}
                        </p>
                      )}
                    </motion.div>
                  ))}
                </div>
              </AdminPanel>
            )}

            {/* Processed */}
            {processed.length > 0 && (
              <AdminPanel className="p-5">
                <h2 className="mb-4 text-sm font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                  Processed
                </h2>
                <div className="space-y-2">
                  {processed.map((app) => (
                    <div
                      key={app.id}
                      className="flex flex-col gap-3 rounded-[22px] bg-[#F6F8FB] p-4 ring-1 ring-[#E5EAF1] sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <h3 className="text-sm font-black text-[#020617]">
                          {app.full_name}
                        </h3>
                        <p className="text-xs font-medium text-[#94A3B8]">
                          {new Date(app.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-[10px] font-black ${
                          app.status === "approved"
                            ? "bg-[#22C7A1]/10 text-[#22C7A1]"
                            : "bg-[#FB6B7A]/10 text-[#FB6B7A]"
                        }`}
                      >
                        {app.status}
                      </span>
                    </div>
                  ))}
                </div>
              </AdminPanel>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}
