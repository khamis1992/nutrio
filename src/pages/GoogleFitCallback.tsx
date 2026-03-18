import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useGoogleFitWorkouts } from "@/hooks/useGoogleFitWorkouts";
import { Loader2 } from "lucide-react";

export default function GoogleFitCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { exchangeCode } = useGoogleFitWorkouts();
  const [status, setStatus] = useState("Processing...");

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get("code");
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

      setStatus("Connecting to Google Fit...");

      try {
        const clientId = import.meta.env.VITE_GOOGLE_FIT_CLIENT_ID;
        const clientSecret = import.meta.env.VITE_GOOGLE_FIT_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
          setStatus("Error: Google Fit credentials not configured");
          setTimeout(() => navigate("/tracker"), 3000);
          return;
        }

        const success = await exchangeCode(code, clientId, clientSecret);

        if (success) {
          setStatus("Successfully connected to Google Fit!");
          setTimeout(() => navigate("/tracker"), 2000);
        } else {
          setStatus("Failed to connect. Please try again.");
          setTimeout(() => navigate("/tracker"), 3000);
        }
      } catch (err) {
        setStatus("An error occurred during connection");
        setTimeout(() => navigate("/tracker"), 3000);
      }
    };

    handleCallback();
  }, [searchParams, navigate, exchangeCode]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto mb-4" />
        <p className="text-gray-900 font-medium">{status}</p>
      </div>
    </div>
  );
}