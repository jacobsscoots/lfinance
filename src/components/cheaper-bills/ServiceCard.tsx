import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  MoreVertical,
  Pencil,
  Trash2,
  CalendarPlus,
  Zap,
  Wifi,
  Smartphone,
  Shield,
  Tv,
  TrendingDown,
  Search,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { TrackedService } from "@/hooks/useTrackedServices";
import { ComparisonResult } from "@/hooks/useComparisonResults";
import { daysUntilContractEnd, generateIcsContent } from "@/lib/billsCalculations";
import { ScanResultsPanel } from "./ScanResultsPanel";
import { useState } from "react";

interface ServiceCardProps {
  service: TrackedService;
  comparisonResults?: ComparisonResult[];
  onEdit: () => void;
  onDelete: () => void;
  onToggleTracking: (enabled: boolean) => void;
  onScan?: () => void;
  isScanning?: boolean;
}

const serviceIcons: Record<string, any> = {
  energy: Zap,
  broadband: Wifi,
  mobile: Smartphone,
  insurance: Shield,
  streaming: Tv,
};

export function ServiceCard({ service, comparisonResults = [], onEdit, onDelete, onToggleTracking, onScan, isScanning }: ServiceCardProps) {
  const [isResultsOpen, setIsResultsOpen] = useState(false);
  const Icon = serviceIcons[service.service_type] || Zap;
  const daysLeft = daysUntilContractEnd(service.contract_end_date);
  const isEnding = daysLeft !== null && daysLeft <= 30;
  
  // Filter results for this service
  const serviceResults = comparisonResults.filter(
    r => r.tracked_service_id === service.id || r.service_type === service.service_type
  );
  const cheaperAlternatives = serviceResults.filter(r => {
    const resultAnnual = r.annual_cost || r.monthly_cost * 12;
    const currentAnnual = service.monthly_cost * 12;
    return resultAnnual < currentAnnual;
  });

  const handleAddToCalendar = () => {
    if (!service.contract_end_date) return;

    const icsContent = generateIcsContent(
      service.service_type,
      service.provider,
      service.contract_end_date
    );

    const blob = new Blob([icsContent], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${service.provider}-contract-reminder.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className={isEnding ? "border-amber-500/50" : ""}>
      <CardHeader className="flex flex-col sm:flex-row sm:items-start justify-between pb-2 gap-2">
        <div className="flex items-start sm:items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-sm sm:text-base flex flex-wrap items-center gap-1 sm:gap-2">
              <span className="truncate">{service.provider}</span>
              <Badge variant="outline" className="capitalize text-xs flex-shrink-0">
                {service.service_type}
              </Badge>
            </CardTitle>
            {service.plan_name && (
              <p className="text-xs sm:text-sm text-muted-foreground truncate">{service.plan_name}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 self-start">
          <Switch
            checked={service.is_tracking_enabled}
            onCheckedChange={onToggleTracking}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onScan && (
                <DropdownMenuItem onClick={onScan} disabled={isScanning}>
                  {isScanning ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4 mr-2" />
                  )}
                  {isScanning ? "Scanning..." : "Scan for Deals"}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              {service.contract_end_date && (
                <DropdownMenuItem onClick={handleAddToCalendar}>
                  <CalendarPlus className="h-4 w-4 mr-2" />
                  Add to Calendar
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Monthly Cost</p>
            <p className="text-base sm:text-lg font-bold">
              £{service.monthly_cost.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Contract Ends</p>
            <p className={`text-xs sm:text-sm font-medium ${isEnding ? "text-amber-500" : ""}`}>
              {service.contract_end_date
                ? format(new Date(service.contract_end_date), "d MMM yy")
                : "Rolling"}
            </p>
            {daysLeft !== null && daysLeft > 0 && (
              <p className="text-xs text-muted-foreground">{daysLeft}d left</p>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Savings</p>
            <p className={`text-base sm:text-lg font-bold ${service.estimated_savings_annual > 0 ? "text-success" : ""}`}>
              £{service.estimated_savings_annual.toLocaleString("en-GB", { minimumFractionDigits: 0 })}<span className="text-xs">/yr</span>
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Recommendation</p>
            {service.last_recommendation ? (
              <Badge
                variant={service.last_recommendation === "switch" ? "default" : "secondary"}
                className="mt-1"
              >
                {service.last_recommendation === "switch" ? (
                  <>
                    <TrendingDown className="h-3 w-3 mr-1" />
                    Switch
                  </>
                ) : service.last_recommendation === "dont_switch" ? (
                  "Don't Switch"
                ) : (
                  "Review"
                )}
              </Badge>
            ) : (
              <p className="text-sm text-muted-foreground">Not scanned</p>
            )}
          </div>
        </div>
        {service.last_recommendation_reason && (
          <p className="text-xs text-muted-foreground mt-3 border-t pt-3">
            {service.last_recommendation_reason}
          </p>
        )}
        
        {/* Collapsible comparison results */}
        {cheaperAlternatives.length > 0 && (
          <Collapsible open={isResultsOpen} onOpenChange={setIsResultsOpen} className="mt-3 border-t pt-3">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between">
                <span className="text-sm">
                  View {cheaperAlternatives.length} cheaper alternative{cheaperAlternatives.length !== 1 ? 's' : ''}
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform ${isResultsOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <ScanResultsPanel 
                results={serviceResults} 
                currentMonthlyCost={service.monthly_cost} 
              />
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
