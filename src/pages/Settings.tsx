import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings as SettingsIcon, User, Palette, CreditCard, Tag, CalendarDays } from "lucide-react";

export default function Settings() {
  const settingsSections = [
    { 
      title: "Account", 
      description: "Manage your profile and preferences",
      icon: User 
    },
    { 
      title: "Appearance", 
      description: "Customize the app theme and display",
      icon: Palette 
    },
    { 
      title: "Bank Accounts", 
      description: "Add, edit, or remove bank accounts",
      icon: CreditCard 
    },
    { 
      title: "Categories", 
      description: "Manage transaction categories",
      icon: Tag 
    },
    { 
      title: "Payday Settings", 
      description: "Configure your pay cycle rules",
      icon: CalendarDays 
    },
  ];

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground">
            Manage your account and preferences
          </p>
        </div>

        <div className="grid gap-4">
          {settingsSections.map((section) => (
            <Card key={section.title} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="flex items-center gap-4 py-4">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <section.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium">{section.title}</h3>
                  <p className="text-sm text-muted-foreground">{section.description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
