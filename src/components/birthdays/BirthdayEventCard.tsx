import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Cake, Gift, TreePine, Heart, Plus, Trash2, Pencil, ChevronDown, ChevronRight,
  MapPin, Mail, Banknote,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { BirthdayEvent, BirthdayExpense } from "@/hooks/useBirthdayEvents";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const OCCASION_ICONS: Record<string, React.ElementType> = {
  birthday: Cake,
  christmas: TreePine,
  anniversary: Heart,
  other: Gift,
};

interface Props {
  event: BirthdayEvent;
  expenses: BirthdayExpense[];
  year: number;
  onEdit: (event: BirthdayEvent) => void;
  onDelete: (event: BirthdayEvent) => void;
  onAddExpense: (eventId: string) => void;
  onTogglePurchased: (expense: BirthdayExpense) => void;
  onDeleteExpense: (id: string) => void;
  onToggleCardSent?: (event: BirthdayEvent) => void;
  onToggleMoneyScheduled?: (event: BirthdayEvent) => void;
}

export function BirthdayEventCard({
  event, expenses, year, onEdit, onDelete, onAddExpense, onTogglePurchased, onDeleteExpense,
  onToggleCardSent, onToggleMoneyScheduled,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const Icon = OCCASION_ICONS[event.occasion] || Gift;
  
  const yearExpenses = expenses.filter(e => e.event_id === event.id && e.year === year);
  const totalSpent = yearExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const purchasedCount = yearExpenses.filter(e => e.is_purchased).length;
  const budget = Number(event.budget);
  const overBudget = budget > 0 && totalSpent > budget;

  const dateLabel = event.event_day
    ? `${event.event_day} ${MONTH_NAMES[event.event_month - 1]}`
    : MONTH_NAMES[event.event_month - 1];

  const hasAddress = event.address_line1 || event.city || event.postcode;
  const addressParts = [event.address_line1, event.address_line2, event.city, event.state, event.postcode, event.country].filter(Boolean);

  return (
    <Card className={cn(overBudget && "border-destructive/50")}>
      <CardContent className="py-3 px-3 sm:px-4">
        {/* Top row: expand + icon + name/date */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button onClick={() => setExpanded(!expanded)} className="shrink-0">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
          <div className={cn("h-8 w-8 sm:h-9 sm:w-9 rounded-full flex items-center justify-center shrink-0",
            event.occasion === "christmas" ? "bg-emerald-500/10" : "bg-primary/10"
          )}>
            <Icon className={cn("h-4 w-4",
              event.occasion === "christmas" ? "text-emerald-600" : "text-primary"
            )} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate text-sm">
              {event.title ? `${event.title} ` : ""}{event.person_name}
            </p>
            <p className="text-xs text-muted-foreground">{dateLabel}</p>
          </div>

          {/* Status tick boxes - hide labels on mobile */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <label className="flex items-center gap-0.5 sm:gap-1 text-xs cursor-pointer" title="Money Scheduled">
              <Checkbox
                checked={!!event.money_scheduled}
                onCheckedChange={() => onToggleMoneyScheduled?.(event)}
              />
              <Banknote className="h-3.5 w-3.5 text-muted-foreground hidden sm:block" />
            </label>
            <label className="flex items-center gap-0.5 sm:gap-1 text-xs cursor-pointer" title="Card Sent">
              <Checkbox
                checked={!!event.card_sent}
                onCheckedChange={() => onToggleCardSent?.(event)}
              />
              <Mail className="h-3.5 w-3.5 text-muted-foreground hidden sm:block" />
            </label>
          </div>

          <div className="text-right shrink-0">
            <p className={cn("font-semibold text-sm", overBudget ? "text-destructive" : "text-foreground")}>
              £{totalSpent.toFixed(2)}
            </p>
            {budget > 0 && (
              <p className="text-xs text-muted-foreground">/ £{budget.toFixed(2)}</p>
            )}
          </div>
          <Badge variant="secondary" className="text-xs shrink-0 hidden sm:inline-flex">
            {purchasedCount}/{yearExpenses.length}
          </Badge>
          <div className="flex gap-0.5 sm:gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(event)}>
              <Pencil className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(event)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {expanded && (
          <div className="mt-3 ml-10 space-y-3">
            {/* Address */}
            {hasAddress && (
              <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded p-2">
                <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>{addressParts.join(", ")}</span>
              </div>
            )}

            {/* Expenses */}
            {yearExpenses.length === 0 ? (
              <p className="text-sm text-muted-foreground">No items yet for {year}</p>
            ) : (
              yearExpenses.map(exp => (
                <div key={exp.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={exp.is_purchased}
                    onCheckedChange={() => onTogglePurchased(exp)}
                  />
                  <span className={cn("flex-1", exp.is_purchased && "line-through text-muted-foreground")}>
                    {exp.description}
                  </span>
                  <span className="font-medium">£{Number(exp.amount).toFixed(2)}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => onDeleteExpense(exp.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))
            )}
            <Button variant="outline" size="sm" className="mt-2" onClick={() => onAddExpense(event.id)}>
              <Plus className="h-3 w-3 mr-1" />
              Add Item
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
