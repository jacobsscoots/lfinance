import { format } from "date-fns";
import { Mail, Package, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { type EmailTrackingExtraction } from "@/hooks/useGmailTrackingSync";

function confidenceBadge(confidence: number | null) {
  if (confidence === null || confidence === 0) return <Badge variant="outline" className="text-xs">No tracking</Badge>;
  if (confidence >= 0.8) return <Badge className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">High</Badge>;
  if (confidence >= 0.5) return <Badge className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">Medium</Badge>;
  return <Badge className="text-xs bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Low</Badge>;
}

export function ExtractionLog({ extractions }: { extractions: EmailTrackingExtraction[] }) {
  const withTracking = extractions.filter((e) => e.extracted_tracking_number);

  if (withTracking.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Mail className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No tracking numbers extracted yet</p>
          <p className="text-xs mt-1">Sync your Gmail to auto-detect shipping emails</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Mail className="h-4 w-4" />
          Recent Email Extractions ({withTracking.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y max-h-[400px] overflow-y-auto">
          {withTracking.slice(0, 20).map((e) => (
            <div key={e.id} className="px-6 py-3 flex items-start gap-3">
              <Package className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs truncate">{e.extracted_tracking_number}</span>
                  {confidenceBadge(e.parse_confidence)}
                  {e.created_shipment_id && (
                    <Badge variant="secondary" className="text-xs gap-0.5">
                      <Package className="h-3 w-3" /> Tracked
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{e.subject}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {e.extracted_carrier_code && (
                    <span className="text-xs text-muted-foreground capitalize">
                      {e.extracted_carrier_code.replace(/-/g, " ")}
                    </span>
                  )}
                  {e.received_at && (
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(e.received_at), "d MMM yyyy")}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
