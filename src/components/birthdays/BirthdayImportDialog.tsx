import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface ImportRow {
  person_name: string;
  occasion: string;
  event_month: number;
  event_day: number | null;
  budget: number;
  expenses?: Array<{ description: string; amount: number; year: number }>;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (rows: ImportRow[]) => void;
  isImporting: boolean;
}

const MONTH_MAP: Record<string, number> = {
  january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3,
  april: 4, apr: 4, may: 5, june: 6, jun: 6,
  july: 7, jul: 7, august: 8, aug: 8, september: 9, sep: 9, sept: 9,
  october: 10, oct: 10, november: 11, nov: 11, december: 12, dec: 12,
};

function parseMonth(val: any): number | null {
  if (!val) return null;
  const n = Number(val);
  if (!isNaN(n) && n >= 1 && n <= 12) return n;
  const str = String(val).toLowerCase().trim();
  return MONTH_MAP[str] || null;
}

function parseDay(val: any): number | null {
  if (!val) return null;
  const n = Number(val);
  if (!isNaN(n) && n >= 1 && n <= 31) return Math.floor(n);
  return null;
}

export function BirthdayImportDialog({ open, onOpenChange, onImport, isImporting }: Props) {
  const [preview, setPreview] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws);

        const parsed: ImportRow[] = [];
        const currentYear = new Date().getFullYear();

        for (const row of rows) {
          // Try to find name column
          const name = row["Name"] || row["name"] || row["Person"] || row["person"] || row["Person Name"] || row["person_name"];
          if (!name) continue;

          // Find month
          const monthRaw = row["Month"] || row["month"] || row["Event Month"] || row["event_month"];
          const month = parseMonth(monthRaw);
          if (!month) continue;

          // Find day
          const dayRaw = row["Day"] || row["day"] || row["Event Day"] || row["event_day"] || row["Date"];
          const day = parseDay(dayRaw);

          // Find occasion
          const occasionRaw = String(row["Occasion"] || row["occasion"] || row["Type"] || row["type"] || "birthday").toLowerCase().trim();
          const occasion = ["birthday", "christmas", "anniversary", "other"].includes(occasionRaw) ? occasionRaw : "birthday";

          // Find budget
          const budgetRaw = row["Budget"] || row["budget"] || 0;
          const budget = parseFloat(String(budgetRaw).replace(/[£$,]/g, "")) || 0;

          // Find cost/amount (inline expense)
          const costRaw = row["Cost"] || row["cost"] || row["Amount"] || row["amount"] || row["Total"] || row["total"];
          const cost = costRaw ? parseFloat(String(costRaw).replace(/[£$,]/g, "")) || 0 : 0;

          // Find item description
          const itemDesc = row["Item"] || row["item"] || row["Description"] || row["description"] || row["Gift"] || row["gift"];

          const expenses: ImportRow["expenses"] = [];
          if (cost > 0 && itemDesc) {
            expenses.push({ description: String(itemDesc), amount: cost, year: currentYear });
          } else if (cost > 0) {
            expenses.push({ description: "Gift", amount: cost, year: currentYear });
          }

          parsed.push({
            person_name: String(name).trim(),
            occasion,
            event_month: month,
            event_day: day,
            budget,
            expenses: expenses.length > 0 ? expenses : undefined,
          });
        }

        setPreview(parsed);
        if (parsed.length === 0) {
          toast.error("No valid rows found. Need at least Name and Month columns.");
        }
      } catch (err) {
        toast.error("Failed to parse file");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImport = () => {
    onImport(preview);
    setPreview([]);
    setFileName("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader className="pr-8">
          <DialogTitle>Import Birthdays & Occasions</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Upload an Excel file with columns: <strong>Name</strong>, <strong>Month</strong>, and optionally Day, Occasion, Budget, Item, Cost.
          </p>

          <div className="border-2 border-dashed rounded-lg p-6 text-center">
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
            <FileSpreadsheet className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            {fileName ? (
              <p className="text-sm font-medium">{fileName}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Drop or click to select</p>
            )}
            <Button variant="outline" size="sm" className="mt-2" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4 mr-1" />
              Choose File
            </Button>
          </div>

          {preview.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">{preview.length} event(s) found:</p>
              <div className="max-h-48 overflow-y-auto space-y-1 text-sm">
                {preview.map((r, i) => (
                  <div key={i} className="flex justify-between p-2 rounded bg-muted/50">
                    <span>{r.person_name} ({r.occasion})</span>
                    <span className="text-muted-foreground">
                      {r.event_day ? `${r.event_day}/` : ""}{r.event_month}
                      {r.budget > 0 ? ` · £${r.budget}` : ""}
                      {r.expenses?.[0] ? ` · £${r.expenses[0].amount}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleImport} disabled={preview.length === 0 || isImporting}>
              {isImporting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Import {preview.length} Event{preview.length !== 1 ? "s" : ""}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
