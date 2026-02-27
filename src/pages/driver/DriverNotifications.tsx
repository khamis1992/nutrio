import { Card, CardContent } from "@/components/ui/card";
import { Bell } from "lucide-react";
export default function DriverNotifications() {
  return (
    <div className="p-4">
      <Card>
        <CardContent className="py-12 text-center">
          <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
          <p className="text-muted-foreground">No notifications yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            You'll be notified about new orders and updates
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
