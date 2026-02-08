import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

interface SourceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    name: string;
    type: string;
    base_url: string;
    scan_url: string;
    enabled: boolean;
    scan_frequency_minutes: number;
  }) => void;
  initialData?: {
    name: string;
    type: string;
    base_url: string;
    scan_url: string;
    enabled: boolean;
    scan_frequency_minutes: number;
  };
  isSubmitting?: boolean;
}

export function SourceFormDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  isSubmitting,
}: SourceFormDialogProps) {
  const [name, setName] = useState(initialData?.name || "");
  const [type, setType] = useState(initialData?.type || "rss");
  const [baseUrl, setBaseUrl] = useState(initialData?.base_url || "");
  const [scanUrl, setScanUrl] = useState(initialData?.scan_url || "");
  const [enabled, setEnabled] = useState(initialData?.enabled ?? true);
  const [frequency, setFrequency] = useState(initialData?.scan_frequency_minutes || 60);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      type,
      base_url: baseUrl,
      scan_url: scanUrl,
      enabled,
      scan_frequency_minutes: frequency,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initialData ? "Edit Source" : "Add Deal Source"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., HotUKDeals RSS"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Source Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rss">RSS/Atom Feed</SelectItem>
                <SelectItem value="api">Public API</SelectItem>
                <SelectItem value="html">HTML Page</SelectItem>
                <SelectItem value="manual">Manual URL</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="baseUrl">Base URL</Label>
            <Input
              id="baseUrl"
              type="url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://example.com"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="scanUrl">Scan URL (Feed/API endpoint)</Label>
            <Input
              id="scanUrl"
              type="url"
              value={scanUrl}
              onChange={(e) => setScanUrl(e.target.value)}
              placeholder="https://example.com/rss/deals"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="frequency">Scan Frequency (minutes)</Label>
            <Select value={String(frequency)} onValueChange={(v) => setFrequency(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">Every 15 min</SelectItem>
                <SelectItem value="30">Every 30 min</SelectItem>
                <SelectItem value="60">Every hour</SelectItem>
                <SelectItem value="120">Every 2 hours</SelectItem>
                <SelectItem value="360">Every 6 hours</SelectItem>
                <SelectItem value="1440">Daily</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="enabled">Enabled</Label>
            <Switch id="enabled" checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : initialData ? "Update" : "Add Source"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
