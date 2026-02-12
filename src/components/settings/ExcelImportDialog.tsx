import { useState, useCallback } from "react";
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
  readWorkbook,
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
    async (file: File) => {
      setFileName(file.name);
      try {
        const buffer = await file.arrayBuffer();
        const workbook = await readWorkbook(buffer);
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
        const sheet = workbook.getWorksheet(found);
        if (!sheet) {
          toast.error("Failed to read sheet");
          return;
        }
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
    });

    queryClient.invalidateQueries({ queryKey: ["bills"] });
    queryClient.invalidateQueries({ queryKey: ["debts"] });

    setStep("done");
  }, [user, billsData, subsData, debtsData, fileName, sheetName, layoutDetected, createLog, queryClient]);

  // --- Render helpers ---
  const renderSectionSummary = (name: string, table: ExtractedTable | null) => {
    if (!table) return null;
    return (
      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
        <div>
          <p className="font-medium text-sm">{name}</p>
          <p className="text-xs text-muted-foreground">
            {table.rows.length} row(s) · {table.headers.length} columns
          </p>
        </div>
        <Badge variant="outline">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Found
        </Badge>
      </div>
    );
  };

  const renderMappingSection = (
    title: string,
    sectionKey: "bills" | "subs" | "debts",
    data: SectionData | null
  ) => {
    if (!data) return null;
    return (
      <div className="space-y-2">
        <h4 className="font-medium text-sm">{title}</h4>
        <div className="space-y-1">
          {data.table.headers.map((header) => (
            <div key={header} className="flex items-center gap-2 text-sm">
              <span className="w-32 truncate text-muted-foreground">{header}</span>
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
              <Select
                value={data.mapping[header] || "_skip"}
                onValueChange={(val) => updateMapping(sectionKey, header, val)}
              >
                <SelectTrigger className="h-8 w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_skip">— Skip —</SelectItem>
                  {data.fields.map((f) => (
                    <SelectItem key={f.key} value={f.key}>
                      {f.label} {f.required ? "*" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderPreviewSection = (
    title: string,
    sectionKey: "bills" | "subs" | "debts",
    data: SectionData | null
  ) => {
    if (!data || data.rows.length === 0) return null;
    return (
      <div className="space-y-2">
        <h4 className="font-medium text-sm">
          {title} ({data.rows.filter((r) => r.valid).length} valid /{" "}
          {data.rows.length} total)
        </h4>
        <div className="max-h-48 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">✓</TableHead>
                {data.fields
                  .filter((f) => Object.values(data.mapping).includes(f.key))
                  .map((f) => (
                    <TableHead key={f.key} className="text-xs">
                      {f.label}
                    </TableHead>
                  ))}
                <TableHead className="text-xs">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((row, idx) => (
                <TableRow key={idx} className={row.valid ? "" : "opacity-50"}>
                  <TableCell>
                    {row.valid ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                  </TableCell>
                  {data.fields
                    .filter((f) => Object.values(data.mapping).includes(f.key))
                    .map((f) => (
                      <TableCell key={f.key} className="text-xs">
                        {row.normalised?.[f.key] != null
                          ? String(row.normalised[f.key])
                          : "—"}
                      </TableCell>
                    ))}
                  <TableCell>
                    {row.duplicate ? (
                      <Select
                        value={row.duplicateAction}
                        onValueChange={(val) =>
                          setDuplicateAction(sectionKey, idx, val as DuplicateAction)
                        }
                      >
                        <SelectTrigger className="h-6 w-24 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="skip">Skip</SelectItem>
                          <SelectItem value="update">Update</SelectItem>
                          <SelectItem value="import_new">New</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : row.valid ? (
                      <Badge variant="outline" className="text-xs">
                        New
                      </Badge>
                    ) : (
                      <span className="text-xs text-destructive">
                        {row.errors[0]}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!val) handleClose();
        else onOpenChange(val);
      }}
    >
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader className="pr-8">
          <DialogTitle>Import from Excel</DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload an Excel file with a <strong>Settings</strong> sheet containing
              your bills, subscriptions, and/or debts.
            </p>

            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() =>
                document.getElementById("excel-import-input")?.click()
              }
            >
              <input
                id="excel-import-input"
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileInput}
              />
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-medium">
                Drop your Excel file here or click to browse
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Supports .xlsx and .xls files
              </p>
            </div>

            <div className="flex justify-between items-center">
              <SampleTemplateDownload />
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {step === "detect" && (
          <div className="space-y-4">
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                <span className="text-sm font-medium">{fileName}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Sheet: {sheetName} · Layout:{" "}
                {layoutDetected === "CATEGORY_TABLE"
                  ? "Category column"
                  : layoutDetected === "SECTION_TABLES"
                  ? "Section headings"
                  : "Unknown"}
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-medium">Detected sections:</h4>
              {renderSectionSummary("Bills", sections.bills)}
              {renderSectionSummary("Subscriptions", sections.subscriptions)}
              {renderSectionSummary("Debts", sections.debts)}
              {!sections.bills && !sections.subscriptions && !sections.debts && (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <span className="text-sm">
                    No sections found. Check the file uses section headings (Bills,
                    Subscriptions, Debts) or a Category column.
                  </span>
                </div>
              )}
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("upload")}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <Button
                onClick={handleProceedToMapping}
                disabled={
                  !sections.bills && !sections.subscriptions && !sections.debts
                }
              >
                Continue to Mapping
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {step === "mapping" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Map your spreadsheet columns to the correct fields. Required fields
              are marked with *.
            </p>

            {renderMappingSection("Bills", "bills", billsData)}
            {renderMappingSection("Subscriptions", "subs", subsData)}
            {renderMappingSection("Debts", "debts", debtsData)}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("detect")}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <Button onClick={handleProceedToPreview}>
                Preview Import
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            {renderPreviewSection("Bills", "bills", billsData)}
            {renderPreviewSection("Subscriptions", "subs", subsData)}
            {renderPreviewSection("Debts", "debts", debtsData)}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("mapping")}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <Button onClick={handleImport}>
                Import Data
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {step === "importing" && (
          <div className="space-y-4 py-8">
            <p className="text-sm text-center">Importing your data…</p>
            <Progress value={importProgress} className="w-full" />
            <p className="text-xs text-center text-muted-foreground">
              {importProgress}%
            </p>
          </div>
        )}

        {step === "done" && results && (
          <div className="space-y-4">
            <div className="text-center py-4">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-2" />
              <h3 className="font-medium">Import Complete</h3>
            </div>

            <div className="space-y-2">
              {(results.bills.added > 0 ||
                results.bills.updated > 0 ||
                results.bills.skipped > 0) && (
                <div className="flex justify-between text-sm p-2 bg-muted/50 rounded">
                  <span>Bills</span>
                  <span>
                    {results.bills.added} added · {results.bills.updated} updated ·{" "}
                    {results.bills.skipped} skipped
                  </span>
                </div>
              )}
              {(results.subs.added > 0 ||
                results.subs.updated > 0 ||
                results.subs.skipped > 0) && (
                <div className="flex justify-between text-sm p-2 bg-muted/50 rounded">
                  <span>Subscriptions</span>
                  <span>
                    {results.subs.added} added · {results.subs.updated} updated ·{" "}
                    {results.subs.skipped} skipped
                  </span>
                </div>
              )}
              {(results.debts.added > 0 ||
                results.debts.updated > 0 ||
                results.debts.skipped > 0) && (
                <div className="flex justify-between text-sm p-2 bg-muted/50 rounded">
                  <span>Debts</span>
                  <span>
                    {results.debts.added} added · {results.debts.updated} updated ·{" "}
                    {results.debts.skipped} skipped
                  </span>
                </div>
              )}
            </div>

            <div className="flex justify-end">
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
