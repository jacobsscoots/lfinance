import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Tag, CalendarDays, Package, Target, FileText, Calendar, Mail, Upload, Truck, Activity, Lock, LogOut } from "lucide-react";
import { ExcelImportDialog } from "@/components/settings/ExcelImportDialog";
import { RetailerProfileSettings } from "@/components/settings/RetailerProfileSettings";
import { ProductSettings } from "@/components/settings/ProductSettings";
import { NutritionTargetSettings } from "@/components/settings/NutritionTargetSettings";
import { PaydaySettings } from "@/components/settings/PaydaySettings";
import { PayslipSettings } from "@/components/settings/PayslipSettings";
import { PayslipPreviewDialog } from "@/components/settings/PayslipPreviewDialog";
import { ZigzagCalculator } from "@/components/settings/ZigzagCalculator";
import { GmailSettings } from "@/components/settings/GmailSettings";
import { ServiceStatusSettings } from "@/components/settings/ServiceStatusSettings";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Payslip } from "@/hooks/usePayslips";

function AccountSettingsInline() {
  const { user, signOut } = useAuth();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Password updated successfully");
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account Settings</CardTitle>
        <CardDescription>Manage your account details</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-muted-foreground">
            <Mail className="h-4 w-4" />
            Email
          </Label>
          <p className="text-sm font-medium text-foreground">{user?.email}</p>
        </div>
        <Separator />
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Change Password
          </Label>
          <Input type="password" placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          <Input type="password" placeholder="Confirm new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          <Button onClick={handleChangePassword} disabled={loading || !newPassword} className="w-full">
            {loading ? "Updating…" : "Update Password"}
          </Button>
        </div>
        <Separator />
        <Button variant="outline" className="w-full text-destructive hover:text-destructive" onClick={signOut}>
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
      </CardContent>
    </Card>
  );
}

export default function Settings() {
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);
  const [payslipDialogOpen, setPayslipDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

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

        <Tabs defaultValue="account" className="space-y-4">
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
            <TabsList className="inline-flex w-auto h-auto gap-0.5 sm:gap-1">
              {/* ── General ── */}
              <TabsTrigger value="account" className="flex items-center gap-1.5 px-2 sm:px-3 whitespace-nowrap">
                <User className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span className="hidden sm:inline text-xs sm:text-sm">Account</span>
              </TabsTrigger>
              <TabsTrigger value="services" className="flex items-center gap-1.5 px-2 sm:px-3 whitespace-nowrap">
                <Activity className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span className="hidden sm:inline text-xs sm:text-sm">Services</span>
              </TabsTrigger>
              {/* ── Finance ── */}
              <TabsTrigger value="payday" className="flex items-center gap-1.5 px-2 sm:px-3 whitespace-nowrap">
                <CalendarDays className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span className="hidden sm:inline text-xs sm:text-sm">Payday</span>
              </TabsTrigger>
              <TabsTrigger value="categories" className="flex items-center gap-1.5 px-2 sm:px-3 whitespace-nowrap">
                <Tag className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span className="hidden sm:inline text-xs sm:text-sm">Categories</span>
              </TabsTrigger>
              {/* ── Groceries ── */}
              <TabsTrigger value="products" className="flex items-center gap-1.5 px-2 sm:px-3 whitespace-nowrap">
                <Package className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span className="hidden sm:inline text-xs sm:text-sm">Products</span>
              </TabsTrigger>
              <TabsTrigger value="nutrition" className="flex items-center gap-1.5 px-2 sm:px-3 whitespace-nowrap">
                <Target className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span className="hidden sm:inline text-xs sm:text-sm">Nutrition</span>
              </TabsTrigger>
              <TabsTrigger value="weekly" className="flex items-center gap-1.5 px-2 sm:px-3 whitespace-nowrap">
                <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span className="hidden sm:inline text-xs sm:text-sm">Weekly Plan</span>
              </TabsTrigger>
              {/* ── Data ── */}
              <TabsTrigger value="payslips" className="flex items-center gap-1.5 px-2 sm:px-3 whitespace-nowrap">
                <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span className="hidden sm:inline text-xs sm:text-sm">Payslips</span>
              </TabsTrigger>
              <TabsTrigger value="gmail" className="flex items-center gap-1.5 px-2 sm:px-3 whitespace-nowrap">
                <Mail className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span className="hidden sm:inline text-xs sm:text-sm">Gmail</span>
              </TabsTrigger>
              <TabsTrigger value="shipping" className="flex items-center gap-1.5 px-2 sm:px-3 whitespace-nowrap">
                <Truck className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span className="hidden sm:inline text-xs sm:text-sm">Shipping</span>
              </TabsTrigger>
              <TabsTrigger value="import" className="flex items-center gap-1.5 px-2 sm:px-3 whitespace-nowrap">
                <Upload className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span className="hidden sm:inline text-xs sm:text-sm">Import</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="services">
            <ServiceStatusSettings />
          </TabsContent>

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

          <TabsContent value="gmail">
            <GmailSettings />
          </TabsContent>

          <TabsContent value="shipping">
            <RetailerProfileSettings />
          </TabsContent>

          <TabsContent value="import">
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Upload className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium mb-2">Excel Import</h3>
                <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
                  Upload your existing bills, subscriptions, and debts from an Excel spreadsheet.
                </p>
                <Button onClick={() => setImportDialogOpen(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Excel File
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="account">
            <AccountSettingsInline />
          </TabsContent>
        </Tabs>
      </div>

      <PayslipPreviewDialog
        payslip={selectedPayslip}
        open={payslipDialogOpen}
        onOpenChange={setPayslipDialogOpen}
      />

      <ExcelImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
      />
    </AppLayout>
  );
}
