import { useState, useEffect } from "react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { usePayslips, Payslip, PayslipUpdateInput } from "@/hooks/usePayslips";
import { getPayslipSignedUrl, isPayslipPdf } from "@/lib/payslipUpload";
import { format } from "date-fns";
import {
  Loader2,
  ExternalLink,
  Trash2,
  Check,
  Clock,
  XCircle,
  AlertTriangle,
  Link as LinkIcon,
  Unlink,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface PayslipPreviewDialogProps {
  payslip: Payslip | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PayslipPreviewDialog({
  payslip,
  open,
  onOpenChange,
}: PayslipPreviewDialogProps) {
  const { updatePayslip, isUpdating, matchTransaction, isMatching, deletePayslip, isDeleting } = usePayslips();
  
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState<PayslipUpdateInput>({});

  useEffect(() => {
    if (open && payslip?.file_path && payslip.file_path !== "pending") {
      setIsLoadingUrl(true);
      getPayslipSignedUrl(payslip.file_path)
        .then(setFileUrl)
        .catch(console.error)
        .finally(() => setIsLoadingUrl(false));
    } else {
      setFileUrl(null);
    }
  }, [open, payslip?.file_path]);

  useEffect(() => {
    if (payslip) {
      setEditValues({
        gross_pay: payslip.gross_pay,
        net_pay: payslip.net_pay,
        tax_deducted: payslip.tax_deducted,
        ni_deducted: payslip.ni_deducted,
        pension_deducted: payslip.pension_deducted,
        employer_name: payslip.employer_name,
      });
    }
  }, [payslip]);

  if (!payslip) return null;

  const handleSaveEdit = () => {
    updatePayslip({ id: payslip.id, updates: editValues });
    setIsEditing(false);
  };

  const handleUnmatch = () => {
    matchTransaction({ payslipId: payslip.id, transactionId: null });
  };

  const handleDelete = () => {
    deletePayslip(payslip);
    onOpenChange(false);
  };

  const getConfidenceBadge = () => {
    if (!payslip.extraction_confidence) return null;
    
    const variants: Record<string, { color: string; icon: React.ReactNode }> = {
      high: { color: "bg-green-500/10 text-green-600", icon: <Check className="h-3 w-3" /> },
      medium: { color: "bg-amber-500/10 text-amber-600", icon: <AlertTriangle className="h-3 w-3" /> },
      low: { color: "bg-red-500/10 text-red-600", icon: <XCircle className="h-3 w-3" /> },
    };
    
    const variant = variants[payslip.extraction_confidence];
    
    return (
      <Badge variant="outline" className={variant.color}>
        {variant.icon}
        <span className="ml-1 capitalize">{payslip.extraction_confidence} confidence</span>
      </Badge>
    );
  };

  const formatCurrency = (value: number | null) => {
    if (value === null) return "—";
    return `£${value.toLocaleString("en-GB", { minimumFractionDigits: 2 })}`;
  };

  const formatPayPeriod = () => {
    if (payslip.pay_period_start && payslip.pay_period_end) {
      return `${format(new Date(payslip.pay_period_start), "d MMM yyyy")} – ${format(new Date(payslip.pay_period_end), "d MMM yyyy")}`;
    }
    if (payslip.pay_period_end) {
      return format(new Date(payslip.pay_period_end), "MMMM yyyy");
    }
    return "Not extracted";
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-w-lg">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Payslip Details</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {payslip.employer_name || "Unknown employer"} • {formatPayPeriod()}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            {getConfidenceBadge()}
            <MatchStatusBadge payslip={payslip} />
          </div>

          {isEditing ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="gross_pay">Gross Pay</Label>
                  <Input
                    id="gross_pay"
                    type="number"
                    step="0.01"
                    value={editValues.gross_pay ?? ""}
                    onChange={(e) => setEditValues({ ...editValues, gross_pay: e.target.value ? parseFloat(e.target.value) : null })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="net_pay">Net Pay</Label>
                  <Input
                    id="net_pay"
                    type="number"
                    step="0.01"
                    value={editValues.net_pay ?? ""}
                    onChange={(e) => setEditValues({ ...editValues, net_pay: e.target.value ? parseFloat(e.target.value) : null })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="tax_deducted">Tax (PAYE)</Label>
                  <Input
                    id="tax_deducted"
                    type="number"
                    step="0.01"
                    value={editValues.tax_deducted ?? ""}
                    onChange={(e) => setEditValues({ ...editValues, tax_deducted: e.target.value ? parseFloat(e.target.value) : null })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ni_deducted">National Insurance</Label>
                  <Input
                    id="ni_deducted"
                    type="number"
                    step="0.01"
                    value={editValues.ni_deducted ?? ""}
                    onChange={(e) => setEditValues({ ...editValues, ni_deducted: e.target.value ? parseFloat(e.target.value) : null })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="pension_deducted">Pension</Label>
                  <Input
                    id="pension_deducted"
                    type="number"
                    step="0.01"
                    value={editValues.pension_deducted ?? ""}
                    onChange={(e) => setEditValues({ ...editValues, pension_deducted: e.target.value ? parseFloat(e.target.value) : null })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="employer_name">Employer</Label>
                  <Input
                    id="employer_name"
                    value={editValues.employer_name ?? ""}
                    onChange={(e) => setEditValues({ ...editValues, employer_name: e.target.value || null })}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveEdit} disabled={isUpdating} size="sm">
                  {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save
                </Button>
                <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div className="text-muted-foreground">Gross Pay</div>
                <div className="font-medium text-right">{formatCurrency(payslip.gross_pay)}</div>
                
                <div className="text-muted-foreground">Tax (PAYE)</div>
                <div className="font-medium text-right text-red-600">
                  {payslip.tax_deducted ? `-${formatCurrency(payslip.tax_deducted)}` : "—"}
                </div>
                
                <div className="text-muted-foreground">National Insurance</div>
                <div className="font-medium text-right text-red-600">
                  {payslip.ni_deducted ? `-${formatCurrency(payslip.ni_deducted)}` : "—"}
                </div>
                
                <div className="text-muted-foreground">Pension</div>
                <div className="font-medium text-right text-red-600">
                  {payslip.pension_deducted ? `-${formatCurrency(payslip.pension_deducted)}` : "—"}
                </div>
                
                <Separator className="col-span-2 my-1" />
                
                <div className="text-muted-foreground font-medium">Net Pay</div>
                <div className="font-bold text-right text-lg">{formatCurrency(payslip.net_pay)}</div>
              </div>

              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                Edit Values
              </Button>
            </>
          )}

          <Separator />

          <div className="flex flex-wrap gap-2">
            {fileUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {isPayslipPdf(payslip.file_path) ? "View PDF" : "View Image"}
                </a>
              </Button>
            )}
            
            {isLoadingUrl && (
              <Button variant="outline" size="sm" disabled>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </Button>
            )}

            {payslip.matched_transaction_id && (
              <Button variant="outline" size="sm" onClick={handleUnmatch} disabled={isMatching}>
                {isMatching ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Unlink className="mr-2 h-4 w-4" />
                )}
                Unlink Transaction
              </Button>
            )}

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Payslip?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete this payslip and its file. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
                    {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

function MatchStatusBadge({ payslip }: { payslip: Payslip }) {
  switch (payslip.match_status) {
    case "auto_matched":
      return (
        <Badge variant="default" className="bg-green-500/10 text-green-600">
          <LinkIcon className="h-3 w-3 mr-1" />
          Auto-matched
        </Badge>
      );
    case "manual_matched":
      return (
        <Badge variant="default" className="bg-blue-500/10 text-blue-600">
          <LinkIcon className="h-3 w-3 mr-1" />
          Linked
        </Badge>
      );
    case "no_match":
      return (
        <Badge variant="secondary">
          <XCircle className="h-3 w-3 mr-1" />
          No match
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-amber-600 border-amber-300">
          <Clock className="h-3 w-3 mr-1" />
          Pending review
        </Badge>
      );
  }
}
