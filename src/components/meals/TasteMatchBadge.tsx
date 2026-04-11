import { useLanguage } from "@/contexts/LanguageContext";

interface TasteMatchBadgeProps {
  score: number;
}

export function TasteMatchBadge({ score }: TasteMatchBadgeProps) {
  const { language } = useLanguage();

  let bgColor: string;
  let textColor: string;

  if (score >= 80) {
    bgColor = "bg-emerald-100";
    textColor = "text-emerald-700";
  } else if (score >= 50) {
    bgColor = "bg-amber-100";
    textColor = "text-amber-700";
  } else {
    bgColor = "bg-gray-100";
    textColor = "text-gray-500";
  }

  return (
    <span
      className={`absolute top-2 left-2 ${bgColor} ${textColor} text-[10px] font-bold px-2 py-0.5 rounded-full`}
      title={language === "ar"
        ? `تطابق ${score}% مع ذوقك`
        : `${score}% match with your taste`}
    >
      {score}%
    </span>
  );
}
