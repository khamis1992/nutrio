import { useState } from "react";
import { Share2, Check, MessageCircle, Copy, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";

interface MealItem {
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  restaurant_name?: string;
}

interface ShareMealCardProps {
  dailyCalories: number;
  calConsumed: number;
  proteinConsumed: number;
  carbsConsumed: number;
  fatConsumed: number;
  dailyStreak: number;
  meals: MealItem[];
}

export function ShareMealCard({
  dailyCalories,
  calConsumed,
  proteinConsumed,
  carbsConsumed,
  fatConsumed,
  dailyStreak,
  meals,
}: ShareMealCardProps) {
  const { user } = useAuth();
  const { profile } = useProfile();
  const userName = profile?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "Someone";
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);

  if (calConsumed === 0 && meals.length === 0) return null;

  const mealList = meals.length > 0
    ? meals.map(m => `· ${m.name} (${m.calories} cal${m.restaurant_name ? `, ${m.restaurant_name}` : ""})`).join("\n")
    : "";

  const shareText = [
    `🍽️ ${userName}'s Nutrio Day`,
    "",
    mealList,
    "",
    `Calories: ${calConsumed} / ${dailyCalories} cal`,
    `Protein: ${proteinConsumed}g`,
    `Carbs: ${carbsConsumed}g`,
    `Fat: ${fatConsumed}g`,
    `Streak: ${dailyStreak} day${dailyStreak !== 1 ? "s" : ""} 🔥`,
    "",
    "Join me on Nutrio for healthy meal delivery!",
  ].filter(Boolean).join("\n");

  const handleShare = async () => {
    setSharing(true);
    try {
      if (navigator.share) {
        await navigator.share({ title: `${userName}'s Nutrio Day`, text: shareText });
      } else {
        await navigator.clipboard.writeText(shareText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch (err) {
      if ((err as DOMException)?.name !== "AbortError") {
        try {
          await navigator.clipboard.writeText(shareText);
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
        } catch {
          // clipboard fallback failed silently
        }
      }
    } finally {
      setSharing(false);
    }
  };

  const handleWhatsAppShare = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={handleShare}
        disabled={sharing}
        className="flex h-[30px] items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-3 text-[11px] font-semibold text-white shadow-[0_4px_8px_rgba(16,185,129,0.2)] transition active:scale-[0.97] disabled:opacity-50"
      >
        {sharing ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : copied ? (
          <Check className="h-3 w-3" />
        ) : (
          <Share2 className="h-3 w-3" />
        )}
        {copied ? "Copied!" : "Share"}
      </button>
      <button
        onClick={handleWhatsAppShare}
        className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-emerald-50 text-emerald-600 transition hover:bg-emerald-100 active:scale-[0.97]"
        title="Share on WhatsApp"
      >
        <MessageCircle className="h-3.5 w-3.5" />
      </button>
      {!navigator.share && (
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(shareText);
              setCopied(true);
              setTimeout(() => setCopied(false), 2500);
            } catch {
              // silently fail
            }
          }}
          className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 active:scale-[0.97]"
          title="Copy to clipboard"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      )}
    </div>
  );
}

export default ShareMealCard;
