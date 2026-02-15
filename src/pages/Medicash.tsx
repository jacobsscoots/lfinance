import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, HeartPulse, Settings2, CalendarDays } from "lucide-react";
import { useMedicash, getPolicyYearRange } from "@/hooks/useMedicash";
import { ClaimFormDialog } from "@/components/medicash/ClaimFormDialog";
import { format } from "date-fns";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogHeader, ResponsiveDialogTitle } from "@/components/ui/responsive-dialog";

export default function Medicash() {
  const {
    settings,
    categories,
    categoriesLoading,
    categoryTotals,
    policyYear,
    totalClaimedThisYear,
    totalMaxThisYear,
    totalRemainingThisYear,
    seedCategories,
    isSeeding,
    createClaim,
    isCreatingClaim,
    deleteClaim,
    updateSettings,
    claims,
  } = useMedicash();

  const [claimDialogOpen, setClaimDialogOpen] = useState(false);
  const [claimToDelete, setClaimToDelete] = useState<string | null>(null);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [settingsMonth, setSettingsMonth] = useState(1);
  const [settingsDay, setSettingsDay] = useState(1);

  // Seed categories on first load
  useEffect(() => {
    if (!categoriesLoading && categories.length === 0) {
      seedCategories();
    }
  }, [categoriesLoading, categories.length]);

  // Sync settings form
  useEffect(() => {
    if (settings) {
      setSettingsMonth(settings.policy_year_start_month);
      setSettingsDay(settings.policy_year_start_day);
    }
  }, [settings]);

  const handleSaveSettings = () => {
    updateSettings({ policy_year_start_month: settingsMonth, policy_year_start_day: settingsDay });
    setSettingsDialogOpen(false);
  };

  // Get category name for a claim
  const getCategoryName = (categoryId: string) =>
    categories.find(c => c.id === categoryId)?.name ?? "Unknown";

  return (
    <AppLayout>
      <div className="space-y-6 pb-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <HeartPulse className="h-6 w-6 text-primary" />
              Medicash Benefits
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Policy year: {format(policyYear.start, "d MMM yyyy")} – {format(policyYear.end, "d MMM yyyy")}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setSettingsDialogOpen(true)}>
              <Settings2 className="h-4 w-4 mr-1" /> Settings
            </Button>
            <Button size="sm" onClick={() => setClaimDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Log Claim
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total Claimed</p>
              <p className="text-2xl font-bold text-foreground">£{totalClaimedThisYear.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">of £{totalMaxThisYear.toFixed(0)} capped benefits</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Remaining</p>
              <p className="text-2xl font-bold text-success">£{totalRemainingThisYear.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">across capped categories</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Policy Year Resets</p>
              <p className="text-2xl font-bold text-foreground">{format(policyYear.end, "d MMM yyyy")}</p>
              <p className="text-xs text-muted-foreground">
                {Math.ceil((policyYear.end.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days remaining
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Benefit Categories */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Benefit Categories</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {categoryTotals.map(cat => {
              const pct = cat.yearly_max ? Math.min(100, (cat.totalClaimed / cat.yearly_max) * 100) : 0;
              return (
                <div key={cat.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{cat.name}</span>
                      {cat.is_per_event && (
                        <Badge variant="secondary" className="text-xs">£{cat.per_event_amount}/event</Badge>
                      )}
                    </div>
                    <div className="text-sm text-right">
                      {cat.yearly_max ? (
                        <span>
                          <span className="font-semibold">£{cat.totalClaimed.toFixed(0)}</span>
                          <span className="text-muted-foreground"> / £{cat.yearly_max}</span>
                        </span>
                      ) : (
                        <span className="font-semibold">£{cat.totalClaimed.toFixed(0)}</span>
                      )}
                    </div>
                  </div>
                  {cat.yearly_max && (
                    <Progress value={pct} className="h-2" />
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Recent Claims */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Claims History</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setClaimDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> New Claim
            </Button>
          </CardHeader>
          <CardContent>
            {claims.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No claims yet. Click "Log Claim" to record your first cashback claim.
              </p>
            ) : (
              <div className="space-y-2">
                {claims.slice(0, 50).map(claim => (
                  <div key={claim.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{claim.description || getCategoryName(claim.category_id)}</span>
                        <Badge variant="secondary" className="text-xs">{getCategoryName(claim.category_id)}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <CalendarDays className="h-3 w-3" />
                        {format(new Date(claim.claim_date), "d MMM yyyy")}
                        {claim.notes && <span className="ml-2">· {claim.notes}</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-success">+£{Number(claim.amount).toFixed(2)}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setClaimToDelete(claim.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Claim Form Dialog */}
      <ClaimFormDialog
        open={claimDialogOpen}
        onOpenChange={setClaimDialogOpen}
        categories={categoryTotals}
        onSubmit={createClaim}
        isPending={isCreatingClaim}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!claimToDelete} onOpenChange={(open) => !open && setClaimToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Claim</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this claim? This will also remove it from your Yearly Planner income.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (claimToDelete) { deleteClaim(claimToDelete); setClaimToDelete(null); } }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Settings Dialog */}
      <ResponsiveDialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader className="pr-8">
            <ResponsiveDialogTitle>Policy Year Settings</ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
          <div className="space-y-4 px-1">
            <p className="text-sm text-muted-foreground">Set when your Medicash policy year starts. Claim totals reset on this date each year.</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Start Month</Label>
                <Input type="number" min={1} max={12} value={settingsMonth} onChange={e => setSettingsMonth(parseInt(e.target.value) || 1)} />
              </div>
              <div className="space-y-2">
                <Label>Start Day</Label>
                <Input type="number" min={1} max={31} value={settingsDay} onChange={e => setSettingsDay(parseInt(e.target.value) || 1)} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setSettingsDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveSettings}>Save</Button>
            </div>
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </AppLayout>
  );
}
