import { useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePayslips, Payslip } from "@/hooks/usePayslips";
import { format } from "date-fns";
import { FileText, Upload, Loader2, Check, Clock, XCircle, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface PayslipSettingsProps {
  onViewPayslip: (payslip: Payslip) => void;
}

export function PayslipSettings({ onViewPayslip }: PayslipSettingsProps) {
  const { payslips, isLoading, uploadPayslip, isUploading } = usePayslips();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadPayslip(file);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const getStatusBadge = (payslip: Payslip) => {
    switch (payslip.match_status) {
      case "auto_matched":
        return (
          <Badge variant="default" className="bg-green-500/10 text-green-600 hover:bg-green-500/20">
            <Check className="h-3 w-3 mr-1" />
            Auto-matched
          </Badge>
        );
      case "manual_matched":
        return (
          <Badge variant="default" className="bg-blue-500/10 text-blue-600 hover:bg-blue-500/20">
            <Check className="h-3 w-3 mr-1" />
            Matched
          </Badge>
        );
      case "no_match":
        return (
          <Badge variant="secondary" className="bg-muted">
            <XCircle className="h-3 w-3 mr-1" />
            No match
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-amber-600 border-amber-300">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
    }
  };

  const formatPayPeriod = (payslip: Payslip) => {
    if (payslip.pay_period_start && payslip.pay_period_end) {
      return `${format(new Date(payslip.pay_period_start), "d MMM")} - ${format(new Date(payslip.pay_period_end), "d MMM yyyy")}`;
    }
    if (payslip.pay_period_end) {
      return format(new Date(payslip.pay_period_end), "MMMM yyyy");
    }
    return format(new Date(payslip.uploaded_at), "MMMM yyyy");
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Payslips
        </CardTitle>
        <CardDescription>
          Upload payslips to extract pay details and automatically match to income transactions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={handleFileSelect}
            className="hidden"
            disabled={isUploading}
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            {isUploading ? "Uploading..." : "Upload Payslip"}
          </Button>
          <p className="text-sm text-muted-foreground mt-2">
            Supports JPG, PNG, WebP images and PDF files (max 10MB)
          </p>
        </div>

        {payslips.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm text-muted-foreground">Recent Payslips</h4>
            <div className="space-y-2">
              {payslips.map((payslip) => (
                <button
                  key={payslip.id}
                  onClick={() => onViewPayslip(payslip)}
                  className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">
                        {formatPayPeriod(payslip)}
                      </span>
                      {payslip.employer_name && (
                        <span className="text-sm text-muted-foreground truncate">
                          • {payslip.employer_name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      {payslip.net_pay && (
                        <span className="text-sm font-medium">
                          £{payslip.net_pay.toLocaleString("en-GB", { minimumFractionDigits: 2 })} net
                        </span>
                      )}
                      {getStatusBadge(payslip)}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {payslips.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No payslips uploaded yet</p>
            <p className="text-sm">Upload your first payslip to get started</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
