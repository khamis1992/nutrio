import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════
   Custom inline SVG icons — hand-drawn style with subtle stroke variation
   and accent details. No external icon library dependency.
   ═══════════════════════════════════════════════════════════════════ */

function GoalsIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Outer ring */}
      <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.35" />
      {/* Middle ring */}
      <circle cx="24" cy="24" r="13" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.6" />
      {/* Bullseye */}
      <circle cx="24" cy="24" r="6" fill="currentColor" />
      {/* Arrow shaft */}
      <path
        d="M38 10L26 22"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Arrow head pointing into bullseye */}
      <path
        d="M26 22L29 19M26 22L23 25"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Fletching */}
      <path
        d="M38 10L42 8M38 10L40 14M38 10L36 14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MealPlanIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Plate outer rim */}
      <circle cx="24" cy="26" r="18" stroke="currentColor" strokeWidth="2.5" />
      {/* Plate inner well */}
      <circle cx="24" cy="26" r="13" stroke="currentColor" strokeWidth="2" strokeOpacity="0.4" />
      {/* Fork */}
      <g stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M14 4V14" />
        <path d="M11 4V10" />
        <path d="M17 4V10" />
        <path d="M14 14V26" />
        <path d="M11 10C11 12 12 13 14 13" />
        <path d="M17 10C17 12 16 13 14 13" />
      </g>
      {/* Knife */}
      <g stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M34 4C32 6 31 9 31 13C31 14 32 15 33 15H35C36 15 37 14 37 13C37 9 36 6 34 4Z" />
        <path d="M34 15V26" />
      </g>
      {/* Steam wisps rising from plate */}
      <path
        d="M20 8C20 6.5 21 5.5 21 4M24 8C24 6.5 25 5.5 25 4M28 8C28 6.5 29 5.5 29 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeOpacity="0.5"
      />
    </svg>
  );
}

function WeightIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Scale body — rounded rectangle */}
      <rect
        x="7"
        y="11"
        width="34"
        height="26"
        rx="4"
        stroke="currentColor"
        strokeWidth="2.5"
      />
      {/* Display screen */}
      <rect
        x="14"
        y="16"
        width="20"
        height="10"
        rx="1.5"
        fill="currentColor"
        fillOpacity="0.15"
        stroke="currentColor"
        strokeWidth="2"
      />
      {/* Digits — represented as bars */}
      <g fill="currentColor">
        <rect x="17" y="19" width="5" height="4" rx="0.5" />
        <rect x="23" y="19" width="5" height="4" rx="0.5" />
      </g>
      {/* Unit "kg" */}
      <text
        x="31"
        y="23"
        fontSize="5"
        fontWeight="600"
        fill="currentColor"
        fontFamily="ui-sans-serif, system-ui"
      >
        kg
      </text>
      {/* Foot pads */}
      <rect x="12" y="29" width="6" height="3" rx="0.5" fill="currentColor" fillOpacity="0.4" />
      <rect x="30" y="29" width="6" height="3" rx="0.5" fill="currentColor" fillOpacity="0.4" />
      {/* Base shadow line */}
      <path
        d="M4 39H44"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeOpacity="0.4"
      />
      {/* Trending down arrow (progress) */}
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M38 4L34 8L37 8L37 11" />
      </g>
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Quick action configuration
   ═══════════════════════════════════════════════════════════════════ */

interface QuickAction {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: (props: { className?: string }) => JSX.Element;
  tileBg: string;
  tileText: string;
  accentBar: string;
  accent: string;
}

const actions: QuickAction[] = [
  {
    id: "goals",
    title: "Update Goals",
    description: "Refresh your daily targets when goals change.",
    href: "/personal-info",
    icon: GoalsIcon,
    tileBg: "bg-gradient-to-br from-emerald-400 to-emerald-600",
    tileText: "text-white",
    accentBar: "bg-emerald-500",
    accent: "group-hover:text-emerald-600",
  },
  {
    id: "meal-plan",
    title: "View Meal Plan",
    description: "See your AI-curated weekly menu at a glance.",
    href: "/schedule",
    icon: MealPlanIcon,
    tileBg: "bg-gradient-to-br from-sky-400 to-blue-600",
    tileText: "text-white",
    accentBar: "bg-sky-500",
    accent: "group-hover:text-sky-600",
  },
  {
    id: "weight",
    title: "Log Weight",
    description: "Track weigh-ins to see real progress over time.",
    href: "/weight-tracking",
    icon: WeightIcon,
    tileBg: "bg-gradient-to-br from-amber-400 to-orange-500",
    tileText: "text-white",
    accentBar: "bg-amber-500",
    accent: "group-hover:text-amber-600",
  },
];

/* ═══════════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════════ */

export function QuickActions() {
  const navigate = useNavigate();

  return (
    <div className="mt-8">
      <div className="flex items-end justify-between mb-4 px-1">
        <div>
          <h2 className="text-base font-semibold text-foreground">Quick Actions</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Jump back into the parts of your plan that need attention
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Card
              key={action.id}
              onClick={() => navigate(action.href)}
              className={`group relative cursor-pointer overflow-hidden border-border/60 bg-card p-0 hover:border-border hover:shadow-md transition-all duration-200 text-left`}
              role="button"
              aria-label={`Go to ${action.title}`}
            >
              <div className={`absolute top-0 left-0 h-full w-1 ${action.accentBar}`} />
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div
                      className={`w-12 h-12 rounded-2xl ${action.tileBg} ${action.tileText} flex items-center justify-center shadow-lg shadow-current/10 shrink-0 group-hover:scale-105 transition-transform duration-200`}
                    >
                      <Icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm text-foreground">
                        {action.title}
                      </h3>
                      <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                        {action.description}
                      </p>
                    </div>
                  </div>
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-muted-foreground/60 group-hover:text-foreground ${action.accent} transition-colors`}
                  >
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
