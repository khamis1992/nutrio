import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Bell, Volume2, Vibrate, Smartphone } from "lucide-react";
import { DriverLayout } from "@/components/DriverLayout";

export default function DriverSettings() {
  const [settings, setSettings] = useState({
    push_notifications: true,
    order_alerts: true,
    sound_enabled: true,
    vibration_enabled: true,
  });

  return (
    <DriverLayout title="Settings">
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Smartphone className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label>Push Notifications</Label>
                  <p className="text-xs text-muted-foreground">
                    Receive alerts for new orders
                  </p>
                </div>
              </div>
              <Switch
                checked={settings.push_notifications}
                onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, push_notifications: checked }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label>Order Alerts</Label>
                  <p className="text-xs text-muted-foreground">
                    Get notified about order updates
                  </p>
                </div>
              </div>
              <Switch
                checked={settings.order_alerts}
                onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, order_alerts: checked }))}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Volume2 className="h-4 w-4" />
              Sound & Haptics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Volume2 className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label>Sound Effects</Label>
                  <p className="text-xs text-muted-foreground">
                    Play sounds for notifications
                  </p>
                </div>
              </div>
              <Switch
                checked={settings.sound_enabled}
                onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, sound_enabled: checked }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Vibrate className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label>Vibration</Label>
                  <p className="text-xs text-muted-foreground">
                    Vibrate for new order alerts
                  </p>
                </div>
              </div>
              <Switch
                checked={settings.vibration_enabled}
                onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, vibration_enabled: checked }))}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-muted-foreground text-center">
              Driver App v1.0.0
            </p>
          </CardContent>
        </Card>
      </div>
    </DriverLayout>
  );
}
