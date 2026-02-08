import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

interface RuleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    name: string;
    enabled: boolean;
    keywords_include: string[];
    keywords_exclude: string[];
    category: string | null;
    min_price: number | null;
    max_price: number | null;
    min_discount_percent: number | null;
    store_whitelist: string[];
    store_blacklist: string[];
    notify_email: boolean;
    notify_in_app: boolean;
    alert_cooldown_minutes: number;
  }) => void;
  initialData?: any;
  isSubmitting?: boolean;
}

export function RuleFormDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  isSubmitting,
}: RuleFormDialogProps) {
  const [name, setName] = useState(initialData?.name || "");
  const [enabled, setEnabled] = useState(initialData?.enabled ?? true);
  const [keywordsInclude, setKeywordsInclude] = useState<string[]>(initialData?.keywords_include || []);
  const [keywordsExclude, setKeywordsExclude] = useState<string[]>(initialData?.keywords_exclude || []);
  const [category, setCategory] = useState(initialData?.category || "");
  const [minPrice, setMinPrice] = useState(initialData?.min_price?.toString() || "");
  const [maxPrice, setMaxPrice] = useState(initialData?.max_price?.toString() || "");
  const [minDiscount, setMinDiscount] = useState(initialData?.min_discount_percent?.toString() || "");
  const [storeWhitelist, setStoreWhitelist] = useState<string[]>(initialData?.store_whitelist || []);
  const [storeBlacklist, setStoreBlacklist] = useState<string[]>(initialData?.store_blacklist || []);
  const [notifyEmail, setNotifyEmail] = useState(initialData?.notify_email ?? true);
  const [notifyInApp, setNotifyInApp] = useState(initialData?.notify_in_app ?? true);
  const [cooldown, setCooldown] = useState(initialData?.alert_cooldown_minutes || 60);
  
  const [keywordInput, setKeywordInput] = useState("");
  const [excludeInput, setExcludeInput] = useState("");
  const [storeInput, setStoreInput] = useState("");
  const [blockInput, setBlockInput] = useState("");

  const addKeyword = (type: "include" | "exclude") => {
    const input = type === "include" ? keywordInput : excludeInput;
    const setList = type === "include" ? setKeywordsInclude : setKeywordsExclude;
    const list = type === "include" ? keywordsInclude : keywordsExclude;
    const setInput = type === "include" ? setKeywordInput : setExcludeInput;
    
    if (input.trim() && !list.includes(input.trim())) {
      setList([...list, input.trim()]);
      setInput("");
    }
  };

  const addStore = (type: "whitelist" | "blacklist") => {
    const input = type === "whitelist" ? storeInput : blockInput;
    const setList = type === "whitelist" ? setStoreWhitelist : setStoreBlacklist;
    const list = type === "whitelist" ? storeWhitelist : storeBlacklist;
    const setInput = type === "whitelist" ? setStoreInput : setBlockInput;
    
    if (input.trim() && !list.includes(input.trim())) {
      setList([...list, input.trim()]);
      setInput("");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      enabled,
      keywords_include: keywordsInclude,
      keywords_exclude: keywordsExclude,
      category: category || null,
      min_price: minPrice ? Number(minPrice) : null,
      max_price: maxPrice ? Number(maxPrice) : null,
      min_discount_percent: minDiscount ? Number(minDiscount) : null,
      store_whitelist: storeWhitelist,
      store_blacklist: storeBlacklist,
      notify_email: notifyEmail,
      notify_in_app: notifyInApp,
      alert_cooldown_minutes: cooldown,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initialData ? "Edit Rule" : "Create Deal Rule"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Rule Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Energy deals under £50"
              required
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="enabled">Enabled</Label>
            <Switch id="enabled" checked={enabled} onCheckedChange={setEnabled} />
          </div>

          {/* Keywords Include */}
          <div className="space-y-2">
            <Label>Keywords to Include (any match)</Label>
            <div className="flex gap-2">
              <Input
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                placeholder="Add keyword"
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addKeyword("include"))}
              />
              <Button type="button" onClick={() => addKeyword("include")}>Add</Button>
            </div>
            <div className="flex flex-wrap gap-1">
              {keywordsInclude.map((kw) => (
                <Badge key={kw} variant="secondary" className="gap-1">
                  {kw}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setKeywordsInclude(keywordsInclude.filter(k => k !== kw))} />
                </Badge>
              ))}
            </div>
          </div>

          {/* Keywords Exclude */}
          <div className="space-y-2">
            <Label>Keywords to Exclude</Label>
            <div className="flex gap-2">
              <Input
                value={excludeInput}
                onChange={(e) => setExcludeInput(e.target.value)}
                placeholder="Exclude keyword"
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addKeyword("exclude"))}
              />
              <Button type="button" variant="outline" onClick={() => addKeyword("exclude")}>Add</Button>
            </div>
            <div className="flex flex-wrap gap-1">
              {keywordsExclude.map((kw) => (
                <Badge key={kw} variant="destructive" className="gap-1">
                  {kw}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setKeywordsExclude(keywordsExclude.filter(k => k !== kw))} />
                </Badge>
              ))}
            </div>
          </div>

          {/* Price Range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="minPrice">Min Price (£)</Label>
              <Input
                id="minPrice"
                type="number"
                step="0.01"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxPrice">Max Price (£)</Label>
              <Input
                id="maxPrice"
                type="number"
                step="0.01"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="No limit"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="minDiscount">Min Discount (%)</Label>
            <Input
              id="minDiscount"
              type="number"
              min="0"
              max="100"
              value={minDiscount}
              onChange={(e) => setMinDiscount(e.target.value)}
              placeholder="Any discount"
            />
          </div>

          {/* Store Whitelist */}
          <div className="space-y-2">
            <Label>Only from stores (whitelist)</Label>
            <div className="flex gap-2">
              <Input
                value={storeInput}
                onChange={(e) => setStoreInput(e.target.value)}
                placeholder="Store name"
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addStore("whitelist"))}
              />
              <Button type="button" onClick={() => addStore("whitelist")}>Add</Button>
            </div>
            <div className="flex flex-wrap gap-1">
              {storeWhitelist.map((s) => (
                <Badge key={s} className="gap-1">
                  {s}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setStoreWhitelist(storeWhitelist.filter(x => x !== s))} />
                </Badge>
              ))}
            </div>
          </div>

          {/* Store Blacklist */}
          <div className="space-y-2">
            <Label>Exclude stores (blacklist)</Label>
            <div className="flex gap-2">
              <Input
                value={blockInput}
                onChange={(e) => setBlockInput(e.target.value)}
                placeholder="Store to exclude"
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addStore("blacklist"))}
              />
              <Button type="button" variant="outline" onClick={() => addStore("blacklist")}>Add</Button>
            </div>
            <div className="flex flex-wrap gap-1">
              {storeBlacklist.map((s) => (
                <Badge key={s} variant="destructive" className="gap-1">
                  {s}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setStoreBlacklist(storeBlacklist.filter(x => x !== s))} />
                </Badge>
              ))}
            </div>
          </div>

          {/* Notifications */}
          <div className="space-y-3 pt-2 border-t">
            <h4 className="font-medium">Notifications</h4>
            <div className="flex items-center justify-between">
              <Label htmlFor="notifyEmail">Email Alerts</Label>
              <Switch id="notifyEmail" checked={notifyEmail} onCheckedChange={setNotifyEmail} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="notifyInApp">In-App Alerts</Label>
              <Switch id="notifyInApp" checked={notifyInApp} onCheckedChange={setNotifyInApp} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cooldown">Alert Cooldown (minutes)</Label>
              <Input
                id="cooldown"
                type="number"
                min="5"
                value={cooldown}
                onChange={(e) => setCooldown(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">Minimum time between notifications for this rule</p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : initialData ? "Update Rule" : "Create Rule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
