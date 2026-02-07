import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Tag, CalendarDays, Package, Target, FileText, Calendar } from "lucide-react";
import { ProductSettings } from "@/components/settings/ProductSettings";
import { NutritionTargetSettings } from "@/components/settings/NutritionTargetSettings";
import { PaydaySettings } from "@/components/settings/PaydaySettings";
import { PayslipSettings } from "@/components/settings/PayslipSettings";
import { PayslipPreviewDialog } from "@/components/settings/PayslipPreviewDialog";
import { ZigzagCalculator } from "@/components/settings/ZigzagCalculator";
import { Card, CardContent } from "@/components/ui/card";
import { Payslip } from "@/hooks/usePayslips";

export default function Settings() {
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);
  const [payslipDialogOpen, setPayslipDialogOpen] = useState(false);

  const handleViewPayslip = (payslip: Payslip) => {
    setSelectedPayslip(payslip);
    setPayslipDialogOpen(true);
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground">
            Manage your account and preferences
          </p>
        </div>

        <Tabs defaultValue="nutrition" className="space-y-4">
          <TabsList className="w-full flex overflow-x-auto h-auto flex-wrap sm:flex-nowrap">
            <TabsTrigger value="nutrition" className="flex items-center gap-2 flex-1 sm:flex-none">
              <Target className="h-4 w-4" />
              <span className="hidden sm:inline">Nutrition</span>
            </TabsTrigger>
            <TabsTrigger value="weekly" className="flex items-center gap-2 flex-1 sm:flex-none">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Weekly Plan</span>
            </TabsTrigger>
            <TabsTrigger value="products" className="flex items-center gap-2 flex-1 sm:flex-none">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Products</span>
            </TabsTrigger>
            <TabsTrigger value="categories" className="flex items-center gap-2 flex-1 sm:flex-none">
              <Tag className="h-4 w-4" />
              <span className="hidden sm:inline">Categories</span>
            </TabsTrigger>
            <TabsTrigger value="payday" className="flex items-center gap-2 flex-1 sm:flex-none">
              <CalendarDays className="h-4 w-4" />
              <span className="hidden sm:inline">Payday</span>
            </TabsTrigger>
            <TabsTrigger value="payslips" className="flex items-center gap-2 flex-1 sm:flex-none">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Payslips</span>
            </TabsTrigger>
            <TabsTrigger value="account" className="flex items-center gap-2 flex-1 sm:flex-none">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Account</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="nutrition">
            <NutritionTargetSettings />
          </TabsContent>

          <TabsContent value="weekly">
            <ZigzagCalculator />
          </TabsContent>

          <TabsContent value="products">
            <ProductSettings />
          </TabsContent>

          <TabsContent value="categories">
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Tag className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium mb-2">Transaction Categories</h3>
                <p className="text-sm text-muted-foreground text-center max-w-sm">
                  Category management coming soon. Your default categories are already set up.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payday">
            <PaydaySettings />
          </TabsContent>

          <TabsContent value="payslips">
            <PayslipSettings onViewPayslip={handleViewPayslip} />
          </TabsContent>

          <TabsContent value="account">
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <User className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium mb-2">Account Settings</h3>
                <p className="text-sm text-muted-foreground text-center max-w-sm">
                  Manage your profile, email, and account preferences.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <PayslipPreviewDialog
        payslip={selectedPayslip}
        open={payslipDialogOpen}
        onOpenChange={setPayslipDialogOpen}
      />
    </AppLayout>
  );
}
