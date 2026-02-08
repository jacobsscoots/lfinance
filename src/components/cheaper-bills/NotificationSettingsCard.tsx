import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Bell, Mail, Loader2 } from "lucide-react";
import { useCheaperBillsSettings } from "@/hooks/useCheaperBillsSettings";

export function NotificationSettingsCard() {
  const { settings, updateSettings, isUpdating } = useCheaperBillsSettings();
  const [email, setEmail] = useState("");
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [inAppNotifications, setInAppNotifications] = useState(true);

  useEffect(() => {
    if (settings) {
      setEmail(settings.notification_email || "");
      setEmailNotifications(settings.email_notifications);
      setInAppNotifications(settings.in_app_notifications);
    }
  }, [settings]);

  const handleSave = () => {
    updateSettings({
      notification_email: email || null,
      email_notifications: emailNotifications,
      in_app_notifications: inAppNotifications,
    });
  };

  const hasChanges =
    email !== (settings?.notification_email || "") ||
    emailNotifications !== settings?.email_notifications ||
    inAppNotifications !== settings?.in_app_notifications;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          Notification Settings
        </CardTitle>
        <CardDescription>
          Get notified about contract end dates, savings opportunities, and usage summaries
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="notification-email" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Notification Email
          </Label>
          <Input
            id="notification-email"
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Leave empty to use your account email
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="email-notifications">Email Notifications</Label>
              <p className="text-xs text-muted-foreground">
                Contract reminders and savings alerts
              </p>
            </div>
            <Switch
              id="email-notifications"
              checked={emailNotifications}
              onCheckedChange={setEmailNotifications}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="inapp-notifications">In-App Notifications</Label>
              <p className="text-xs text-muted-foreground">
                Show alerts in the app dashboard
              </p>
            </div>
            <Switch
              id="inapp-notifications"
              checked={inAppNotifications}
              onCheckedChange={setInAppNotifications}
            />
          </div>
        </div>

        {hasChanges && (
          <Button onClick={handleSave} disabled={isUpdating} className="w-full">
            {isUpdating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Preferences
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
