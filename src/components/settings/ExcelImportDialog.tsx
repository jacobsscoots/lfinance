import { useState, useCallback } from "react";
import * as XLSX from "xlsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { SampleTemplateDownload } from "./SampleTemplateDownload";
import {
  findSettingsSheet,
  sheetToGrid,
  extractTables,
  assignSections,
  type ExtractedTable,
  type AssignedSections,
  type LayoutType,
  detectLayout,
} from "@/lib/excelImportParser";
import {
  autoDetectMapping,
  validateRow,
  normaliseBillRow,
  normaliseDebtRow,
  buildBillImportKey,
  buildDebtImportKey,
  findBillDuplicates,
  findDebtDuplicates,
  buildMappingSignature,
  BILL_FIELDS,
  DEBT_FIELDS,
  type FieldMapping,
  type TargetField,
  type DuplicateMatch,
} from "@/lib/excelFieldMapping";
import { useBills } from "@/hooks/useBills";
import { useDebts } from "@/hooks/useDebts";
import { useImportLogs } from "@/hooks/useImportLogs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";

type Step = "upload" | "detect" | "mapping" | "preview" | "importing" | "done";
type DuplicateAction = "skip" | "update" | "import_new";

interface ProcessedRow {
  raw: Record<string, string>;
  normalised: Record<string, any>;
  importKey: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
  duplicate?: DuplicateMatch;
  duplicateAction: DuplicateAction;
}

interface SectionData {
  table: ExtractedTable;
  mapping: FieldMapping;
  rows: ProcessedRow[];
  fields: TargetField[];
}

interface ImportResults {
  bills: { added: number; updated: number; skipped: number };
  subs: { added: number; updated: number; skipped: number };
  debts: { added: number; updated: number; skipped: number };
}

interface ExcelImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSection?: "bills" | "debts";
  onComplete?: () => void;
}

export function ExcelImportDialog({
  open,
  onOpenChange,
  initialSection,
  onComplete,
}: ExcelImportDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { bills } = useBills();
  const { debts } = useDebts();
  const { createLog } = useImportLogs();

  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [sheetName, setSheetName] = useState<string | null>(null);
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [layoutDetected, setLayoutDetected] = useState<LayoutType>("UNKNOWN");
  const [sections, setSections] = useState<AssignedSections>({
    bills: null,
    subscriptions: null,
    debts: null,
  });

  const [billsData, setBillsData] = useState<SectionData | null>(null);
  const [subsData, setSubsData] = useState<SectionData | null>(null);
  const [debtsData, setDebtsData] = useState<SectionData | null>(null);

  const [importProgress, setImportProgress] = useState(0);
  const [results, setResults] = useState<ImportResults | null>(null);

  const resetState = useCallback(() => {
    setStep("upload");
    setFileName("");
    setSheetName(null);
    setAvailableSheets([]);
    setLayoutDetected("UNKNOWN");
    setSections({ bills: null, subscriptions: null, debts: null });
    setBillsData(null);
    setSubsData(null);
    setDebtsData(null);
    setImportProgress(0);
    setResults(null);
  }, []);

  const handleClose = useCallback(() => {
    onOpenChange(false);
    setTimeout(resetState, 300);
  }, [onOpenChange, resetState]);

  // --- Step 1: Upload ---
  const handleFileUpload = useCallback(
    (file: File) => {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const { sheetName: found, availableSheets: sheets } = findSettingsSheet(workbook);

          setAvailableSheets(sheets);

          if (!found) {
            toast.error(
              `Couldn't find a Settings sheet. Available sheets: ${sheets.join(", ")}`,
              { duration: 6000 }
            );
            return;
          }

          setSheetName(found);
          const sheet = workbook.Sheets[found];
          const grid = sheetToGrid(sheet);
          const layout = detectLayout(grid);
          setLayoutDetected(layout);

          const tables = extractTables(grid);
          const assigned = assignSections(tables);
          setSections(assigned);
          setStep("detect");
        } catch (err) {
          console.error("Parse error:", err);
          toast.error(
            file.name.endsWith(".xls")
              ? "Failed to parse .xls file. Please save as .xlsx and try again."
              : "Failed to parse file. Please check it's a valid Excel file."
          );
        }
      };
      reader.readAsArrayBuffer(file);
    },
    []
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFileUpload(file);
    },
    [handleFileUpload]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFileUpload(file);
    },
    [handleFileUpload]
  );

  // --- Step 2 → 3: Detect → Mapping ---
  const handleProceedToMapping = useCallback(() => {
    const loadSection = (
      table: ExtractedTable | null,
      fields: TargetField[],
      isSubscription: boolean,
      existingItems: any[],
      buildKey: (d: any) => string,
      normalise: (d: any) => any,
      findDups: (rows: any[], existing: any[]) => DuplicateMatch[]
    ): SectionData | null => {
      if (!table || table.rows.length === 0) return null;

      // Check localStorage for saved mapping
      const sig = table.headers.join(",");
      const savedKey = `excel-import-mapping-v2:${sig}`;
      const savedMapping = localStorage.getItem(savedKey);
      const mapping = savedMapping
        ? JSON.parse(savedMapping)
        : autoDetectMapping(table.headers, fields);

      // Validate and normalise rows
      const validated: ProcessedRow[] = table.rows.map((row) => {
        const vr = validateRow(row, mapping, fields);
        const normalised = vr.valid ? normalise(vr.data) : vr.data;
        if (isSubscription && normalised) normalised.is_subscription = true;
        const importKey = vr.valid ? buildKey(normalised) : "";
        return {
          raw: row,
          normalised,
          importKey,
          valid: vr.valid,
          errors: vr.errors,
          warnings: vr.warnings,
          duplicate: undefined,
          duplicateAction: "skip" as DuplicateAction,
        };
      });

      // Find duplicates
      const dups = findDups(
        validated.filter((r) => r.valid).map((r) => ({
          importKey: r.importKey,
          data: r.normalised,
        })),
        existingItems
      );

      dups.forEach((d) => {
        const validRows = validated.filter((r) => r.valid);
        if (validRows[d.rowIndex]) {
          validRows[d.rowIndex].duplicate = d;
          validRows[d.rowIndex].duplicateAction = "update";
        }
      });

      return { table, mapping, rows: validated, fields };
    };

    setBillsData(
      loadSection(
        sections.bills,
        BILL_FIELDS,
        false,
        bills.map((b) => ({ ...b, import_key: (b as any).import_key })),
        buildBillImportKey,
        normaliseBillRow,
        findBillDuplicates
      )
    );

    setSubsData(
      loadSection(
        sections.subscriptions,
        BILL_FIELDS,
        true,
        bills.filter((b) => (b as any).is_subscription).map((b) => ({ ...b, import_key: (b as any).import_key })),
        buildBillImportKey,
        (d) => ({ ...normaliseBillRow(d), is_subscription: true }),
        findBillDuplicates
      )
    );

    setDebtsData(
      loadSection(
        sections.debts,
        DEBT_FIELDS,
        false,
        debts.map((d) => ({ ...d, import_key: (d as any).import_key })),
        buildDebtImportKey,
        normaliseDebtRow,
        findDebtDuplicates
      )
    );

    setStep("mapping");
  }, [sections, bills, debts]);

  // --- Update mapping for a section ---
  const updateMapping = (
    section: "bills" | "subs" | "debts",
    header: string,
    targetKey: string
  ) => {
    const setter =
      section === "bills" ? setBillsData : section === "subs" ? setSubsData : setDebtsData;
    const current =
      section === "bills" ? billsData : section === "subs" ? subsData : debtsData;
    if (!current) return;
    setter({ ...current, mapping: { ...current.mapping, [header]: targetKey } });
  };

  // --- Save mapping and proceed to preview ---
  const handleProceedToPreview = useCallback(() => {
    // Re-validate with updated mappings
    const revalidate = (
      sd: SectionData | null,
      normalise: (d: any) => any,
      buildKey: (d: any) => string,
      isSubscription: boolean
    ): SectionData | null => {
      if (!sd) return null;

      // Save mapping to localStorage
      const sig = sd.table.headers.join(",");
      localStorage.setItem(`excel-import-mapping-v2:${sig}`, JSON.stringify(sd.mapping));

      const rows = sd.table.rows.map((row) => {
        const vr = validateRow(row, sd.mapping, sd.fields);
        const normalised = vr.valid ? normalise(vr.data) : vr.data;
        if (isSubscription && normalised) normalised.is_subscription = true;
        const importKey = vr.valid ? buildKey(normalised) : "";
        return {
          raw: row,
          normalised,
          importKey,
          valid: vr.valid,
          errors: vr.errors,
          warnings: vr.warnings,
          duplicate: undefined as DuplicateMatch | undefined,
          duplicateAction: "skip" as DuplicateAction,
        };
      });

      return { ...sd, rows };
    };

    setBillsData((prev) => revalidate(prev, normaliseBillRow, buildBillImportKey, false));
    setSubsData((prev) => revalidate(prev, (d) => ({ ...normaliseBillRow(d), is_subscription: true }), buildBillImportKey, true));
    setDebtsData((prev) => revalidate(prev, normaliseDebtRow, buildDebtImportKey, false));

    setStep("preview");
  }, [billsData, subsData, debtsData]);

  // --- Duplicate action ---
  const setDuplicateAction = (
    section: "bills" | "subs" | "debts",
    rowIdx: number,
    action: DuplicateAction
  ) => {
    const setter =
      section === "bills" ? setBillsData : section === "subs" ? setSubsData : setDebtsData;
    const current =
      section === "bills" ? billsData : section === "subs" ? subsData : debtsData;
    if (!current) return;
    const rows = [...current.rows];
    rows[rowIdx] = { ...rows[rowIdx], duplicateAction: action };
    setter({ ...current, rows });
  };

  // --- Step 5: Import ---
  const handleImport = useCallback(async () => {
    if (!user) return;
    setStep("importing");
    setImportProgress(0);

    const res: ImportResults = {
      bills: { added: 0, updated: 0, skipped: 0 },
      subs: { added: 0, updated: 0, skipped: 0 },
      debts: { added: 0, updated: 0, skipped: 0 },
    };

    const allBillRows = [
      ...(billsData?.rows.filter((r) => r.valid) ?? []).map((r) => ({
        ...r,
        section: "bills" as const,
      })),
      ...(subsData?.rows.filter((r) => r.valid) ?? []).map((r) => ({
        ...r,
        section: "subs" as const,
      })),
    ];

    const debtRows = debtsData?.rows.filter((r) => r.valid) ?? [];
    const totalRows = allBillRows.length + debtRows.length;
    let processed = 0;

    // Import bills + subs
    for (const row of allBillRows) {
      const counter = row.section === "bills" ? res.bills : res.subs;

      if (row.duplicate) {
        if (row.duplicateAction === "skip") {
          counter.skipped++;
          processed++;
          setImportProgress(Math.round((processed / totalRows) * 100));
          continue;
        }
        if (row.duplicateAction === "update") {
          const { error } = await supabase
            .from("bills")
            .update({ ...row.normalised, import_key: row.importKey })
            .eq("id", row.duplicate.existingId);
          if (!error) counter.updated++;
          else counter.skipped++;
          processed++;
          setImportProgress(Math.round((processed / totalRows) * 100));
          continue;
        }
      }

      // Insert new
      const insertData = {
        ...row.normalised,
        user_id: user.id,
        import_key: row.importKey,
      } as any;
      const { error } = await supabase
        .from("bills")
        .insert([insertData]);
      if (!error) counter.added++;
      else counter.skipped++;
      processed++;
      setImportProgress(Math.round((processed / totalRows) * 100));
    }

    // Import debts
    for (const row of debtRows) {
      if (row.duplicate) {
        if (row.duplicateAction === "skip") {
          res.debts.skipped++;
          processed++;
          setImportProgress(Math.round((processed / totalRows) * 100));
          continue;
        }
        if (row.duplicateAction === "update") {
          const { error } = await supabase
            .from("debts")
            .update({ ...row.normalised, import_key: row.importKey })
            .eq("id", row.duplicate.existingId);
          if (!error) res.debts.updated++;
          else res.debts.skipped++;
          processed++;
          setImportProgress(Math.round((processed / totalRows) * 100));
          continue;
        }
      }

      const debtInsertData = {
        ...row.normalised,
        user_id: user.id,
        import_key: row.importKey,
      } as any;
      const { error } = await supabase
        .from("debts")
        .insert([debtInsertData]);
      if (!error) res.debts.added++;
      else res.debts.skipped++;
      processed++;
      setImportProgress(Math.round((processed / totalRows) * 100));
    }

    setResults(res);

    // Log the import
    createLog.mutate({
      file_name: fileName,
      settings_sheet_name: sheetName,
      layout_detected: layoutDetected,
      mapping_signature: billsData
        ? buildMappingSignature(billsData.table.headers, billsData.mapping)
        : null,
      bills_added: res.bills.added,
      bills_updated: res.bills.updated,
      bills_skipped: res.bills.skipped,
      subs_added: res.subs.added,
      subs_updated: res.subs.updated,
      subs_skipped: res.subs.skipped,
      debts_added: res.debts.added,
      debts_updated: res.debts.updated,
      debts_skipped: res.debts.skipped,
      details: {
        totalRows: totalRows,
        sectionsFound: {
          bills: billsData?.rows.length ?? 0,
          subs: subsData?.rows.length ?? 0,
          debts: debtRows.length,
        },
      },
    });

    // Invalidate queries
    queryClient.invalidateQueries({ queryKey: ["bills"] });
    queryClient.invalidateQueries({ queryKey: ["debts"] });

    setStep("done");
    toast.success("Import completed!");
  }, [user, billsData, subsData, debtsData, fileName, sheetName, layoutDetected, createLog, queryClient]);

  // --- Summary counts ---
  const getSummary = () => {
    const count = (sd: SectionData | null) => {
      if (!sd) return { toAdd: 0, toUpdate: 0, toSkip: 0, errors: 0 };
      const valid = sd.rows.filter((r) => r.valid);
      const invalid = sd.rows.filter((r) => !r.valid);
      const toAdd = valid.filter((r) => !r.duplicate || r.duplicateAction === "import_new").length;
      const toUpdate = valid.filter((r) => r.duplicate && r.duplicateAction === "update").length;
      const toSkip = valid.filter((r) => r.duplicate && r.duplicateAction === "skip").length;
      return { toAdd, toUpdate, toSkip, errors: invalid.length };
    };
    return {
      bills: count(billsData),
      subs: count(subsData),
      debts: count(debtsData),
    };
  };

  const hasBlockingErrors = () => {
    const check = (sd: SectionData | null) => {
      if (!sd) return false;
      return sd.rows.some((r) => !r.valid);
    };
    return check(billsData) || check(subsData) || check(debtsData);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto pr-8">
        <DialogHeader className="pr-8">
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import from Excel
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: Upload */}
        {step === "upload" && (
          <div className="space-y-4">
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => document.getElementById("excel-file-input")?.click()}
            >
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="font-medium">Drop your Excel file here</p>
              <p className="text-sm text-muted-foreground mt-1">
                or click to browse — accepts .xlsx files
              </p>
              <input
                id="excel-file-input"
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileInput}
              />
            </div>
            <div className="flex items-center justify-between">
              <SampleTemplateDownload />
              <p className="text-xs text-muted-foreground">
                The file must contain a "Settings" sheet
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Detection */}
        {step === "detect" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span>
                Found sheet: <strong>{sheetName}</strong> — Layout:{" "}
                <Badge variant="secondary">{layoutDetected}</Badge>
              </span>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium">Detected sections:</h3>
              {sections.bills && (
                <div className="flex items-center gap-2 p-2 rounded border">
                  <Badge>Bills</Badge>
                  <span className="text-sm">{sections.bills.rows.length} rows</span>
                </div>
              )}
              {sections.subscriptions && (
                <div className="flex items-center gap-2 p-2 rounded border">
                  <Badge>Subscriptions</Badge>
                  <span className="text-sm">{sections.subscriptions.rows.length} rows</span>
                </div>
              )}
              {sections.debts && (
                <div className="flex items-center gap-2 p-2 rounded border">
                  <Badge>Debts</Badge>
                  <span className="text-sm">{sections.debts.rows.length} rows</span>
                </div>
              )}
              {!sections.bills && !sections.subscriptions && !sections.debts && (
                <div className="flex items-center gap-2 p-3 rounded border border-destructive/50 bg-destructive/5">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <span className="text-sm">
                    No valid sections found. Use headings like "Bills", "Subscriptions", or "Debts",
                    or add a "Category" column.
                  </span>
                </div>
              )}
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={resetState}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={handleProceedToMapping}
                disabled={!sections.bills && !sections.subscriptions && !sections.debts}
              >
                Continue
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Mapping */}
        {step === "mapping" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Confirm how columns map to app fields. Adjust any incorrect mappings.
            </p>

            {[
              { label: "Bills", data: billsData, section: "bills" as const },
              { label: "Subscriptions", data: subsData, section: "subs" as const },
              { label: "Debts", data: debtsData, section: "debts" as const },
            ]
              .filter((s) => s.data)
              .map(({ label, data, section }) => (
                <div key={section} className="space-y-2">
                  <h3 className="text-sm font-medium">{label} Column Mapping</h3>
                  <div className="border rounded-lg divide-y">
                    {data!.table.headers
                      .filter((h) => h.trim())
                      .map((header) => (
                        <div
                          key={header}
                          className="flex items-center justify-between p-2 gap-3"
                        >
                          <span className="text-sm font-mono truncate flex-1">
                            {header}
                          </span>
                          <Select
                            value={data!.mapping[header] || "IGNORE"}
                            onValueChange={(val) => updateMapping(section, header, val)}
                          >
                            <SelectTrigger className="w-48">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="IGNORE">— Ignore —</SelectItem>
                              {data!.fields.map((f) => (
                                <SelectItem key={f.key} value={f.key}>
                                  {f.label}
                                  {f.required ? " *" : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                  </div>
                </div>
              ))}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("detect")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button onClick={handleProceedToPreview}>
                Preview Data
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Preview */}
        {step === "preview" && (
          <div className="space-y-4">
            {(() => {
              const summary = getSummary();
              return (
                <div className="grid grid-cols-3 gap-3">
                  {(["bills", "subs", "debts"] as const).map((key) => {
                    const s = summary[key];
                    const label = key === "subs" ? "Subscriptions" : key === "bills" ? "Bills" : "Debts";
                    if (s.toAdd === 0 && s.toUpdate === 0 && s.toSkip === 0 && s.errors === 0)
                      return null;
                    return (
                      <div key={key} className="p-3 border rounded-lg space-y-1">
                        <p className="text-sm font-medium">{label}</p>
                        <p className="text-xs text-muted-foreground">
                          {s.toAdd} new · {s.toUpdate} update · {s.toSkip} skip
                          {s.errors > 0 && (
                            <span className="text-destructive"> · {s.errors} errors</span>
                          )}
                        </p>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {[
              { label: "Bills", data: billsData, section: "bills" as const },
              { label: "Subscriptions", data: subsData, section: "subs" as const },
              { label: "Debts", data: debtsData, section: "debts" as const },
            ]
              .filter((s) => s.data && s.data.rows.length > 0)
              .map(({ label, data, section }) => (
                <div key={section} className="space-y-2">
                  <h3 className="text-sm font-medium">{label}</h3>
                  <div className="border rounded-lg overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-8"></TableHead>
                          {data!.fields
                            .filter((f) =>
                              Object.values(data!.mapping).includes(f.key)
                            )
                            .map((f) => (
                              <TableHead key={f.key} className="text-xs">
                                {f.label}
                              </TableHead>
                            ))}
                          <TableHead className="text-xs">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data!.rows.slice(0, 20).map((row, idx) => (
                          <TableRow key={idx}>
                            <TableCell>
                              {row.valid ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                              ) : (
                                <XCircle className="h-3.5 w-3.5 text-destructive" />
                              )}
                            </TableCell>
                            {data!.fields
                              .filter((f) =>
                                Object.values(data!.mapping).includes(f.key)
                              )
                              .map((f) => (
                                <TableCell key={f.key} className="text-xs">
                                  {row.valid
                                    ? String(row.normalised[f.key] ?? "")
                                    : String(row.raw[f.key] ?? "")}
                                </TableCell>
                              ))}
                            <TableCell className="text-xs">
                              {!row.valid && (
                                <span className="text-destructive">
                                  {row.errors.join(", ")}
                                </span>
                              )}
                              {row.duplicate && row.valid && (
                                <Select
                                  value={row.duplicateAction}
                                  onValueChange={(val) =>
                                    setDuplicateAction(section, idx, val as DuplicateAction)
                                  }
                                >
                                  <SelectTrigger className="h-7 text-xs w-28">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="skip">Skip</SelectItem>
                                    <SelectItem value="update">Update</SelectItem>
                                    <SelectItem value="import_new">New</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                              {!row.duplicate && row.valid && (
                                <Badge variant="secondary" className="text-xs">
                                  New
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ))}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("mapping")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button onClick={handleImport} disabled={hasBlockingErrors()}>
                Import All
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 5: Importing */}
        {step === "importing" && (
          <div className="space-y-4 py-8 text-center">
            <FileSpreadsheet className="h-10 w-10 mx-auto text-primary animate-pulse" />
            <p className="font-medium">Importing…</p>
            <Progress value={importProgress} className="max-w-xs mx-auto" />
            <p className="text-sm text-muted-foreground">{importProgress}%</p>
          </div>
        )}

        {/* Step 6: Done */}
        {step === "done" && results && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-primary">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">Import Complete</span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Bills", r: results.bills },
                { label: "Subscriptions", r: results.subs },
                { label: "Debts", r: results.debts },
              ].map(({ label, r }) => (
                <div key={label} className="p-3 border rounded-lg">
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {r.added} added · {r.updated} updated · {r.skipped} skipped
                  </p>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>
                Close
              </Button>
              <Button
                onClick={() => {
                  handleClose();
                  onComplete?.();
                }}
              >
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
