import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { readWorkbook, sheetToJson } from "@/lib/excelImportParser";

interface ImportRow {
  person_name: string;
  occasion: string;
  event_month: number;
  event_day: number | null;
  budget: number;
  title?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  postcode?: string | null;
  country?: string | null;
  money_scheduled?: boolean | null;
  card_sent?: boolean | null;
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

function parseDateValue(val: any): { month: number | null; day: number | null } {
  if (!val) return { month: null, day: null };

  // Date object (ExcelJS returns Date objects for date cells)
  if (val instanceof Date) {
    return { month: val.getMonth() + 1, day: val.getDate() };
  }

  const str = String(val).trim();
  // Try DD/MM or DD/MM/YYYY
  const slashMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-]\d{2,4})?$/);
  if (slashMatch) {
    const day = parseInt(slashMatch[1], 10);
    const month = parseInt(slashMatch[2], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { month, day };
    }
  }

  return { month: null, day: null };
}

export function BirthdayImportDialog({ open, onOpenChange, onImport, isImporting }: Props) {
  const [preview, setPreview] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      let wb: Awaited<ReturnType<typeof readWorkbook>>;
      try {
        wb = await readWorkbook(buffer);
      } catch (parseErr: any) {
        console.error("Excel parse error:", parseErr);
        toast.error(`Could not read file: ${parseErr?.message || "unsupported format"}`);
        return;
      }
      const ws = wb.worksheets[0];
      if (!ws) {
        toast.error("No worksheet found in the file");
        return;
      }
      const rows = sheetToJson<Record<string, any>>(ws);
      console.log("Parsed rows:", rows.length, "Sample:", rows[0]);

      const parsed: ImportRow[] = [];
      const currentYear = new Date().getFullYear();

      for (const row of rows) {
        // Flexible name detection: "Name", "Person", or "First Name" + "Last Name"
        let name = row["Name"] || row["name"] || row["Person"] || row["person"] || row["Person Name"] || row["person_name"];
        if (!name) {
          const first = row["First Name"] || row["first name"] || row["FirstName"] || row["First name"] || "";
          const last = row["Last Name"] || row["last name"] || row["LastName"] || row["Last name"] || row["Surname"] || row["surname"] || "";
          if (first || last) {
            name = `${first} ${last}`.trim();
          }
        }
        if (!name) continue;

        // Try "Birthday" column first (DD/MM or DD/MM/YYYY format)
        const birthdayRaw = row["Birthday"] || row["birthday"] || row["DOB"] || row["dob"] || row["Date of Birth"] || row["Birth Date"];
        let month: number | null = null;
        let day: number | null = null;

        if (birthdayRaw) {
          const parsed = parseDateValue(birthdayRaw);
          month = parsed.month;
          day = parsed.day;
        }

        // Fall back to separate Month / Day columns
        if (!month) {
          const monthRaw = row["Month"] || row["month"] || row["Event Month"] || row["event_month"];
          month = parseMonth(monthRaw);
        }
        if (!month) continue;

        if (!day) {
          const dayRaw = row["Day"] || row["day"] || row["Event Day"] || row["event_day"] || row["Date"];
          day = parseDay(dayRaw);
        }

        // Find occasion
        const occasionRaw = String(row["Occasion"] || row["occasion"] || row["Type"] || row["type"] || "birthday").toLowerCase().trim();
        const occasion = ["birthday", "christmas", "anniversary", "other"].includes(occasionRaw) ? occasionRaw : "birthday";

        // Find budget — check multiple column names
        const budgetRaw = row["Budget"] || row["budget"] || row["Amount to give?"] || row["Amount to Give"] || row["Amount"] || row["amount"] || 0;
        const budget = parseFloat(String(budgetRaw).replace(/[£$,]/g, "")) || 0;

        // Find cost/amount (inline expense)
        const costRaw = row["Cost"] || row["cost"] || row["Total"] || row["total"];
        const cost = costRaw ? parseFloat(String(costRaw).replace(/[£$,]/g, "")) || 0 : 0;

        // Find item description
        const itemDesc = row["Item"] || row["item"] || row["Description"] || row["description"] || row["Gift"] || row["gift"];

        const expenses: ImportRow["expenses"] = [];
        if (cost > 0 && itemDesc) {
          expenses.push({ description: String(itemDesc), amount: cost, year: currentYear });
        } else if (cost > 0) {
          expenses.push({ description: "Gift", amount: cost, year: currentYear });
        }

        // Address fields
        const title = row["Title"] || row["title"] || null;
        const address_line1 = row["Address 1"] || row["Address1"] || row["address_line1"] || row["Address"] || null;
        const address_line2 = row["Address 2"] || row["Address2"] || row["address_line2"] || null;
        const city = row["City"] || row["city"] || row["Town"] || null;
        const state = row["State"] || row["state"] || row["County"] || null;
        const postcode = row["Zip"] || row["zip"] || row["Postcode"] || row["postcode"] || row["Post Code"] || null;
        const country = row["Country"] || row["country"] || null;

        // Status checkboxes
        const moneyRaw = row["Money Scheduled?"] || row["Money Scheduled"] || row["money_scheduled"];
        const money_scheduled = moneyRaw ? String(moneyRaw).toUpperCase() === "TRUE" : false;
        const cardRaw = row["Card Sent?"] || row["Card Sent"] || row["card_sent"];
        const card_sent = cardRaw ? String(cardRaw).toUpperCase() === "TRUE" : false;

        parsed.push({
          person_name: String(name).trim(),
          occasion,
          event_month: month,
          event_day: day,
          budget,
          title: title ? String(title).trim() : null,
          address_line1: address_line1 ? String(address_line1).trim() : null,
          address_line2: address_line2 ? String(address_line2).trim() : null,
          city: city ? String(city).trim() : null,
          state: state ? String(state).trim() : null,
          postcode: postcode ? String(postcode).trim() : null,
          country: country ? String(country).trim() : null,
          money_scheduled,
          card_sent,
          expenses: expenses.length > 0 ? expenses : undefined,
        });
      }

      setPreview(parsed);
      if (parsed.length === 0) {
        toast.error("No valid rows found. Need at least Name and Month columns.");
      }
    } catch (err: any) {
      console.error("Import parse error:", err);
      toast.error(err?.message || "Failed to parse file");
    }
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
            Upload an Excel file with columns like <strong>Name</strong> (or First/Last Name), <strong>Birthday</strong> (DD/MM), and optionally Budget or Amount to give.
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
