import { useState } from "react";
import { ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogHeader, ResponsiveDialogTitle } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { MedicashBenefitCategory } from "@/hooks/useMedicash";

interface ClaimFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Array<MedicashBenefitCategory & { totalClaimed: number; remaining: number | null }>;
  onSubmit: (data: { category_id: string; claim_date: string; amount: number; description?: string; notes?: string }) => void;
  isPending: boolean;
}

export function ClaimFormDialog({ open, onOpenChange, categories, onSubmit, isPending }: ClaimFormDialogProps) {
  const [categoryId, setCategoryId] = useState("");
  const [claimDate, setClaimDate] = useState(new Date().toISOString().split("T")[0]);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");

  const selectedCat = categories.find(c => c.id === categoryId);
  const numAmount = parseFloat(amount) || 0;
  const willExceed = selectedCat?.remaining !== null && selectedCat?.remaining !== undefined && numAmount > selectedCat.remaining;
  const cappedAmount = willExceed ? selectedCat!.remaining! : numAmount;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryId || cappedAmount <= 0) return;
    onSubmit({
      category_id: categoryId,
      claim_date: claimDate,
      amount: cappedAmount,
      description: description || undefined,
      notes: notes || undefined,
    });
    // Reset
    setCategoryId("");
    setAmount("");
    setDescription("");
    setNotes("");
    onOpenChange(false);
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader className="pr-8">
          <ResponsiveDialogTitle>Log a Claim</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 px-1">
          <div className="space-y-2">
            <Label>Benefit Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.filter(c => c.is_active).map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                    {cat.remaining !== null && ` (£${cat.remaining.toFixed(0)} left)`}
                    {cat.is_per_event && ` (£${cat.per_event_amount}/event)`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={claimDate} onChange={e => setClaimDate(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Amount (£)</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder={selectedCat?.is_per_event ? `Max £${selectedCat.per_event_amount}` : "0.00"}
                required
              />
            </div>
          </div>

          {willExceed && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Only £{selectedCat!.remaining!.toFixed(2)} remaining for {selectedCat!.name}. Your claim will be capped at £{cappedAmount.toFixed(2)}.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label>Description</Label>
            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g., Dental checkup" />
          </div>

          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any additional details..." rows={2} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!categoryId || cappedAmount <= 0 || isPending}>
              {isPending ? "Saving..." : "Log Claim"}
            </Button>
          </div>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
