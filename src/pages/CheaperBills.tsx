import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { SwitchingPopupDialog } from "@/components/cheaper-bills/SwitchingPopupDialog";
import { ComparisonResult } from "@/hooks/useComparisonResults";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Zap, Wifi, Smartphone, Settings } from "lucide-react";
import { useTrackedServices } from "@/hooks/useTrackedServices";
import { useEnergyReadings } from "@/hooks/useEnergyReadings";
import { useEnergyTariffs } from "@/hooks/useEnergyTariffs";
import { useBillsScanner } from "@/hooks/useBillsScanner";
import { useCheaperBillsSettings } from "@/hooks/useCheaperBillsSettings";
import { useComparisonResults } from "@/hooks/useComparisonResults";
import { SavingsOverviewCard } from "@/components/cheaper-bills/SavingsOverviewCard";
import { NextContractCard } from "@/components/cheaper-bills/NextContractCard";
import { LastScanCard } from "@/components/cheaper-bills/LastScanCard";
import { ServiceCard } from "@/components/cheaper-bills/ServiceCard";
import { ServiceFormDialog } from "@/components/cheaper-bills/ServiceFormDialog";
import { EnergyUsageChart } from "@/components/cheaper-bills/EnergyUsageChart";
import { TariffFormDialog } from "@/components/cheaper-bills/TariffFormDialog";
import { ReadingFormDialog } from "@/components/cheaper-bills/ReadingFormDialog";
import { BillsAssistant } from "@/components/cheaper-bills/BillsAssistant";
import { EnergyProfileCard } from "@/components/cheaper-bills/EnergyProfileCard";
import { SmartMeterCard } from "@/components/cheaper-bills/SmartMeterCard";
import { NotificationSettingsCard } from "@/components/cheaper-bills/NotificationSettingsCard";
import { daysUntilContractEnd } from "@/lib/billsCalculations";

export default function CheaperBills() {
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [tariffDialogOpen, setTariffDialogOpen] = useState(false);
  const [readingDialogOpen, setReadingDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<any>(null);
  const [scanningServiceId, setScanningServiceId] = useState<string | null>(null);
  const [switchingOffer, setSwitchingOffer] = useState<ComparisonResult | null>(null);
  const [switchingCost, setSwitchingCost] = useState(0);

  const { services, isLoading, createService, updateService, deleteService, isCreating } = useTrackedServices();
  const { readings, createReading, isCreating: isCreatingReading, totalKwh, totalCost } = useEnergyReadings();
  const { electricityTariff, gasTariff, createTariff, isCreating: isCreatingTariff } = useEnergyTariffs();
  const { scanAllServices, scanService, isScanning, scanProgress } = useBillsScanner();
  const { settings } = useCheaperBillsSettings();
  const { results: comparisonResults, bestOffers } = useComparisonResults();

  // Calculate total potential savings
  const totalSavings = useMemo(() => {
    return services.reduce((sum, s) => sum + (s.estimated_savings_annual || 0), 0);
  }, [services]);

  // Find next contract ending
  const nextContract = useMemo(() => {
    const withDates = services
      .filter((s) => s.contract_end_date)
      .map((s) => ({ ...s, daysLeft: daysUntilContractEnd(s.contract_end_date) }))
      .filter((s) => s.daysLeft !== null && s.daysLeft > 0)
      .sort((a, b) => (a.daysLeft || 0) - (b.daysLeft || 0));
    return withDates[0] || null;
  }, [services]);

  // Get last scan info
  const lastScan = useMemo(() => {
    const scanned = services.filter((s) => s.last_scan_date);
    if (scanned.length === 0) return { date: null, recommendation: null, reason: null };
    const latest = scanned.sort((a, b) =>
      new Date(b.last_scan_date!).getTime() - new Date(a.last_scan_date!).getTime()
    )[0];
    return {
      date: latest.last_scan_date,
      recommendation: latest.last_recommendation,
      reason: latest.last_recommendation_reason,
    };
  }, [services]);

  const handleCreateService = (data: any) => {
    createService({
      ...data,
      contract_start_date: data.contract_start_date?.toISOString().split("T")[0],
      contract_end_date: data.contract_end_date?.toISOString().split("T")[0],
    });
    setServiceDialogOpen(false);
  };

  const handleCreateTariff = (data: any) => {
    createTariff({
      ...data,
      fix_end_date: data.fix_end_date?.toISOString().split("T")[0],
    });
    setTariffDialogOpen(false);
  };

  const handleCreateReading = (data: any) => {
    createReading({
      reading_date: data.reading_date.toISOString().split("T")[0],
      fuel_type: data.fuel_type,
      consumption_kwh: data.consumption_kwh,
      cost_estimate: data.cost_estimate,
      source: "manual",
    });
    setReadingDialogOpen(false);
  };

  // Estimate annual consumption from readings or use UK average
  const annualConsumptionKwh = useMemo(() => {
    if (totalKwh && totalKwh > 0) {
      // If we have readings, extrapolate to annual
      const readingDays = readings.length > 0 ? 
        Math.max(1, Math.ceil((Date.now() - new Date(readings[readings.length - 1]?.reading_date || Date.now()).getTime()) / (1000 * 60 * 60 * 24))) 
        : 30;
      return Math.round((totalKwh / readingDays) * 365);
    }
    return 2900; // UK average
  }, [totalKwh, readings]);

  const handleScanAll = async () => {
    const servicesToScan = services.filter(s => s.is_tracking_enabled);
    if (servicesToScan.length === 0) {
      return;
    }
    
    await scanAllServices(servicesToScan, {
      postcode: settings?.postcode || "SN2 1FS",
      annualConsumptionKwh,
      currentTariff: electricityTariff ? {
        unitRate: electricityTariff.unit_rate_kwh,
        standingCharge: electricityTariff.standing_charge_daily || 0,
      } : undefined,
    });
  };

  const handleScanService = async (service: any) => {
    setScanningServiceId(service.id);
    try {
      await scanService({
        serviceId: service.id,
        serviceType: service.service_type,
        currentMonthlyCost: service.monthly_cost,
        annualConsumptionKwh: service.service_type === "energy" ? annualConsumptionKwh : undefined,
        currentTariff: service.service_type === "energy" && electricityTariff ? {
          unitRate: electricityTariff.unit_rate_kwh,
          standingCharge: electricityTariff.standing_charge_daily || 0,
        } : undefined,
        postcode: settings?.postcode || "SN2 1FS",
        currentSpeedMbps: service.current_speed_mbps || undefined,
        preferredContractMonths: service.preferred_contract_months || undefined,
      });
    } finally {
      setScanningServiceId(null);
    }
  };

  const handleViewBestDeal = (offer: ComparisonResult) => {
    // Find the service to get current monthly cost
    const service = services.find(s => s.last_recommendation === 'switch');
    setSwitchingCost(service?.monthly_cost || 0);
    setSwitchingOffer(offer);
  };

  const energyServices = services.filter((s) => s.service_type === "energy");
  const broadbandServices = services.filter((s) => s.service_type === "broadband");
  const mobileServices = services.filter((s) => s.service_type === "mobile");
  const otherServices = services.filter((s) => !["energy", "broadband", "mobile"].includes(s.service_type));

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Cheaper Bills</h1>
            <p className="text-muted-foreground">Find better deals and track your services</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setServiceDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Service
            </Button>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SavingsOverviewCard totalSavings={totalSavings} servicesCount={services.length} />
          <NextContractCard service={nextContract} />
          <LastScanCard
            lastScanDate={lastScan.date}
            recommendation={lastScan.recommendation}
            recommendationReason={lastScan.reason}
            bestOffer={bestOffers[0] || null}
            onScan={services.length > 0 ? handleScanAll : undefined}
            isScanning={isScanning}
            scanProgress={scanProgress}
            onViewBestDeal={handleViewBestDeal}
          />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="energy" className="space-y-4">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="energy" className="gap-1 sm:gap-2 px-2 sm:px-4">
              <Zap className="h-4 w-4" />
              <span className="hidden sm:inline">Energy</span>
            </TabsTrigger>
            <TabsTrigger value="broadband" className="gap-1 sm:gap-2 px-2 sm:px-4">
              <Wifi className="h-4 w-4" />
              <span className="hidden sm:inline">Broadband</span>
            </TabsTrigger>
            <TabsTrigger value="mobile" className="gap-1 sm:gap-2 px-2 sm:px-4">
              <Smartphone className="h-4 w-4" />
              <span className="hidden sm:inline">Mobile</span>
            </TabsTrigger>
            <TabsTrigger value="other" className="gap-1 sm:gap-2 px-2 sm:px-4">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Other</span>
            </TabsTrigger>
          </TabsList>

          {/* Energy Tab */}
          <TabsContent value="energy" className="space-y-4">
            {/* Current Tariff */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base">Current Tariff</CardTitle>
                <Button variant="outline" size="sm" onClick={() => setTariffDialogOpen(true)}>
                  {electricityTariff ? "Edit Tariff" : "Add Tariff"}
                </Button>
              </CardHeader>
              <CardContent>
                {electricityTariff ? (
                  <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Provider</p>
                      <p className="font-medium">{electricityTariff.provider}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Tariff</p>
                      <p className="font-medium">{electricityTariff.tariff_name}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Unit Rate</p>
                      <p className="font-medium">{electricityTariff.unit_rate_kwh}p/kWh</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Standing Charge</p>
                      <p className="font-medium">{electricityTariff.standing_charge_daily}p/day</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">No tariff configured. Add your tariff details to enable comparisons.</p>
                )}
              </CardContent>
            </Card>

            {/* Smart Meter Connection */}
            <SmartMeterCard />

            {/* Usage Chart */}
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Usage</h3>
              <Button variant="outline" size="sm" onClick={() => setReadingDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Reading
              </Button>
            </div>
            <EnergyUsageChart readings={readings} />

            {/* Energy Services */}
            {energyServices.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Tracked Energy Services</h3>
                {energyServices.map((service) => (
                  <ServiceCard
                    key={service.id}
                    service={service}
                    comparisonResults={comparisonResults.filter(r => 
                      r.tracked_service_id === service.id || 
                      (r.service_type === 'energy' && !r.tracked_service_id)
                    )}
                    onEdit={() => setEditingService(service)}
                    onDelete={() => deleteService(service.id)}
                    onToggleTracking={(enabled) =>
                      updateService({ id: service.id, is_tracking_enabled: enabled })
                    }
                    onScan={() => handleScanService(service)}
                    isScanning={scanningServiceId === service.id}
                  />
                ))}
              </div>
            )}

            {/* Energy Profile - Personalize AI tips */}
            <EnergyProfileCard />

            {/* AI Assistant */}
            <BillsAssistant />

            {/* Notification Settings */}
            <NotificationSettingsCard />
          </TabsContent>

          {/* Broadband Tab */}
          <TabsContent value="broadband" className="space-y-4">
            {broadbandServices.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Wifi className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Broadband Services</h3>
                  <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
                    Add your broadband provider to track contract dates and find better deals.
                  </p>
                  <Button onClick={() => setServiceDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Broadband
                  </Button>
                </CardContent>
              </Card>
            ) : (
              broadbandServices.map((service) => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  comparisonResults={comparisonResults.filter(r => 
                    r.tracked_service_id === service.id || 
                    (r.service_type === 'broadband' && !r.tracked_service_id)
                  )}
                  onEdit={() => setEditingService(service)}
                  onDelete={() => deleteService(service.id)}
                  onToggleTracking={(enabled) =>
                    updateService({ id: service.id, is_tracking_enabled: enabled })
                  }
                  onScan={() => handleScanService(service)}
                  isScanning={scanningServiceId === service.id}
                />
              ))
            )}
          </TabsContent>

          {/* Mobile Tab */}
          <TabsContent value="mobile" className="space-y-4">
            {mobileServices.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Smartphone className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Mobile Services</h3>
                  <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
                    Add your mobile contract to track renewals and compare SIM deals.
                  </p>
                  <Button onClick={() => setServiceDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Mobile
                  </Button>
                </CardContent>
              </Card>
            ) : (
              mobileServices.map((service) => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  comparisonResults={comparisonResults.filter(r => 
                    r.tracked_service_id === service.id || 
                    (r.service_type === 'mobile' && !r.tracked_service_id)
                  )}
                  onEdit={() => setEditingService(service)}
                  onDelete={() => deleteService(service.id)}
                  onToggleTracking={(enabled) =>
                    updateService({ id: service.id, is_tracking_enabled: enabled })
                  }
                  onScan={() => handleScanService(service)}
                  isScanning={scanningServiceId === service.id}
                />
              ))
            )}
          </TabsContent>

          {/* Other Tab */}
          <TabsContent value="other" className="space-y-4">
            {otherServices.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Settings className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Other Services</h3>
                  <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
                    Track insurance, streaming, or any other recurring services.
                  </p>
                  <Button onClick={() => setServiceDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Service
                  </Button>
                </CardContent>
              </Card>
            ) : (
              otherServices.map((service) => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  comparisonResults={comparisonResults.filter(r => 
                    r.tracked_service_id === service.id
                  )}
                  onEdit={() => setEditingService(service)}
                  onDelete={() => deleteService(service.id)}
                  onToggleTracking={(enabled) =>
                    updateService({ id: service.id, is_tracking_enabled: enabled })
                  }
                  onScan={() => handleScanService(service)}
                  isScanning={scanningServiceId === service.id}
                />
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <ServiceFormDialog
        open={serviceDialogOpen}
        onOpenChange={setServiceDialogOpen}
        onSubmit={handleCreateService}
        isLoading={isCreating}
      />
      <ServiceFormDialog
        open={!!editingService}
        onOpenChange={(open) => !open && setEditingService(null)}
        onSubmit={(data) => {
          updateService({
            id: editingService.id,
            ...data,
            contract_start_date: data.contract_start_date?.toISOString().split("T")[0],
            contract_end_date: data.contract_end_date?.toISOString().split("T")[0],
          });
          setEditingService(null);
        }}
        isLoading={false}
        mode="edit"
        defaultValues={editingService ? {
          service_type: editingService.service_type,
          provider: editingService.provider,
          plan_name: editingService.plan_name || "",
          monthly_cost: editingService.monthly_cost,
          contract_start_date: editingService.contract_start_date ? new Date(editingService.contract_start_date) : undefined,
          contract_end_date: editingService.contract_end_date ? new Date(editingService.contract_end_date) : undefined,
          exit_fee: editingService.exit_fee || 0,
          notes: editingService.notes || "",
          current_speed_mbps: editingService.current_speed_mbps || undefined,
          preferred_contract_months: editingService.preferred_contract_months || undefined,
        } : undefined}
      />
      <SwitchingPopupDialog
        open={!!switchingOffer}
        onOpenChange={(open) => !open && setSwitchingOffer(null)}
        result={switchingOffer}
        currentMonthlyCost={switchingCost}
      />
      <TariffFormDialog
        open={tariffDialogOpen}
        onOpenChange={setTariffDialogOpen}
        onSubmit={handleCreateTariff}
        isLoading={isCreatingTariff}
      />
      <ReadingFormDialog
        open={readingDialogOpen}
        onOpenChange={setReadingDialogOpen}
        onSubmit={handleCreateReading}
        isLoading={isCreatingReading}
      />
    </AppLayout>
  );
}
