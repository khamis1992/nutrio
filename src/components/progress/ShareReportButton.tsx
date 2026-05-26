import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Share2, Copy, Check, MessageCircle, Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface ShareReportButtonProps {
  stats: {
    mealsEaten: number;
    streakDays: number;
    consistencyScore: number;
    weekLabel: string;
    overallScore: number;
  };
  className?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "default";
}

export function ShareReportButton({
  stats,
  className,
  variant = "outline",
  size = "sm",
}: ShareReportButtonProps) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);

  const shareText = [
    t("share_nutrio_weekly_report") || "My Nutrio Weekly Report",
    `\n${stats.weekLabel}`,
    `\n${t("share_meals_eaten") || "Meals logged"}: ${stats.mealsEaten}`,
    `${t("share_streak") || "Streak"}: ${stats.streakDays} ${t("share_days") || "days"}`,
    `${t("share_consistency") || "Consistency"}: ${stats.consistencyScore}%`,
    `${t("share_score") || "Score"}: ${stats.overallScore}/100`,
    `\n${t("share_cta") || "Join me on Nutrio! "}`,
  ].join("\n");

  const handleShare = async () => {
    setSharing(true);
    try {
      if (navigator.share) {
        await navigator.share({
          title: t("share_nutrio_weekly_report") || "My Nutrio Weekly Report",
          text: shareText,
        });
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
    const encoded = encodeURIComponent(shareText);
    window.open(
      `https://wa.me/?text=${encoded}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button
        variant={variant}
        size={size === "default" ? "default" : "sm"}
        onClick={handleShare}
        disabled={sharing}
        className="gap-1.5"
      >
        {sharing ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : copied ? (
          <Check className="w-4 h-4 text-emerald-500" />
        ) : (
          <Share2 className="w-4 h-4" />
        )}
        {copied ? (t("share_copied") || "Copied!") : t("share_report") || "Share"}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleWhatsAppShare}
        className="h-9 w-9 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-600"
        title={t("share_whatsapp") || "Share on WhatsApp"}
      >
        <MessageCircle className="w-4 h-4" />
      </Button>
      {!navigator.share && (
        <Button
          variant="ghost"
          size="icon"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(shareText);
              setCopied(true);
              setTimeout(() => setCopied(false), 2500);
            } catch {
              // silently fail
            }
          }}
          className="h-9 w-9 rounded-full"
          title={t("share_copy") || "Copy to clipboard"}
        >
          {copied ? (
            <Check className="w-4 h-4 text-emerald-500" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </Button>
      )}
    </div>
  );
}
