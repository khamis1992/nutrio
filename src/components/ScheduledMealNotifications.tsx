import { useScheduledMealNotifications } from "@/hooks/useScheduledMealNotifications";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Check, X } from "lucide-react";
import { format, parseISO } from "date-fns";

export function ScheduledMealNotifications() {
  const { pendingNotifications, dismissNotification, viewSchedule } = useScheduledMealNotifications();

  if (pendingNotifications.length === 0) return null;

  return (
    <div className="space-y-3">
      {pendingNotifications.map((notification) => (
        <Card key={notification.id} className="p-4 bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">Meal Scheduled!</p>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {notification.meal_name} • {format(parseISO(notification.scheduled_date), "MMM d")} • {notification.calories} cal
              </p>
              <div className="flex items-center gap-2 mt-3">
                <Button 
                  size="sm" 
                  variant="default"
                  className="h-8 text-xs"
                  onClick={() => {
                    viewSchedule();
                    dismissNotification(notification.id);
                  }}
                >
                  <Check className="w-3 h-3 mr-1" />
                  View Schedule
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost"
                  className="h-8 text-xs"
                  onClick={() => dismissNotification(notification.id)}
                >
                  <X className="w-3 h-3 mr-1" />
                  Dismiss
                </Button>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
