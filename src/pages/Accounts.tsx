import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { CreditCard } from "lucide-react";

export default function Accounts() {
  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Accounts</h1>
          <p className="text-muted-foreground">
            Manage your bank accounts and balances
          </p>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CreditCard className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">No accounts yet</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Connect to your bank or add accounts manually to start tracking your finances.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
