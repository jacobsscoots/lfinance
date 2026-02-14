import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Upload, Cake, TreePine, Gift } from "lucide-react";
import { useBirthdayEvents } from "@/hooks/useBirthdayEvents";
import { BirthdayEventCard } from "@/components/birthdays/BirthdayEventCard";
import { BirthdayFormDialog } from "@/components/birthdays/BirthdayFormDialog";
import { ExpenseFormDialog } from "@/components/birthdays/ExpenseFormDialog";
import { BirthdayImportDialog } from "@/components/birthdays/BirthdayImportDialog";
import type { BirthdayEvent } from "@/hooks/useBirthdayEvents";

const CURRENT_YEAR = new Date().getFullYear();

export default function Birthdays() {
  const {
    events, expenses, isLoading,
    addEvent, updateEvent, deleteEvent,
    addExpense, updateExpense, deleteExpense,
    importEvents,
  } = useBirthdayEvents();

  const [year, setYear] = useState(CURRENT_YEAR);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [expenseFormOpen, setExpenseFormOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<BirthdayEvent | null>(null);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  // Sort events by next upcoming date
  const sortedEvents = [...events].sort((a, b) => {
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentDay = today.getDate();

    const getNextOccurrence = (e: BirthdayEvent) => {
      const m = e.event_month;
      const d = e.event_day ?? 1;
      // Days until this event from today (wrapping around year)
      let daysUntil = (m - currentMonth) * 30 + (d - currentDay);
      if (daysUntil < 0) daysUntil += 365;
      return daysUntil;
    };

    return getNextOccurrence(a) - getNextOccurrence(b);
  });

  const filtered = activeTab === "all"
    ? sortedEvents
    : sortedEvents.filter(e => e.occasion === activeTab);

  const birthdayCount = events.filter(e => e.occasion === "birthday").length;
  const christmasCount = events.filter(e => e.occasion === "christmas").length;

  const totalBudget = events.reduce((s, e) => s + Number(e.budget), 0);
  const totalSpent = expenses
    .filter(e => e.year === year)
    .reduce((s, e) => s + Number(e.amount), 0);
  const totalPurchased = expenses
    .filter(e => e.year === year && e.is_purchased)
    .reduce((s, e) => s + Number(e.amount), 0);

  const handleEdit = (event: BirthdayEvent) => {
    setSelectedEvent(event);
    setFormOpen(true);
  };

  const handleAddNew = () => {
    setSelectedEvent(null);
    setFormOpen(true);
  };

  const handleSave = (data: Partial<BirthdayEvent>) => {
    if (data.id) {
      updateEvent.mutate(data as any);
    } else {
      addEvent.mutate(data);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Birthdays & Occasions</h1>
            <p className="text-muted-foreground">Track gifts, cards, and budgets</p>
          </div>
          <div className="flex gap-2">
            <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1].map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
            <Button onClick={handleAddNew}>
              <Plus className="h-4 w-4 mr-2" />
              Add Event
            </Button>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="py-4 text-center">
              <p className="text-xs text-muted-foreground">Events</p>
              <p className="text-2xl font-bold">{events.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <p className="text-xs text-muted-foreground">Budget</p>
              <p className="text-2xl font-bold">£{totalBudget.toFixed(0)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <p className="text-xs text-muted-foreground">Planned ({year})</p>
              <p className="text-2xl font-bold">£{totalSpent.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <p className="text-xs text-muted-foreground">Purchased</p>
              <p className="text-2xl font-bold text-success">£{totalPurchased.toFixed(2)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all" className="gap-1">
              <Gift className="h-4 w-4" />
              All ({events.length})
            </TabsTrigger>
            <TabsTrigger value="birthday" className="gap-1">
              <Cake className="h-4 w-4" />
              Birthdays ({birthdayCount})
            </TabsTrigger>
            <TabsTrigger value="christmas" className="gap-1">
              <TreePine className="h-4 w-4" />
              Christmas ({christmasCount})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="space-y-3 mt-4">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Gift className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium mb-2">No events yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Add birthdays, Christmas lists, and other occasions to track.
                  </p>
                  <Button onClick={handleAddNew}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Event
                  </Button>
                </CardContent>
              </Card>
            ) : (
              filtered.map(event => (
                <BirthdayEventCard
                  key={event.id}
                  event={event}
                  expenses={expenses}
                  year={year}
                  onEdit={handleEdit}
                  onDelete={(e) => deleteEvent.mutate(e.id)}
                  onAddExpense={(id) => { setSelectedEventId(id); setExpenseFormOpen(true); }}
                  onTogglePurchased={(exp) => updateExpense.mutate({ id: exp.id, is_purchased: !exp.is_purchased })}
                  onDeleteExpense={(id) => deleteExpense.mutate(id)}
                  onToggleCardSent={(e) => updateEvent.mutate({ id: e.id, card_sent: !e.card_sent })}
                  onToggleMoneyScheduled={(e) => {
                    const newVal = !e.money_scheduled;
                    updateEvent.mutate({ id: e.id, money_scheduled: newVal });
                    if (newVal && Number(e.budget) > 0) {
                      // Auto-create a purchased expense for the budget amount
                      const existingMoneyExpense = expenses.find(
                        exp => exp.event_id === e.id && exp.year === year && exp.description === "Money gift"
                      );
                      if (!existingMoneyExpense) {
                        addExpense.mutate({
                          event_id: e.id,
                          description: "Money gift",
                          amount: Number(e.budget),
                          year,
                          is_purchased: true,
                          purchase_date: new Date().toISOString().split("T")[0],
                        });
                      }
                    }
                  }}
                />
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      <BirthdayFormDialog open={formOpen} onOpenChange={setFormOpen} event={selectedEvent} onSave={handleSave} />
      <ExpenseFormDialog open={expenseFormOpen} onOpenChange={setExpenseFormOpen} eventId={selectedEventId} year={year} onSave={(d) => addExpense.mutate(d)} />
      <BirthdayImportDialog open={importOpen} onOpenChange={setImportOpen} onImport={(rows) => importEvents.mutate(rows)} isImporting={importEvents.isPending} />
    </AppLayout>
  );
}
