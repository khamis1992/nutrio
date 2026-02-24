import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu as MenuIcon, ChevronRight, LogOut, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useFavoriteRestaurants } from "@/hooks/useFavoriteRestaurants";
import { useSubscription } from "@/hooks/useSubscription";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";

interface MenuSection {
  title: string;
  items: MenuItem[];
}

interface MenuItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description?: string;
  to: string;
  badge?: string;
  badgeVariant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning";
  condition?: boolean;
  action?: () => void;
}

interface SideDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger?: React.ReactNode;
}

export function SideDrawer({ open, onOpenChange, trigger }: SideDrawerProps) {
  const navigate = useNavigate();
  const { favoriteIds } = useFavoriteRestaurants();
  const { hasActiveSubscription, isVip, subscription } = useSubscription();
  const { settings: platformSettings } = usePlatformSettings();
  const { user, signOut } = useAuth();
  const { toast } = useToast();

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: "Signed out",
      description: "You have been successfully signed out.",
    });
    navigate("/");
  };

  const menuSections: MenuSection[] = [
    {
      title: "Food & Meals",
      items: [
        {
          icon: ({ className }) => (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          ),
          label: "Favorites",
          description: `${favoriteIds.size} saved restaurants`,
          to: "/favorites",
        },
        ...(platformSettings?.features.meal_scheduling ? [{
          icon: ({ className }) => (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          ),
          label: "Schedule",
          description: "Plan your weekly meals",
          to: "/schedule",
        }] : []),
        {
          icon: ({ className }) => (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 3h18v18H3zM9 9h6M9 15h6M9 12h6" />
            </svg>
          ),
          label: "Restaurants",
          description: "Browse all restaurants",
          to: "/meals",
        },
      ],
    },
    {
      title: "Progress & Orders",
      items: [
        {
          icon: ({ className }) => (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="20" x2="12" y2="10" />
              <line x1="18" y1="20" x2="18" y2="4" />
              <line x1="6" y1="20" x2="6" y2="16" />
            </svg>
          ),
          label: "Progress",
          description: "Track weight, nutrition & health metrics",
          to: "/progress",
          badge: "Updated",
          badgeVariant: "success" as const,
        },
        {
          icon: ({ className }) => (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          ),
          label: "Order History",
          description: "View past orders",
          to: "/orders",
        },
        ...(platformSettings?.features.delivery_tracking ? [{
          icon: ({ className }) => (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="1" y="3" width="15" height="13" />
              <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
              <circle cx="5.5" cy="18.5" r="2.5" />
              <circle cx="18.5" cy="18.5" r="2.5" />
            </svg>
          ),
          label: "Live Tracking",
          description: "Track your orders",
          to: "/tracking",
        }] : []),
        {
          icon: ({ className }) => (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
              <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
              <path d="M4 22h16" />
              <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
              <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
              <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
            </svg>
          ),
          label: "Subscription",
          description: hasActiveSubscription ? "Manage your plan" : "Upgrade your plan",
          to: "/subscription",
          ...(isVip ? {
            badge: "VIP",
            badgeVariant: "secondary" as const,
          } : {}),
        },
      ],
    },
    {
      title: "Account & Settings",
      items: [
        {
          icon: ({ className }) => (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          ),
          label: "Profile",
          description: "Personal info & preferences",
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
          label: "Settings",
          description: "App preferences",
          to: "/settings",
        },
        {
          icon: ({ className }) => (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          ),
          label: "Addresses",
          description: "Delivery locations",
          to: "/addresses",
        },
        {
          icon: LogOut,
          label: "Sign Out",
          description: "Log out of your account",
          action: handleSignOut,
        },
      ],
    },
    ...(platformSettings?.features.referral_program ? [{
      title: "Earn Rewards",
      items: [
        {
          icon: ({ className }) => (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
              <line x1="7" y1="7" x2="7.01" y2="7" />
            </svg>
          ),
          label: "Refer & Earn",
          description: "Get 10 QAR per referral",
          to: "/referral",
        },
        {
          icon: ({ className }) => (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          ),
          label: "Affiliate",
          description: "Earn with your audience",
          to: "/affiliate",
        },
      ],
    }] : []),
  ];

  const userName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";
  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
            <MenuIcon className="w-6 h-6" />
          </Button>
        )}
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-[85%] max-w-sm p-0 flex flex-col drawer-content"
        aria-label="Main navigation menu"
      >
        {/* Account Card */}
        <div className="p-6 border-b border-border bg-muted/30">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground text-xl font-bold">
              {userInitial}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-lg">{userName}</p>
              <div className="flex items-center gap-2 mt-1">
                {hasActiveSubscription ? (
                  <>
                    <Badge variant={isVip ? "secondary" : "default"} className="text-xs">
                      {subscription?.plan} Plan
                    </Badge>
                    {isVip && (
                      <Badge variant="secondary" className="text-xs bg-gradient-to-r from-violet-500 to-purple-600 text-white border-0">
                        VIP
                      </Badge>
                    )}
                  </>
                ) : (
                  <Badge variant="outline" className="text-xs">
                    No active plan
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Menu Items */}
        <nav className="flex-1 overflow-y-auto" aria-label="Main menu">
          {menuSections.map((section, sectionIndex) => (
            <div key={sectionIndex} className="border-b border-border/50 last:border-0">
              <h3 className="px-6 pt-4 pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {section.title}
              </h3>
              <div className="py-1">
                {section.items.map((item, itemIndex) => (
                  <SheetClose key={itemIndex} asChild>
                    {item.action ? (
                      <button
                        onClick={item.action}
                        className="drawer-item w-full flex items-center gap-4 px-6 py-3.5 text-left hover:bg-accent/50 transition-colors"
                      >
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <item.icon className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{item.label}</span>
                            {item.badge && (
                              <Badge variant={item.badgeVariant || "default"} className="text-xs flex-shrink-0">
                                {item.badge}
                              </Badge>
                            )}
                          </div>
                          {item.description && (
                            <p className="text-sm text-muted-foreground truncate">{item.description}</p>
                          )}
                        </div>
                      </button>
                    ) : (
                      <button
                        onClick={() => navigate(item.to)}
                        className="drawer-item w-full flex items-center gap-4 px-6 py-3.5 text-left hover:bg-accent/50 transition-colors"
                      >
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <item.icon className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{item.label}</span>
                            {item.badge && (
                              <Badge variant={item.badgeVariant || "default"} className="text-xs flex-shrink-0">
                                {item.badge}
                              </Badge>
                            )}
                          </div>
                          {item.description && (
                            <p className="text-sm text-muted-foreground truncate">{item.description}</p>
                          )}
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                      </button>
                    )}
                  </SheetClose>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* App Version/Footer */}
        <div className="p-4 border-t border-border text-center">
          <div className="flex flex-col items-center gap-2">
            <Logo size="sm" />
            <p className="text-xs text-muted-foreground">v1.0.0</p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
