import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  year: number;
  onSave: (data: { event_id: string; description: string; amount: number; year: number }) => void;
}

export function ExpenseFormDialog({ open, onOpenChange, eventId, year, onSave }: Props) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (open) { setDescription(""); setAmount(""); }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ event_id: eventId, description, amount: parseFloat(amount) || 0, year });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader className="pr-8">
          <DialogTitle>Add Expense Item</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Description</Label>
            <Input value={description} onChange={e => setDescription(e.target.value)} required placeholder="e.g. Card, Perfume, Gift voucher" />
          </div>
          <div className="space-y-2">
            <Label>Amount (£)</Label>
            <Input type="number" min={0} step={0.01} value={amount} onChange={e => setAmount(e.target.value)} required placeholder="0.00" />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!description}>Add</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
