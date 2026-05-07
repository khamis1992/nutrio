import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useGoogleFitWorkouts } from "@/hooks/useGoogleFitWorkouts";
import { Loader2 } from "lucide-react";

export default function GoogleFitCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { checkConnection } = useGoogleFitWorkouts();
  const [status, setStatus] = useState("Processing...");

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get("code");
      const state = searchParams.get("state");
      const error = searchParams.get("error");

      if (error) {
        setStatus(`Error: ${error}`);
        setTimeout(() => navigate("/tracker"), 3000);
        return;
      }

      if (!code) {
        setStatus("No authorization code received");
        setTimeout(() => navigate("/tracker"), 3000);
        return;
      }

      const storedState = sessionStorage.getItem('google_oauth_state');
      if (state && storedState && state !== storedState) {
        setStatus("Security check failed. Please try again.");
        sessionStorage.removeItem('google_oauth_state');
        sessionStorage.removeItem('google_code_verifier');
        setTimeout(() => navigate("/tracker"), 3000);
        return;
      }

      sessionStorage.removeItem('google_oauth_state');

      const codeVerifier = sessionStorage.getItem('google_code_verifier');
      sessionStorage.removeItem('google_code_verifier');

      if (!codeVerifier) {
        setStatus("Security check failed. Please try again.");
        setTimeout(() => navigate("/tracker"), 3000);
        return;
      }

      setStatus("Connecting to Google Fit...");

      try {
        const redirectUri = `${window.location.origin}/auth/google-fit/callback`;

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-fit-token`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              code,
              codeVerifier,
              redirectUri,
              userId: (await import("@/lib/supabaseClient")).supabase.auth.getUser().then(({ data }) => data.user?.id),
            }),
          }
        );

        if (!response.ok) {
          setStatus("Failed to connect. Please try again.");
          setTimeout(() => navigate("/tracker"), 3000);
          return;
        }

        setStatus("Successfully connected to Google Fit!");
        setTimeout(() => navigate("/tracker"), 2000);
      } catch (err) {
        setStatus("An error occurred during connection");
        setTimeout(() => navigate("/tracker"), 3000);
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto mb-4" />
        <p className="text-gray-900 font-medium">{status}</p>
      </div>
    </div>
  );
}