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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useDebtTransactions } from "@/hooks/useDebtTransactions";
import { parseTransactionCsv, detectColumnMappings, CsvColumnMapping } from "@/lib/debtCsvParser";
import { Upload, AlertTriangle, CheckCircle } from "lucide-react";

interface TransactionCsvImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TransactionCsvImport({ open, onOpenChange }: TransactionCsvImportProps) {
  const { createTransactions } = useDebtTransactions();
  const [csvContent, setCsvContent] = useState<string>('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<CsvColumnMapping>({
    date: '',
    amount: '',
    description: '',
  });
  const [parseResult, setParseResult] = useState<{
    success: boolean;
    count: number;
    warnings: string[];
    errors: string[];
  } | null>(null);
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview'>('upload');

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCsvContent(content);
      
      // Parse headers
      const lines = content.trim().split('\n');
      if (lines.length > 0) {
        const headerLine = lines[0];
        const parsedHeaders = headerLine.split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        setHeaders(parsedHeaders);
        
        // Try to auto-detect mappings
        const detected = detectColumnMappings(parsedHeaders);
        if (detected) {
          setMapping(detected);
        }
        
        setStep('mapping');
      }
    };
    reader.readAsText(file);
  }, []);

  const handlePreview = () => {
    if (!mapping.date || !mapping.amount || !mapping.description) {
      return;
    }

    const result = parseTransactionCsv(csvContent, mapping);
    setParseResult({
      success: result.success,
      count: result.transactions.length,
      warnings: result.warnings,
      errors: result.errors,
    });
    setStep('preview');
  };

  const handleImport = async () => {
    if (!parseResult?.success) return;

    const result = parseTransactionCsv(csvContent, mapping);
    if (result.transactions.length > 0) {
      await createTransactions.mutateAsync(result.transactions);
      onOpenChange(false);
      resetState();
    }
  };

  const resetState = () => {
    setCsvContent('');
    setHeaders([]);
    setMapping({ date: '', amount: '', description: '' });
    setParseResult(null);
    setStep('upload');
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      resetState();
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Import Transactions from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file with your bank transactions to import them.
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
              <Label 
                htmlFor="csv-upload" 
                className="cursor-pointer text-primary hover:underline"
              >
                Click to upload CSV file
              </Label>
              <Input
                id="csv-upload"
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileUpload}
              />
              <p className="text-sm text-muted-foreground mt-2">
                CSV files only
              </p>
            </div>
          </div>
        )}

        {step === 'mapping' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Map your CSV columns to transaction fields:
            </p>

            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3 items-center">
                <Label>Date Column *</Label>
                <Select 
                  value={mapping.date} 
                  onValueChange={(v) => setMapping(m => ({ ...m, date: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    {headers.map(h => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3 items-center">
                <Label>Amount Column *</Label>
                <Select 
                  value={mapping.amount} 
                  onValueChange={(v) => setMapping(m => ({ ...m, amount: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    {headers.map(h => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3 items-center">
                <Label>Description Column *</Label>
                <Select 
                  value={mapping.description} 
                  onValueChange={(v) => setMapping(m => ({ ...m, description: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    {headers.map(h => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3 items-center">
                <Label>Reference Column</Label>
                <Select 
                  value={mapping.reference || ''} 
                  onValueChange={(v) => setMapping(m => ({ ...m, reference: v || undefined }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="(Optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {headers.map(h => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setStep('upload')}>
                Back
              </Button>
              <Button 
                onClick={handlePreview}
                disabled={!mapping.date || !mapping.amount || !mapping.description}
              >
                Preview
              </Button>
            </div>
          </div>
        )}

        {step === 'preview' && parseResult && (
          <div className="space-y-4">
            {parseResult.errors.length > 0 ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {parseResult.errors.join('. ')}
                </AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Found {parseResult.count} transactions ready to import.
                </AlertDescription>
              </Alert>
            )}

            {parseResult.warnings.length > 0 && (
              <div className="bg-amber-500/10 rounded-lg p-3 max-h-32 overflow-y-auto">
                <p className="text-sm font-medium text-amber-600 mb-1">Warnings:</p>
                <ul className="text-xs text-amber-600 space-y-1">
                  {parseResult.warnings.slice(0, 10).map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                  {parseResult.warnings.length > 10 && (
                    <li>...and {parseResult.warnings.length - 10} more</li>
                  )}
                </ul>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setStep('mapping')}>
                Back
              </Button>
              <Button 
                onClick={handleImport}
                disabled={!parseResult.success || parseResult.count === 0 || createTransactions.isPending}
              >
                Import {parseResult.count} Transactions
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
