import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { OnboardingCarousel } from "@/components/auth/OnboardingCarousel";

const SEEN_KEY = "nutrio_onboarding_seen";

/**
 * Pre-auth marketing onboarding carousel.
 * Route: /welcome  (separate from /auth login/signup and /onboarding post-signup).
 */
export default function WelcomeOnboarding() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    document.title = "Welcome — Nutrio";
  }, []);

  // Returning visitors who already finished the carousel go to auth.
  useEffect(() => {
    if (searchParams.get("source") === "sporthub") return;
    if (searchParams.get("force") === "1") return;
    if (!localStorage.getItem(SEEN_KEY)) return;
    const qs = searchParams.toString();
    navigate(qs ? `/auth?${qs}` : "/auth", { replace: true });
  }, [navigate, searchParams]);

  // SportHub / partner deep-links skip carousel and go straight to auth signup.
  useEffect(() => {
    if (searchParams.get("source") !== "sporthub") return;

    const payload = {
      source: "sporthub",
      campaign: searchParams.get("campaign") || "sporthub_partner",
      code: searchParams.get("code") || "SPORTHUB15",
      visited_at: new Date().toISOString(),
    };
    localStorage.setItem(SEEN_KEY, "true");
    localStorage.setItem("nutrio:partner-referral", JSON.stringify(payload));

    const next = new URLSearchParams(searchParams);
    navigate(`/auth?${next.toString()}`, { replace: true });
  }, [navigate, searchParams]);

  const finish = (path: string) => {
    localStorage.setItem(SEEN_KEY, "true");
    navigate(path, { replace: true });
  };

  const skipCarousel =
    searchParams.get("source") === "sporthub" ||
    (searchParams.get("force") !== "1" && Boolean(localStorage.getItem(SEEN_KEY)));

  if (skipCarousel) {
    return null;
  }

  return <OnboardingCarousel onFinish={() => finish("/auth")} />;
}
