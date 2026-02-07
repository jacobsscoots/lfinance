import { useState, useCallback } from "react";
import { Upload, Link, FileText, Loader2, AlertCircle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ExtractedToiletryData {
  name?: string;
  brand?: string;
  image_url?: string;
  price?: number;
  offer_price?: number;
  offer_label?: string;
  pack_size?: number;
  size_unit?: string;
  source_url?: string;
  confidence: Record<string, "high" | "medium" | "low">;
}

interface ToiletryImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (data: ExtractedToiletryData, selectedFields: Set<string>) => void;
}

type ImportMethod = "image" | "text" | "url";

const FIELD_LABELS: Record<string, string> = {
  name: "Product Name",
  brand: "Brand",
  image_url: "Image",
  price: "Price",
  offer_price: "Offer Price",
  offer_label: "Offer Label",
  pack_size: "Pack Size",
  size_unit: "Size Unit",
};

export function ToiletryImportDialog({ open, onOpenChange, onImport }: ToiletryImportDialogProps) {
  const [method, setMethod] = useState<ImportMethod>("image");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedToiletryData | null>(null);
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());
  
  // Input states
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [textInput, setTextInput] = useState("");
  const [urlInput, setUrlInput] = useState("");

  const resetState = useCallback(() => {
    setError(null);
    setExtractedData(null);
    setSelectedFields(new Set());
    setImagePreview(null);
    setTextInput("");
    setUrlInput("");
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setImagePreview(base64);
    };
    reader.readAsDataURL(file);
  };

  const extractData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      let content: string;
      
      if (method === "image") {
        if (!imagePreview) {
          throw new Error("Please upload an image first");
        }
        content = imagePreview;
      } else if (method === "text") {
        if (!textInput.trim()) {
          throw new Error("Please paste some text first");
        }
        content = textInput;
      } else {
        if (!urlInput.trim()) {
          throw new Error("Please enter a URL first");
        }
        content = urlInput;
      }

      const { data, error: fnError } = await supabase.functions.invoke("extract-nutrition", {
        body: { method, content, productType: "toiletry" },
      });

      if (fnError) throw fnError;
      if (!data.success) throw new Error(data.error || "Extraction failed");

      setExtractedData(data.data);
      
      // Auto-select all fields with values
      const fieldsWithValues = new Set<string>();
      for (const [key, value] of Object.entries(data.data)) {
        if (key !== "confidence" && key !== "source_url" && value !== null && value !== undefined) {
          fieldsWithValues.add(key);
        }
      }
      setSelectedFields(fieldsWithValues);
      
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to extract product data");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleField = (field: string) => {
    const newSet = new Set(selectedFields);
    if (newSet.has(field)) {
      newSet.delete(field);
    } else {
      newSet.add(field);
    }
    setSelectedFields(newSet);
  };

  const handleImport = () => {
    if (!extractedData || selectedFields.size === 0) return;
    onImport(extractedData, selectedFields);
    onOpenChange(false);
    resetState();
    toast.success("Product data imported");
  };

  const formatValue = (key: string, value: any): string => {
    if (value === null || value === undefined) return "—";
    if (typeof value === "number") {
      if (key === "price" || key === "offer_price") {
        return `£${value.toFixed(2)}`;
      }
      if (key === "pack_size") return `${value}`;
      return String(value);
    }
    return String(value);
  };

  const isLowConfidence = (key: string): boolean => {
    return extractedData?.confidence?.[key] === "low";
  };

  return (
    <Dialog open={open} onOpenChange={(open) => { onOpenChange(open); if (!open) resetState(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Product Data</DialogTitle>
          <DialogDescription>
            Upload a photo, paste text, or import from a product URL (Boots, Superdrug, Amazon, etc.)
          </DialogDescription>
        </DialogHeader>

        {!extractedData ? (
          <div className="space-y-4">
            <Tabs value={method} onValueChange={(v) => setMethod(v as ImportMethod)}>
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="image" className="text-xs sm:text-sm">
                  <Upload className="h-4 w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Upload</span>
                  <span className="sm:hidden">Photo</span>
                </TabsTrigger>
                <TabsTrigger value="text" className="text-xs sm:text-sm">
                  <FileText className="h-4 w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Paste Text</span>
                  <span className="sm:hidden">Text</span>
                </TabsTrigger>
                <TabsTrigger value="url" className="text-xs sm:text-sm">
                  <Link className="h-4 w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">From URL</span>
                  <span className="sm:hidden">URL</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="image" className="space-y-4">
                <div className="space-y-2">
                  <Label>Upload product photo</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="cursor-pointer"
                  />
                </div>
                {imagePreview && (
                  <div className="relative">
                    <img
                      src={imagePreview}
                      alt="Product preview"
                      className="max-h-48 w-full object-contain rounded-lg border"
                    />
                  </div>
                )}
              </TabsContent>

              <TabsContent value="text" className="space-y-4">
                <div className="space-y-2">
                  <Label>Paste product information</Label>
                  <Textarea
                    placeholder="Paste product details here...&#10;&#10;Example:&#10;Pantene Pro-V Shampoo&#10;500ml&#10;£4.99&#10;Now £3.49 (save £1.50)"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    rows={8}
                  />
                </div>
              </TabsContent>

              <TabsContent value="url" className="space-y-4">
                <div className="space-y-2">
                  <Label>Product page URL</Label>
                  <Input
                    type="url"
                    placeholder="https://www.boots.com/..."
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Works with Boots, Superdrug, Savers, Amazon, and more
                  </p>
                </div>
              </TabsContent>
            </Tabs>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={extractData} disabled={isLoading}>
                {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Extract Data
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <Alert>
              <Check className="h-4 w-4" />
              <AlertDescription>
                Data extracted! Select the fields you want to import.
              </AlertDescription>
            </Alert>

            <div className="space-y-2 max-h-[40vh] overflow-y-auto">
              {Object.entries(extractedData)
                .filter(([key]) => key !== "confidence" && key !== "source_url")
                .map(([key, value]) => {
                  if (value === null || value === undefined) return null;
                  const isLow = isLowConfidence(key);
                  
                  return (
                    <div
                      key={key}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                        selectedFields.has(key) ? "bg-primary/5 border-primary" : "hover:bg-accent"
                      }`}
                    >
                      <Checkbox
                        id={key}
                        checked={selectedFields.has(key)}
                        onCheckedChange={() => toggleField(key)}
                      />
                      <div className="flex-1 min-w-0">
                        <Label htmlFor={key} className="cursor-pointer font-medium">
                          {FIELD_LABELS[key] || key}
                        </Label>
                        <p className="text-sm text-muted-foreground truncate">
                          {formatValue(key, value)}
                        </p>
                      </div>
                      {isLow && (
                        <Badge variant="outline" className="text-xs shrink-0">
                          Uncertain
                        </Badge>
                      )}
                    </div>
                  );
                })}
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setExtractedData(null)} className="w-full sm:w-auto">
                Back
              </Button>
              <Button 
                onClick={handleImport} 
                disabled={selectedFields.size === 0}
                className="w-full sm:w-auto"
              >
                Import {selectedFields.size} field{selectedFields.size !== 1 ? "s" : ""}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
