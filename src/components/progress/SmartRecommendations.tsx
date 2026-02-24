import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight, Zap, Droplets, Moon, Apple } from "lucide-react";

interface SmartRecommendationsProps {
  recommendations: Array<{
    id: string;
    category: "nutrition" | "hydration" | "activity" | "sleep" | "general";
    priority: "high" | "medium" | "low";
    title: string;
    description: string;
    action_text: string;
    action_link: string | null;
  }>;
  loading: boolean;
}

const categoryIcons: Record<string, typeof Zap> = {
  nutrition: Apple,
  hydration: Droplets,
  activity: Zap,
  sleep: Moon,
  general: Sparkles,
};

const categoryColors: Record<string, { bg: string; text: string }> = {
  nutrition: { bg: "bg-green-100", text: "text-green-600" },
  hydration: { bg: "bg-blue-100", text: "text-blue-600" },
  activity: { bg: "bg-orange-100", text: "text-orange-600" },
  sleep: { bg: "bg-purple-100", text: "text-purple-600" },
  general: { bg: "bg-slate-100", text: "text-slate-600" },
};

const priorityLabels: Record<string, string> = {
  high: "High Priority",
  medium: "Recommended",
  low: "Tip",
};

export function SmartRecommendations({ recommendations, loading }: SmartRecommendationsProps) {
  if (loading) {
    return (
      <Card className="border-0 shadow-lg shadow-slate-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-500" />
            Smart Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="animate-pulse space-y-3">
            <div className="h-20 rounded-lg bg-slate-100" />
            <div className="h-20 rounded-lg bg-slate-100" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-lg shadow-slate-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-500" />
          Smart Recommendations
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {recommendations.length > 0 ? (
          recommendations.slice(0, 4).map((rec) => {
            const Icon = categoryIcons[rec.category] || Sparkles;
            const colors = categoryColors[rec.category] || categoryColors.general;

            return (
              <div
                key={rec.id}
                className="p-3 rounded-lg bg-slate-50 border border-slate-100 hover:border-purple-200 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-full ${colors.bg} ${colors.text} flex items-center justify-center shrink-0`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded ${
                          rec.priority === "high"
                            ? "bg-red-100 text-red-600"
                            : rec.priority === "medium"
                            ? "bg-amber-100 text-amber-600"
                            : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {priorityLabels[rec.priority]}
                      </span>
                    </div>
                    <p className="font-medium text-slate-900 text-sm">{rec.title}</p>
                    <p className="text-xs text-slate-500 mt-1">{rec.description}</p>
                    {rec.action_link && (
                      <Button variant="link" size="sm" className="p-0 h-auto mt-2 text-xs" asChild>
                        <a href={rec.action_link}>
                          {rec.action_text}
                          <ArrowRight className="w-3 h-3 ml-1" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-6 text-slate-400">
            <Sparkles className="w-10 h-10 mx-auto mb-2 text-slate-200" />
            <p className="text-sm">No recommendations yet</p>
            <p className="text-xs mt-1">Keep logging to get personalized insights</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
