import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface ScanResult {
  success: boolean;
  serviceType: string;
  comparisons: Array<{
    provider: string;
    planName: string;
    monthlyCost: number;
    annualCost: number;
    savings: number;
    recommend: boolean;
    reason: string;
    source: string;
  }>;
  bestOffer: {
    provider: string;
    planName: string;
    savings: number;
    recommend: boolean;
  } | null;
  scannedAt: string;
}

export function useBillsScanner() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<string | null>(null);

  const scanService = useMutation({
    mutationFn: async ({
      serviceId,
      serviceType,
      currentMonthlyCost,
      annualConsumptionKwh,
      currentTariff,
      postcode,
      currentSpeedMbps,
      currentDataGb,
      preferredContractMonths,
    }: {
      serviceId?: string;
      serviceType: string;
      currentMonthlyCost: number;
      annualConsumptionKwh?: number;
      currentTariff?: {
        unitRate: number;
        standingCharge: number;
      };
      postcode?: string;
      currentSpeedMbps?: number;
      currentDataGb?: number;
      preferredContractMonths?: number;
    }) => {
      const { data, error } = await supabase.functions.invoke("compare-energy-deals", {
        body: {
          serviceId,
          serviceType,
          currentMonthlyCost,
          annualConsumptionKwh,
          currentTariff,
          postcode,
          currentSpeedMbps,
          currentDataGb,
          preferredContractMonths,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as ScanResult;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tracked-services"] });
      queryClient.invalidateQueries({ queryKey: ["comparison-results"] });
      
      if (data.bestOffer?.recommend) {
        toast.success(
          `Found savings! Switch to ${data.bestOffer.provider} to save £${data.bestOffer.savings.toFixed(0)}/year`
        );
      } else {
        toast.info(`Scan complete for ${variables.serviceType} - you're on a good deal`);
      }
    },
    onError: (error) => {
      toast.error(`Scan failed: ${error.message}`);
    },
  });

  const scanAllServices = async (
    services: Array<{
      id: string;
      service_type: string;
      monthly_cost: number;
      current_speed_mbps?: number | null;
      current_data_gb?: number | null;
      preferred_contract_months?: number | null;
    }>,
    options: {
      postcode?: string;
      annualConsumptionKwh?: number;
      currentTariff?: { unitRate: number; standingCharge: number };
    }
  ) => {
    setIsScanning(true);
    const results: ScanResult[] = [];

    try {
      for (const service of services) {
        setScanProgress(`Scanning ${service.service_type}...`);
        
        try {
          const result = await scanService.mutateAsync({
            serviceId: service.id,
            serviceType: service.service_type,
            currentMonthlyCost: service.monthly_cost,
            annualConsumptionKwh: service.service_type === "energy" ? options.annualConsumptionKwh : undefined,
            currentTariff: service.service_type === "energy" ? options.currentTariff : undefined,
            postcode: options.postcode,
            currentSpeedMbps: service.current_speed_mbps || undefined,
            currentDataGb: service.current_data_gb || undefined,
            preferredContractMonths: service.preferred_contract_months || undefined,
          });
          results.push(result);
        } catch (e) {
          console.error(`Failed to scan ${service.service_type}:`, e);
        }
      }

      const totalSavings = results.reduce(
        (sum, r) => sum + (r.bestOffer?.savings || 0),
        0
      );

      if (totalSavings > 0) {
        toast.success(`Found total potential savings of £${totalSavings.toFixed(0)}/year!`);
      } else {
        toast.info("Scan complete - you're on good deals across the board");
      }

      return results;
    } finally {
      setIsScanning(false);
      setScanProgress(null);
    }
  };

  return {
    scanService: scanService.mutate,
    scanServiceAsync: scanService.mutateAsync,
    scanAllServices,
    isScanning: isScanning || scanService.isPending,
    scanProgress,
  };
}
