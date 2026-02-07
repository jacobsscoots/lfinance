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
  MoreVertical,
  Pencil,
  Trash2,
  Calendar,
  CalendarPlus,
  Zap,
  Wifi,
  Smartphone,
  Shield,
  Tv,
  TrendingDown,
} from "lucide-react";
import { TrackedService } from "@/hooks/useTrackedServices";
import { daysUntilContractEnd, generateIcsContent } from "@/lib/billsCalculations";

interface ServiceCardProps {
  service: TrackedService;
  onEdit: () => void;
  onDelete: () => void;
  onToggleTracking: (enabled: boolean) => void;
}

const serviceIcons: Record<string, any> = {
  energy: Zap,
  broadband: Wifi,
  mobile: Smartphone,
  insurance: Shield,
  streaming: Tv,
};

export function ServiceCard({ service, onEdit, onDelete, onToggleTracking }: ServiceCardProps) {
  const Icon = serviceIcons[service.service_type] || Zap;
  const daysLeft = daysUntilContractEnd(service.contract_end_date);
  const isEnding = daysLeft !== null && daysLeft <= 30;

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
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              {service.provider}
              <Badge variant="outline" className="capitalize text-xs">
                {service.service_type}
              </Badge>
            </CardTitle>
            {service.plan_name && (
              <p className="text-sm text-muted-foreground">{service.plan_name}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Monthly Cost</p>
            <p className="text-lg font-bold">
              £{service.monthly_cost.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Contract Ends</p>
            <p className={`text-sm font-medium ${isEnding ? "text-amber-500" : ""}`}>
              {service.contract_end_date
                ? format(new Date(service.contract_end_date), "d MMM yyyy")
                : "Rolling"}
            </p>
            {daysLeft !== null && daysLeft > 0 && (
              <p className="text-xs text-muted-foreground">{daysLeft} days left</p>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Potential Savings</p>
            <p className={`text-lg font-bold ${service.estimated_savings_annual > 0 ? "text-success" : ""}`}>
              £{service.estimated_savings_annual.toLocaleString("en-GB", { minimumFractionDigits: 0 })}/yr
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
      </CardContent>
    </Card>
  );
}
