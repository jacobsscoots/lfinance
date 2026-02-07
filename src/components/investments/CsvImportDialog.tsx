import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, FileText, AlertCircle, CheckCircle2 } from "lucide-react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { parseContributionsCsv, generateCsvTemplate, ParsedContribution } from "@/lib/investmentCsvParser";

interface CsvImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (contributions: ParsedContribution[]) => void;
  isLoading?: boolean;
}

export function CsvImportDialog({
  open,
  onOpenChange,
  onImport,
  isLoading,
}: CsvImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<{
    success: boolean;
    contributions: ParsedContribution[];
    errors: string[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);

    const text = await selectedFile.text();
    const result = parseContributionsCsv(text);
    setParseResult(result);
  };

  const handleImport = () => {
    if (parseResult?.contributions.length) {
      onImport(parseResult.contributions);
      handleReset();
    }
  };

  const handleReset = () => {
    setFile(null);
    setParseResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const downloadTemplate = () => {
    const template = generateCsvTemplate();
    const blob = new Blob([template], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "contributions_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-[500px]">
        <ResponsiveDialogHeader className="pr-8">
          <ResponsiveDialogTitle>Import Contributions from CSV</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Upload a CSV file with your contribution history
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="space-y-4">
          {/* File Upload */}
          <div className="border-2 border-dashed rounded-lg p-6 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileSelect}
              className="hidden"
              id="csv-upload"
            />
            {file ? (
              <div className="space-y-2">
                <FileText className="h-10 w-10 mx-auto text-muted-foreground" />
                <p className="font-medium">{file.name}</p>
                <Button variant="outline" size="sm" onClick={handleReset}>
                  Choose different file
                </Button>
              </div>
            ) : (
              <label htmlFor="csv-upload" className="cursor-pointer">
                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                <p className="font-medium">Click to upload CSV</p>
                <p className="text-sm text-muted-foreground">or drag and drop</p>
              </label>
            )}
          </div>

          {/* Template Download */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Need a template?</span>
            <Button variant="link" size="sm" onClick={downloadTemplate} className="p-0">
              Download CSV template
            </Button>
          </div>

          {/* Parse Results */}
          {parseResult && (
            <div className="space-y-4">
              {parseResult.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Parsing Errors</AlertTitle>
                  <AlertDescription>
                    <ScrollArea className="h-24">
                      <ul className="list-disc list-inside text-sm">
                        {parseResult.errors.map((error, i) => (
                          <li key={i}>{error}</li>
                        ))}
                      </ul>
                    </ScrollArea>
                  </AlertDescription>
                </Alert>
              )}

              {parseResult.contributions.length > 0 && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>Ready to Import</AlertTitle>
                  <AlertDescription>
                    Found {parseResult.contributions.length} valid contributions
                  </AlertDescription>
                </Alert>
              )}

              {/* Preview */}
              {parseResult.contributions.length > 0 && (
                <div className="border rounded-lg">
                  <div className="p-2 bg-muted/50 text-sm font-medium border-b">
                    Preview (first 5)
                  </div>
                  <ScrollArea className="h-40">
                    <div className="p-2 space-y-2">
                      {parseResult.contributions.slice(0, 5).map((c, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between text-sm p-2 bg-muted/30 rounded"
                        >
                          <div className="flex items-center gap-2">
                            <span>{c.date}</span>
                            <Badge variant="outline" className="capitalize">
                              {c.type}
                            </Badge>
                          </div>
                          <span className="font-medium">
                            £{c.amount.toFixed(2)}
                          </span>
                        </div>
                      ))}
                      {parseResult.contributions.length > 5 && (
                        <p className="text-sm text-muted-foreground text-center py-2">
                          +{parseResult.contributions.length - 5} more
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              className="flex-1"
              disabled={isLoading || !parseResult?.contributions.length}
            >
              {isLoading
                ? "Importing..."
                : `Import ${parseResult?.contributions.length || 0} Items`}
            </Button>
          </div>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
