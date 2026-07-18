import { useLocation, useNavigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { CoachBottomTabBar } from "@/components/coach/CoachBottomTabBar";
import { LogOut } from "lucide-react";

export function CoachPortalLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();
  const { profile } = useProfile();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };

  const coachName = profile?.full_name?.split(" ")[0] || "Coach";
  const coachInitial = coachName.charAt(0).toUpperCase();
  const isClientWorkspace = location.pathname.startsWith("/coach/client/");

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[#F4F7FA]">
      {/* Mobile top bar */}
      <header className={isClientWorkspace ? "hidden" : "sticky top-0 z-30 bg-white/90 backdrop-blur-xl border-b border-slate-100 h-14 flex items-center justify-between px-4 shrink-0"}>
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
          type="button"
          onClick={handleSignOut}
          aria-label="Sign out"
          className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </header>

      {/* Main content */}
      <main
        className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain"
        style={{
          paddingBottom: isClientWorkspace
            ? "calc(16px + env(safe-area-inset-bottom, 0px))"
            : "calc(100px + env(safe-area-inset-bottom, 16px))",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div className={isClientWorkspace ? "max-w-[430px] mx-auto px-3 py-3" : "max-w-[430px] mx-auto px-4 py-5"}>
          <Outlet />
        </div>
      </main>

      {/* Bottom tab bar */}
      {!isClientWorkspace && <CoachBottomTabBar />}
    </div>
  );
}

export default CoachPortalLayout;
