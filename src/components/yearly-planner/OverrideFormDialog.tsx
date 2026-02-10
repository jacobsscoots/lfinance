import { useState } from "react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from "@/components/ui/responsive-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

interface OverrideFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  month: number; // 1-12
  onSubmit: (data: { month: number; label: string; amount: number; type: 'income' | 'expense' }) => void;
  isLoading?: boolean;
}

export function OverrideFormDialog({ open, onOpenChange, month, onSubmit, isLoading }: OverrideFormDialogProps) {
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<'income' | 'expense'>("expense");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim() || !amount) return;
    onSubmit({ month, label: label.trim(), amount: parseFloat(amount), type });
    setLabel("");
    setAmount("");
    setType("expense");
    onOpenChange(false);
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-[380px]">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Add Adjustment — {MONTH_NAMES[month - 1]}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Add expected extra income or spending for this month
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as 'income' | 'expense')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">Extra Expense</SelectItem>
                <SelectItem value="income">Extra Income</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Label</Label>
            <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Christmas gifts" />
          </div>
          <div>
            <Label>Amount (£)</Label>
            <Input type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder="200" />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={isLoading || !label.trim() || !amount}>
              {isLoading ? "Adding..." : "Add"}
            </Button>
          </div>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
