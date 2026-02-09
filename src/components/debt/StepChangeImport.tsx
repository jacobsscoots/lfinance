import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Upload, AlertTriangle, CheckCircle, Loader2, FileText } from "lucide-react";
import { useDebts, Debt } from "@/hooks/useDebts";
import { useDebtPayments } from "@/hooks/useDebtPayments";
import { useDebtSnapshots } from "@/hooks/useDebtSnapshots";
import {
  parseStepChangeStatement,
  StepChangeStatement,
  StepChangeCreditor,
  StepChangeParseResult,
} from "@/lib/stepChangeParser";

interface StepChangeImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  debts: Debt[];
}

/** Match a parsed creditor to an existing debt by name similarity. */
function findMatchingDebt(
  creditor: StepChangeCreditor,
  debts: Debt[]
): Debt | null {
  const credName = creditor.creditorName.toLowerCase();
  const origName = creditor.originalCreditor.toLowerCase();

  for (const debt of debts) {
    const debtName = debt.creditor_name.toLowerCase();
    // Exact or substring match on creditor name
    if (debtName === credName || credName.includes(debtName) || debtName.includes(credName)) {
      return debt;
    }
    // Match on original creditor
    if (origName && (debtName === origName || origName.includes(debtName) || debtName.includes(origName))) {
      return debt;
    }
  }
  return null;
}

interface CreditorImportRow {
  creditor: StepChangeCreditor;
  matchedDebt: Debt | null;
  action: "update" | "create" | "skip";
  selected: boolean;
}

export function StepChangeImport({ open, onOpenChange, debts }: StepChangeImportProps) {
  const { createDebt, updateDebtBalance } = useDebts();
  const { createPayment } = useDebtPayments();
  const { createSnapshot } = useDebtSnapshots();

  const [step, setStep] = useState<"upload" | "review" | "importing" | "done">("upload");
  const [parseResult, setParseResult] = useState<StepChangeParseResult | null>(null);
  const [importRows, setImportRows] = useState<CreditorImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<{
    created: number;
    updated: number;
    payments: number;
    snapshots: number;
    errors: string[];
  } | null>(null);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const buffer = await file.arrayBuffer();
    const result = await parseStepChangeStatement(buffer);
    setParseResult(result);

    if (result.success && result.statement) {
      // Build import rows with auto-matching
      const rows: CreditorImportRow[] = result.statement.creditors.map((creditor) => {
        const matchedDebt = findMatchingDebt(creditor, debts);
        return {
          creditor,
          matchedDebt,
          action: matchedDebt ? "update" : "create",
          selected: true,
        };
      });
      setImportRows(rows);
      setStep("review");
    }
  }, [debts]);

  const handleToggleRow = (index: number) => {
    setImportRows((prev) =>
      prev.map((row, i) =>
        i === index ? { ...row, selected: !row.selected } : row
      )
    );
  };

  const handleToggleAction = (index: number) => {
    setImportRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        if (row.action === "update" && row.matchedDebt) return { ...row, action: "skip" };
        if (row.action === "skip") return { ...row, action: row.matchedDebt ? "update" : "create" };
        if (row.action === "create") return { ...row, action: "skip" };
        return row;
      })
    );
  };

  const handleImport = async () => {
    if (!parseResult?.statement) return;

    setImporting(true);
    setStep("importing");

    const stmt = parseResult.statement;
    const results = { created: 0, updated: 0, payments: 0, snapshots: 0, errors: [] as string[] };

    for (const row of importRows) {
      if (!row.selected) continue;

      try {
        if (row.action === "create") {
          // Create new debt
          const newDebt = await createDebt.mutateAsync({
            creditor_name: row.creditor.originalCreditor || row.creditor.creditorName,
            debt_type: "other",
            starting_balance: row.creditor.estimatedBalance + row.creditor.paymentsToDate,
            current_balance: row.creditor.estimatedBalance,
            interest_type: "none",
            min_payment: row.creditor.paymentThisMonth > 0 ? row.creditor.paymentThisMonth : null,
            status: row.creditor.estimatedBalance <= 0 ? "closed" : "open",
            notes: `StepChange DMP - Account: ${row.creditor.accountNumber}\nCurrent creditor: ${row.creditor.creditorName}`,
          });
          results.created++;

          // Log the payment for this month
          if (row.creditor.paymentThisMonth > 0 && newDebt?.id) {
            await createPayment.mutateAsync({
              debt_id: newDebt.id,
              payment_date: stmt.statementDate,
              amount: row.creditor.paymentThisMonth,
              category: "normal",
              notes: `StepChange DMP payment - ${stmt.statementDate}`,
            });
            results.payments++;
          }

          // Create a balance snapshot
          if (newDebt?.id) {
            await createSnapshot.mutateAsync({
              debt_id: newDebt.id,
              snapshot_date: stmt.statementDate,
              balance: row.creditor.estimatedBalance,
              source: "statement",
              notes: `StepChange statement ${stmt.statementDate}`,
            });
            results.snapshots++;
          }
        } else if (row.action === "update" && row.matchedDebt) {
          // Update existing debt balance
          await updateDebtBalance.mutateAsync({
            id: row.matchedDebt.id,
            newBalance: row.creditor.estimatedBalance,
          });
          results.updated++;

          // Log payment if > 0
          if (row.creditor.paymentThisMonth > 0) {
            await createPayment.mutateAsync({
              debt_id: row.matchedDebt.id,
              payment_date: stmt.statementDate,
              amount: row.creditor.paymentThisMonth,
              category: "normal",
              notes: `StepChange DMP payment - ${stmt.statementDate}`,
            });
            results.payments++;
          }

          // Create balance snapshot
          await createSnapshot.mutateAsync({
            debt_id: row.matchedDebt.id,
            snapshot_date: stmt.statementDate,
            balance: row.creditor.estimatedBalance,
            source: "statement",
            notes: `StepChange statement ${stmt.statementDate}`,
          });
          results.snapshots++;
        }
      } catch (err) {
        results.errors.push(
          `${row.creditor.creditorName}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    setImportResults(results);
    setImporting(false);
    setStep("done");
  };

  const resetState = () => {
    setStep("upload");
    setParseResult(null);
    setImportRows([]);
    setImportResults(null);
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) resetState();
    onOpenChange(isOpen);
  };

  const selectedCount = importRows.filter((r) => r.selected && r.action !== "skip").length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Import StepChange Statement
          </DialogTitle>
          <DialogDescription>
            Upload your StepChange DMP statement PDF to import debts, payments, and balance updates.
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Upload */}
        {step === "upload" && (
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
              <Label
                htmlFor="stepchange-upload"
                className="cursor-pointer text-primary hover:underline"
              >
                Click to upload StepChange statement PDF
              </Label>
              <Input
                id="stepchange-upload"
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={handleFileUpload}
              />
              <p className="text-sm text-muted-foreground mt-2">
                PDF files from onlinedmp.stepchange.org/MyStatements
              </p>
            </div>

            {parseResult && !parseResult.success && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{parseResult.errors.join(". ")}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Step 2: Review parsed data */}
        {step === "review" && parseResult?.statement && (
          <div className="space-y-4">
            {/* Statement summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-muted rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Statement Date</p>
                <p className="font-semibold text-sm">{parseResult.statement.statementDate}</p>
              </div>
              <div className="bg-muted rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Total Balance</p>
                <p className="font-semibold text-sm">
                  £{parseResult.statement.estimatedTotalBalance.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="bg-muted rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Monthly Payment</p>
                <p className="font-semibold text-sm">
                  £{parseResult.statement.nextPaymentAmount.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="bg-muted rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Debt Free</p>
                <p className="font-semibold text-sm">{parseResult.statement.estimatedDebtFreeDate || "N/A"}</p>
              </div>
            </div>

            {parseResult.warnings.length > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {parseResult.warnings.join(". ")}
                </AlertDescription>
              </Alert>
            )}

            {/* Creditor table */}
            <ScrollArea className="max-h-[350px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Creditor</TableHead>
                    <TableHead className="text-right">Payment</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importRows.map((row, idx) => (
                    <TableRow key={idx} className={!row.selected ? "opacity-50" : ""}>
                      <TableCell>
                        <Checkbox
                          checked={row.selected}
                          onCheckedChange={() => handleToggleRow(idx)}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">
                            {row.creditor.originalCreditor || row.creditor.creditorName}
                          </p>
                          {row.creditor.originalCreditor && row.creditor.creditorName !== row.creditor.originalCreditor && (
                            <p className="text-xs text-muted-foreground">
                              via {row.creditor.creditorName}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            Acc: {row.creditor.accountNumber}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        £{row.creditor.paymentThisMonth.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        £{row.creditor.estimatedBalance.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            row.action === "update"
                              ? "default"
                              : row.action === "create"
                              ? "secondary"
                              : "outline"
                          }
                          className="cursor-pointer"
                          onClick={() => handleToggleAction(idx)}
                        >
                          {row.action === "update"
                            ? "Update"
                            : row.action === "create"
                            ? "New"
                            : "Skip"}
                        </Badge>
                        {row.matchedDebt && row.action === "update" && (
                          <p className="text-xs text-muted-foreground mt-1">
                            → {row.matchedDebt.creditor_name}
                          </p>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-muted-foreground">
                {selectedCount} creditor{selectedCount !== 1 ? "s" : ""} selected for import
              </p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => { resetState(); }}>
                  Cancel
                </Button>
                <Button onClick={handleImport} disabled={selectedCount === 0}>
                  Import {selectedCount} Creditor{selectedCount !== 1 ? "s" : ""}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Importing */}
        {step === "importing" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Importing debts and payments...
            </p>
          </div>
        )}

        {/* Step 4: Done */}
        {step === "done" && importResults && (
          <div className="space-y-4">
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Import complete! {importResults.created} new debt{importResults.created !== 1 ? "s" : ""} created,{" "}
                {importResults.updated} updated, {importResults.payments} payment{importResults.payments !== 1 ? "s" : ""} logged,{" "}
                {importResults.snapshots} balance snapshot{importResults.snapshots !== 1 ? "s" : ""} saved.
              </AlertDescription>
            </Alert>

            {importResults.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-medium mb-1">Some items failed:</p>
                  <ul className="text-xs space-y-1">
                    {importResults.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end">
              <Button onClick={() => handleClose(false)}>Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
