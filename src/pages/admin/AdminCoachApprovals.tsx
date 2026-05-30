import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Check, X, Loader2, Users, AlertCircle } from "lucide-react";
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
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900">Coach Applications</h1>
        <p className="text-sm text-gray-500 mt-1">
          Review and approve coach applications
        </p>
      </div>

      {applications.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-violet-500" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">No applications</h3>
          <p className="text-sm text-gray-500">Coach applications will appear here for review.</p>
        </div>
      ) : (
        <>
          {/* Pending */}
          {pending.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                <h2 className="text-sm font-extrabold text-gray-700">
                  Pending ({pending.length})
                </h2>
              </div>
              {pending.map((app) => (
                <motion.div
                  key={app.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">{app.full_name}</h3>
                      <p className="text-[11px] text-gray-400">
                        Applied {new Date(app.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleApprove(app)}
                        disabled={processingId === app.id}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50"
                      >
                        {processingId === app.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(app)}
                        disabled={processingId === app.id}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
                      >
                        <X className="w-3.5 h-3.5" />
                        Reject
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 bg-gray-50 rounded-xl p-3">{app.bio}</p>
                  {app.specialties.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {app.specialties.map((s) => (
                        <span key={s} className="px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 text-[10px] font-semibold">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                  {app.qualifications && (
                    <p className="text-[11px] text-gray-500 italic">{app.qualifications}</p>
                  )}
                </motion.div>
              ))}
            </div>
          )}

          {/* Processed */}
          {processed.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-extrabold text-gray-700">Processed</h2>
              {processed.map((app) => (
                <div
                  key={app.id}
                  className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between opacity-60"
                >
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">{app.full_name}</h3>
                    <p className="text-[11px] text-gray-400">
                      {new Date(app.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${
                    app.status === "approved" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                  }`}>
                    {app.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
