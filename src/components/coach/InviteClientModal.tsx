import { useState } from "react";
import { motion } from "framer-motion";
import { X, Copy, Loader2, Check } from "lucide-react";
import {
  createCareInvite,
  type CareAssignmentType,
  type CareConsentScope,
} from "@/hooks/useCareTeam";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface InviteClientModalProps {
  coachId: string;
  open: boolean;
  onClose: () => void;
  onInviteCreated: () => void;
}

export function InviteClientModal({ coachId, open, onClose, onInviteCreated }: InviteClientModalProps) {
  const [clientIdentifier, setClientIdentifier] = useState("");
  const [generating, setGenerating] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assignmentType, setAssignmentType] = useState<CareAssignmentType>("nutrition_guidance");
  const [consentScopes, setConsentScopes] = useState<CareConsentScope[]>(["macros", "hydration", "meal_adherence", "messages"]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientIdentifier.trim()) return;
    setError(null);
    setGenerating(true);

    try {
      void coachId;
      const result = await createCareInvite({
        assignmentType,
        consentScopes,
        clientLabel: clientIdentifier.trim(),
      });
      setInviteCode(result.invite_code);
      onInviteCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate invite");
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!inviteCode) return;
    await navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setClientIdentifier("");
    setInviteCode(null);
    setCopied(false);
    setError(null);
    setAssignmentType("nutrition_guidance");
    setConsentScopes(["macros", "hydration", "meal_adherence", "messages"]);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/40"
        onClick={handleClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        className="relative z-10 w-full max-w-[400px] mx-4 bg-white rounded-3xl shadow-xl border border-gray-100"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h2 className="text-lg font-extrabold text-gray-900">
            {inviteCode ? "Share Invite Code" : "Invite Client"}
          </h2>
          <button
            onClick={handleClose}
            className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {inviteCode ? (
          <div className="px-6 pb-6 space-y-4">
            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-5 space-y-3">
              <p className="text-sm font-semibold text-emerald-800">
                Share this code with your client
              </p>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-white rounded-xl border border-emerald-200 px-4 py-3">
                  <span className="text-2xl font-extrabold tracking-widest text-emerald-700">
                    {inviteCode}
                  </span>
                </div>
                <motion.button
                  whileTap={{ scale: 0.94 }}
                  onClick={handleCopy}
                  className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20 hover:bg-emerald-700 transition-colors"
                >
                  {copied ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <Copy className="w-5 h-5" />
                  )}
                </motion.button>
              </div>
              <p className="text-xs text-emerald-600">
                Your client can enter this code in their Profile → Connect with Coach.
              </p>
            </div>
            <button
              onClick={handleClose}
              className="w-full py-2.5 rounded-xl bg-gray-100 text-sm font-bold text-gray-600 hover:bg-gray-200 transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleGenerate} className="px-6 pb-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="client-identifier" className="text-sm font-semibold text-gray-700">
                Client name or email
              </Label>
              <Input
                id="client-identifier"
                placeholder="e.g. Sarah or sarah@email.com"
                value={clientIdentifier}
                onChange={(e) => setClientIdentifier(e.target.value)}
                className="h-11 rounded-xl"
                autoFocus
              />
              <p className="text-[11px] text-gray-400">
                This helps you identify who the invite is for. It won't be shared.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="assignment-type" className="text-sm font-semibold text-[#020617]">
                Support type
              </Label>
              <select
                id="assignment-type"
                value={assignmentType}
                onChange={(event) => setAssignmentType(event.target.value as CareAssignmentType)}
                className="h-11 w-full rounded-xl border border-[#E2E8F0] bg-[#F6F8FB] px-3 text-sm font-semibold text-[#020617]"
              >
                <option value="nutrition_guidance">Nutrition guidance</option>
                <option value="fitness_coaching">Fitness coaching</option>
                <option value="integrated_care">Integrated support</option>
              </select>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold text-[#020617]">Client consent</legend>
              <div className="grid grid-cols-2 gap-2">
                {(["macros", "weight", "hydration", "meal_adherence", "workouts", "messages"] as CareConsentScope[]).map((scope) => {
                  const checked = consentScopes.includes(scope);
                  return (
                    <label key={scope} className="flex min-h-11 items-center gap-2 rounded-xl border border-[#E2E8F0] bg-[#F6F8FB] px-3 text-xs font-semibold text-[#020617]">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setConsentScopes((current) => checked ? current.filter((item) => item !== scope) : [...current, scope])}
                        className="accent-[#22C7A1]"
                      />
                      {scope.replace("_", " ")}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {error && (
              <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3 font-medium">{error}</p>
            )}

            <button
              type="submit"
              disabled={generating || !clientIdentifier.trim() || consentScopes.length === 0}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-bold shadow-lg shadow-emerald-600/20 hover:shadow-xl hover:shadow-emerald-600/30 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating ? (
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              ) : (
                "Generate Invite Code"
              )}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
