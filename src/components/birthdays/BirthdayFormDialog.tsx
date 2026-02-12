import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { BirthdayEvent } from "@/hooks/useBirthdayEvents";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: BirthdayEvent | null;
  onSave: (data: Partial<BirthdayEvent>) => void;
}

export function BirthdayFormDialog({ open, onOpenChange, event, onSave }: Props) {
  const [personName, setPersonName] = useState("");
  const [occasion, setOccasion] = useState("birthday");
  const [eventMonth, setEventMonth] = useState(1);
  const [eventDay, setEventDay] = useState<number | "">("");
  const [budget, setBudget] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (event) {
      setPersonName(event.person_name);
      setOccasion(event.occasion);
      setEventMonth(event.event_month);
      setEventDay(event.event_day || "");
      setBudget(String(event.budget || ""));
      setNotes(event.notes || "");
    } else {
      setPersonName("");
      setOccasion("birthday");
      setEventMonth(1);
      setEventDay("");
      setBudget("");
      setNotes("");
    }
  }, [event, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...(event?.id ? { id: event.id } : {}),
      person_name: personName,
      occasion,
      event_month: eventMonth,
      event_day: eventDay === "" ? null : Number(eventDay),
      budget: parseFloat(budget) || 0,
      notes: notes || null,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader className="pr-8">
          <DialogTitle>{event ? "Edit Event" : "Add Event"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Person / Occasion Name</Label>
            <Input value={personName} onChange={e => setPersonName(e.target.value)} required placeholder="e.g. Mum, Dad, Christmas" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={occasion} onValueChange={setOccasion}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="birthday">Birthday</SelectItem>
                  <SelectItem value="christmas">Christmas</SelectItem>
                  <SelectItem value="anniversary">Anniversary</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Budget (£)</Label>
              <Input type="number" min={0} step={0.01} value={budget} onChange={e => setBudget(e.target.value)} placeholder="0.00" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Month</Label>
              <Select value={String(eventMonth)} onValueChange={v => setEventMonth(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Day (optional)</Label>
              <Input type="number" min={1} max={31} value={eventDay} onChange={e => setEventDay(e.target.value === "" ? "" : Number(e.target.value))} placeholder="e.g. 15" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Gift ideas, sizes, etc." className="h-20" />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!personName}>Save</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
