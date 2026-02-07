import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Upload, Download, Trash2, FileText, ImageIcon, Loader2 } from "lucide-react";
import { useReceiptUpload } from "@/hooks/useReceiptUpload";
import { isReceiptPdf, validateReceiptFile } from "@/lib/receiptUpload";
import { cn } from "@/lib/utils";

interface ReceiptPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactionId: string;
  transactionDescription: string;
  receiptPath: string | null;
}

export function ReceiptPreviewDialog({
  open,
  onOpenChange,
  transactionId,
  transactionDescription,
  receiptPath,
}: ReceiptPreviewDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const [imageError, setImageError] = useState(false);

  const {
    uploadReceipt,
    removeReceipt,
    isUploading,
    isRemoving,
    uploadProgress,
    getSignedUrl,
  } = useReceiptUpload();

  // Generate signed URL when dialog opens with existing receipt
  useEffect(() => {
    if (open && receiptPath) {
      setIsLoadingUrl(true);
      setImageError(false);
      getSignedUrl(receiptPath).then((url) => {
        setSignedUrl(url);
        setIsLoadingUrl(false);
      });
    } else if (!open) {
      // Clean up when closing
      setSignedUrl(null);
      setImageError(false);
    }
  }, [open, receiptPath, getSignedUrl]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validation = validateReceiptFile(file);
    if (!validation.valid) {
      return;
    }

    uploadReceipt({ file, transactionId });
    
    // Clear the input so same file can be re-selected
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemove = () => {
    if (receiptPath) {
      removeReceipt({ transactionId, receiptPath });
    }
  };

  const handleDownload = () => {
    if (signedUrl) {
      window.open(signedUrl, "_blank");
    }
  };

  const isPdf = isReceiptPdf(receiptPath);
  const hasReceipt = !!receiptPath;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="truncate">
            Receipt: {transactionDescription}
          </DialogTitle>
        </DialogHeader>

        <Input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={handleFileSelect}
          className="hidden"
        />

        <div className="space-y-4">
          {/* Upload Progress */}
          {isUploading && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading receipt...
              </div>
              <Progress value={uploadProgress} className="h-2" />
            </div>
          )}

          {/* Receipt Preview Area */}
          {!isUploading && (
            <div
              className={cn(
                "relative flex items-center justify-center rounded-lg border-2 border-dashed bg-muted/50 min-h-[200px]",
                !hasReceipt && "cursor-pointer hover:border-primary/50 hover:bg-muted"
              )}
              onClick={!hasReceipt ? handleUploadClick : undefined}
            >
              {isLoadingUrl ? (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <span className="text-sm">Loading receipt...</span>
                </div>
              ) : hasReceipt && signedUrl ? (
                isPdf ? (
                  <div className="flex flex-col items-center gap-3 p-6">
                    <FileText className="h-16 w-16 text-destructive" />
                    <span className="text-sm text-muted-foreground">PDF Receipt</span>
                    <Button variant="outline" size="sm" onClick={handleDownload}>
                      <Download className="h-4 w-4 mr-2" />
                      Open PDF
                    </Button>
                  </div>
                ) : imageError ? (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground p-6">
                    <ImageIcon className="h-12 w-12" />
                    <span className="text-sm">Unable to load image</span>
                    <Button variant="outline" size="sm" onClick={handleDownload}>
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </div>
                ) : (
                  <img
                    src={signedUrl}
                    alt="Receipt"
                    className="max-h-[400px] max-w-full object-contain rounded"
                    onError={() => setImageError(true)}
                  />
                )
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground p-6">
                  <Upload className="h-12 w-12" />
                  <span className="text-sm">Click to upload a receipt</span>
                  <span className="text-xs">JPG, PNG, WebP, or PDF (max 10MB)</span>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            {hasReceipt ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleUploadClick}
                  disabled={isUploading || isRemoving}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Replace
                </Button>
                {signedUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownload}
                    disabled={isUploading || isRemoving}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                )}
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleRemove}
                  disabled={isUploading || isRemoving}
                >
                  {isRemoving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Remove
                </Button>
              </>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={handleUploadClick}
                disabled={isUploading}
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload Receipt
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
