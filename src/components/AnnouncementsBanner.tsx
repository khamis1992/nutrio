import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Megaphone, AlertTriangle, Info, PartyPopper } from "lucide-react";

interface Announcement {
  id: string;
  title: string;
  message: string;
  type: string;
  starts_at: string;
  ends_at: string | null;
}

const typeConfig: Record<string, { icon: React.ReactNode; className: string; badgeVariant: "default" | "secondary" | "destructive" | "outline" }> = {
  info: {
    icon: <Info className="w-5 h-5" />,
    className: "border-blue-500/30 bg-gradient-to-r from-blue-500/5 to-blue-500/10",
    badgeVariant: "default",
  },
  warning: {
    icon: <AlertTriangle className="w-5 h-5" />,
    className: "border-amber-500/30 bg-gradient-to-r from-amber-500/5 to-amber-500/10",
    badgeVariant: "secondary",
  },
  success: {
    icon: <PartyPopper className="w-5 h-5" />,
    className: "border-green-500/30 bg-gradient-to-r from-green-500/5 to-green-500/10",
    badgeVariant: "outline",
  },
  promotion: {
    icon: <Megaphone className="w-5 h-5" />,
    className: "border-primary/30 bg-gradient-to-r from-primary/5 to-primary/10",
    badgeVariant: "default",
  },
};

interface AnnouncementsBannerProps {
  audience?: "customers" | "partners";
}

export function AnnouncementsBanner({ audience = "customers" }: AnnouncementsBannerProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchAnnouncements = async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("id, title, message, type, starts_at, ends_at")
        .eq("is_active", true)
        .or(`target_audience.eq.all,target_audience.eq.${audience}`)
        .lte("starts_at", new Date().toISOString())
        .or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setAnnouncements(data);
      }
    };

    // Load dismissed announcements from localStorage
    const dismissed = localStorage.getItem("dismissed_announcements");
    if (dismissed) {
      setDismissedIds(new Set(JSON.parse(dismissed)));
    }

    fetchAnnouncements();
  }, [audience]);

  const handleDismiss = (id: string) => {
    const newDismissed = new Set(dismissedIds);
    newDismissed.add(id);
    setDismissedIds(newDismissed);
    localStorage.setItem("dismissed_announcements", JSON.stringify([...newDismissed]));
  };

  const visibleAnnouncements = announcements.filter(a => !dismissedIds.has(a.id));

  if (visibleAnnouncements.length === 0) return null;

  return (
    <div className="space-y-3">
      {visibleAnnouncements.map((announcement) => {
        const config = typeConfig[announcement.type] || typeConfig.info;
        
        return (
          <Card key={announcement.id} className={`animate-fade-in ${config.className}`}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-background/50 flex items-center justify-center shrink-0">
                  {config.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-sm">{announcement.title}</h4>
                    <Badge variant={config.badgeVariant} className="text-xs capitalize">
                      {announcement.type}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{announcement.message}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 h-8 w-8"
                  onClick={() => handleDismiss(announcement.id)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}