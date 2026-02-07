import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, AlertTriangle } from "lucide-react";
import { daysUntilContractEnd } from "@/lib/billsCalculations";
import { TrackedService } from "@/hooks/useTrackedServices";

interface NextContractCardProps {
  service: TrackedService | null;
}

export function NextContractCard({ service }: NextContractCardProps) {
  if (!service || !service.contract_end_date) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Next Contract Ending
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-lg font-medium text-muted-foreground">
            No contracts tracked
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Add services with end dates to track renewals
          </p>
        </CardContent>
      </Card>
    );
  }

  const daysLeft = daysUntilContractEnd(service.contract_end_date);
  const isUrgent = daysLeft !== null && daysLeft <= 30;

  return (
    <Card className={isUrgent ? "border-amber-500/50" : ""}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Next Contract Ending
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold">{service.provider}</span>
          <Badge variant="outline" className="capitalize">
            {service.service_type}
          </Badge>
        </div>
        <div className="flex items-center gap-1 mt-1">
          {isUrgent && <AlertTriangle className="h-3 w-3 text-amber-500" />}
          <p className={`text-sm ${isUrgent ? "text-amber-500 font-medium" : "text-muted-foreground"}`}>
            {daysLeft !== null
              ? daysLeft <= 0
                ? "Contract ended"
                : `${daysLeft} days left`
              : "No end date"}
          </p>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Ends: {new Date(service.contract_end_date).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </p>
      </CardContent>
    </Card>
  );
}
