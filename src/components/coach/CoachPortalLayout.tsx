import { ReactNode, useEffect, useState } from "react";
import { useNavigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { CoachBottomTabBar } from "@/components/coach/CoachBottomTabBar";
import { Menu, X, LogOut, Users, BarChart3, MessageSquare, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { path: "/coach", label: "Clients", icon: Users },
  { path: "/coach/insights", label: "Insights", icon: BarChart3 },
  { path: "/coach/chat", label: "Chat", icon: MessageSquare },
  { path: "/coach/settings", label: "Settings", icon: Settings },
];

export function CoachPortalLayout() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile();
  const [loading, setLoading] = useState(true);
  const [isCoach, setIsCoach] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (user) {
      checkCoachRole();
    } else {
      setLoading(false);
    }
  }, [user]);

  const checkCoachRole = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "coach")
        .maybeSingle();

      if (!data) {
        navigate("/auth", { replace: true });
        return;
      }
      setIsCoach(true);
    } catch {
      navigate("/auth", { replace: true });
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth", { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFB] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!isCoach) return null;

  const coachName = profile?.full_name?.split(" ")[0] || "Coach";
  const coachInitial = coachName.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-[#F8FAFB] flex flex-col">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-xl border-b border-slate-100 h-14 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <span className="text-sm font-bold text-white">{coachInitial}</span>
          </div>
          <div>
            <h1 className="text-sm font-extrabold text-slate-900 tracking-[-0.02em]">Coach Portal</h1>
            <p className="text-[10px] text-slate-400">{coachName}</p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </header>

      {/* Main content */}
      <main
        className="flex-1 overflow-y-auto"
        style={{
          paddingBottom: "calc(100px + env(safe-area-inset-bottom, 16px))",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div className="max-w-[430px] mx-auto px-4 py-5">
          <Outlet />
        </div>
      </main>

      {/* Bottom tab bar */}
      <CoachBottomTabBar />
    </div>
  );
}

export default CoachPortalLayout;
