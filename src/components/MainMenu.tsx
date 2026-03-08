import { Link } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu as MenuIcon, Crown } from "lucide-react";
import { NavChevronRight } from "@/components/ui/nav-chevron";
import { Badge } from "@/components/ui/badge";
import { useFavoriteRestaurants } from "@/hooks/useFavoriteRestaurants";
import { useSubscription } from "@/hooks/useSubscription";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import { useLanguage } from "@/contexts/LanguageContext";

interface MenuSection {
  title: string;
  items: MenuItem[];
}

interface MenuItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  to: string;
  badge?: string;
  badgeVariant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning";
  condition?: boolean;
}

export function MainMenu() {
  const { favoriteIds } = useFavoriteRestaurants();
  const { hasActiveSubscription, isVip } = useSubscription();
  const { settings: platformSettings } = usePlatformSettings();
  const { t } = useLanguage();

  const menuSections: MenuSection[] = [
    {
      title: t("food_and_meals"),
      items: [
        {
          icon: ({ className }) => (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          ),
          label: t("favorites"),
          description: `${favoriteIds.size} ${t("saved_restaurants")}`,
          to: "/favorites",
        },
        ...(platformSettings.features.meal_scheduling ? [{
          icon: ({ className }) => (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          ),
          label: t("schedule"),
          description: t("plan_weekly_meals"),
          to: "/schedule",
        }] : []),
        {
          icon: ({ className }) => (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 3h18v18H3zM9 9h6M9 15h6M9 12h6" />
            </svg>
          ),
          label: t("restaurants"),
          description: t("browse_all_restaurants"),
          to: "/meals",
        },
      ],
    },
    {
      title: t("progress_and_goals"),
      items: [
        {
          icon: ({ className }) => (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="20" x2="12" y2="10" />
              <line x1="18" y1="20" x2="18" y2="4" />
              <line x1="6" y1="20" x2="6" y2="16" />
            </svg>
          ),
          label: t("progress"),
          description: t("track_weight_nutrition"),
          to: "/progress",
          badge: t("updated"),
          badgeVariant: "success" as const,
        },
      ],
    },
    {
      title: t("orders_and_subscription"),
      items: [
        {
          icon: ({ className }) => <Crown className={className} />,
          label: t("subscription"),
          description: hasActiveSubscription ? t("manage_your_plan") : t("upgrade_your_plan"),
          to: "/subscription",
          ...(isVip ? {
            badge: "VIP",
            badgeVariant: "secondary" as const,
          } : {}),
        },
      ],
    },
    {
      title: t("settings_and_account"),
      items: [
        {
          icon: ({ className }) => (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          ),
          label: t("profile"),
          description: t("personal_info_preferences"),
          to: "/profile",
        },
        {
          icon: ({ className }) => (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v6m0 6v6" />
              <path d="m4.93 4.93 4.24 4.24m5.66 5.66 4.24 4.24M1 12h6m6 0h6M4.93 19.07l4.24-4.24m5.66-5.66 4.24-4.24" />
            </svg>
          ),
          label: t("settings"),
          description: t("app_preferences"),
          to: "/settings",
        },
        {
          icon: ({ className }) => (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          ),
          label: t("addresses"),
          description: t("delivery_locations"),
          to: "/addresses",
        },
      ],
    },
    ...(platformSettings.features.referral_program ? [{
      title: t("earn_rewards"),
      items: [
        {
          icon: ({ className }) => (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          ),
          label: t("affiliate"),
          description: t("earn_with_audience"),
          to: "/affiliate",
        },
      ],
    }] : []),
  ];

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="gradient" size="lg" className="gap-2 shadow-glow">
          <MenuIcon className="w-5 h-5" />
          <span className="hidden sm:inline">{t("menu")}</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[80vh] sm:max-w-lg mx-auto rounded-t-3xl safe-bottom-nav">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-center text-2xl font-bold">{t("menu")}</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 overflow-y-auto pb-8">
          {menuSections.map((section, sectionIndex) => (
            <div key={sectionIndex} className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-2">
                {section.title}
              </h3>
              <div className="space-y-2">
                {section.items.map((item, itemIndex) => (
                  <Link key={itemIndex} to={item.to}>
                    <Button
                      variant="ghost"
                      className="w-full justify-between h-auto py-4 px-4 hover:bg-accent/50"
                    >
                      <div className="flex items-center gap-4 rtl:flex-row-reverse w-full">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <item.icon className="w-6 h-6 text-primary" />
                        </div>
                        <div className="text-start flex-1">
                          <div className="flex items-center gap-2 rtl:flex-row-reverse">
                            <span className="font-semibold">{item.label}</span>
                            {item.badge && (
                              <Badge variant={item.badgeVariant || "default"} className="text-xs">
                                {item.badge}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{item.description}</p>
                        </div>
                        <NavChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                      </div>
                    </Button>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
