import { useState } from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MoreVertical, Pencil, Trash2, ArrowDownLeft, ArrowUpRight, Receipt, Paperclip, Upload, Eye, Link, Apple } from "lucide-react";
import { Transaction } from "@/hooks/useTransactions";
import { cn } from "@/lib/utils";
import { ReceiptPreviewDialog } from "./ReceiptPreviewDialog";
import { LinkTransactionDialog } from "./LinkTransactionDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const APPLE_TAGS = [
  { label: "iCloud Storage", amount: null },
  { label: "Apple Music", amount: 10.99 },
  { label: "Apple TV+", amount: 8.99 },
  { label: "Apple One", amount: null },
  { label: "App Store", amount: null },
  { label: "Apple Arcade", amount: 6.99 },
  { label: "Other Apple", amount: null },
];

function isAppleTransaction(transaction: Transaction): boolean {
  const merchant = (transaction.merchant || "").toLowerCase();
  const description = (transaction.description || "").toLowerCase();
  return merchant.includes("apple") || description.includes("apple.com/bill") || description.includes("apple.com");
}

interface TransactionListProps {
  transactions: Transaction[];
  onEdit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
}

export function TransactionList({ transactions, onEdit, onDelete }: TransactionListProps) {
  const groupedTransactions = transactions.reduce((groups, transaction) => {
    const date = transaction.transaction_date;
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(transaction);
    return groups;
  }, {} as Record<string, Transaction[]>);

  const sortedDates = Object.keys(groupedTransactions).sort((a, b) => 
    new Date(b).getTime() - new Date(a).getTime()
  );

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {sortedDates.map((date) => (
          <div key={date}>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">
              {format(new Date(date), "EEEE, d MMMM yyyy")}
            </h3>
            <div className="space-y-2">
              {groupedTransactions[date].map((transaction) => (
                <TransactionRow
                  key={transaction.id}
                  transaction={transaction}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </TooltipProvider>
  );
}

interface TransactionRowProps {
  transaction: Transaction;
  onEdit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
}

function TransactionRow({ transaction, onEdit, onDelete }: TransactionRowProps) {
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  
  const amount = Number(transaction.amount);
  const isIncome = transaction.type === "income";
  const hasReceipt = !!transaction.receipt_path;
  const hasLinks = !!(transaction.bill || transaction.investment);
  const isApple = isAppleTransaction(transaction);

  // Check if already tagged with an Apple sub-category via merchant field
  const appleTag = isApple && transaction.merchant ? 
    APPLE_TAGS.find(t => transaction.merchant?.includes(`[${t.label}]`))?.label : null;

  const handleAppleTag = async (label: string) => {
    const baseMerchant = (transaction.merchant || "APPLE.COM/BILL").replace(/\[.*?\]/g, "").trim();
    const newMerchant = `${baseMerchant} [${label}]`;
    
    const { error } = await supabase
      .from("transactions")
      .update({ merchant: newMerchant })
      .eq("id", transaction.id);
    
    if (error) {
      toast.error("Failed to tag transaction");
    } else {
      toast.success(`Tagged as ${label}`);
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    }
  };

  return (
    <>
      <div className="group flex items-center justify-between p-3 rounded-lg border bg-card hover:shadow-sm transition-shadow">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div
            className={cn(
              "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
              isApple ? "bg-muted" : isIncome ? "bg-success/10" : "bg-destructive/10"
            )}
          >
            {isApple ? (
              <Apple className="h-5 w-5 text-foreground" />
            ) : isIncome ? (
              <ArrowDownLeft className="h-5 w-5 text-success" />
            ) : (
              <ArrowUpRight className="h-5 w-5 text-destructive" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="font-medium text-sm truncate">{transaction.description}</p>
              {hasReceipt && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setReceiptDialogOpen(true)}
                      className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Paperclip className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Receipt attached</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
              {transaction.merchant && <span>{transaction.merchant}</span>}
              {appleTag && (
                <Badge variant="secondary" className="text-xs py-0 gap-1 bg-muted">
                  <Apple className="h-3 w-3" />
                  {appleTag}
                </Badge>
              )}
              {isApple && !appleTag && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border border-dashed border-muted-foreground/40 hover:border-foreground hover:text-foreground transition-colors">
                      <Apple className="h-3 w-3" />
                      Tag service
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {APPLE_TAGS.map(tag => (
                      <DropdownMenuItem key={tag.label} onClick={() => handleAppleTag(tag.label)}>
                        {tag.label}
                        {tag.amount && <span className="ml-auto text-muted-foreground">£{tag.amount.toFixed(2)}</span>}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {transaction.bill && (
                <Badge variant="secondary" className="text-xs py-0 gap-1">
                  <Receipt className="h-3 w-3" />
                  {transaction.bill.name}
                </Badge>
              )}
              {transaction.investment && (
                <Badge variant="outline" className="text-xs py-0 gap-1 border-primary/50">
                  <Link className="h-3 w-3" />
                  {transaction.investment.name}
                </Badge>
              )}
              {transaction.category && (
                <Badge
                  variant="outline"
                  className="text-xs py-0"
                  style={{ borderColor: transaction.category.color || undefined }}
                >
                  {transaction.category.name}
                </Badge>
              )}
              {transaction.account && (
                <span className="hidden sm:inline">• {transaction.account.name}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "font-semibold whitespace-nowrap",
              isIncome ? "text-success" : "text-foreground"
            )}
          >
            {isIncome ? "+" : "-"}£{amount.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="sm:opacity-0 sm:group-hover:opacity-100 transition-opacity h-8 w-8"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setLinkDialogOpen(true)}>
                <Link className="h-4 w-4 mr-2" />
                Link to...
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setReceiptDialogOpen(true)}>
                {hasReceipt ? (
                  <>
                    <Eye className="h-4 w-4 mr-2" />
                    View receipt
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload receipt
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onEdit(transaction)}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(transaction)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <ReceiptPreviewDialog
        open={receiptDialogOpen}
        onOpenChange={setReceiptDialogOpen}
        transactionId={transaction.id}
        transactionDescription={transaction.description}
        receiptPath={transaction.receipt_path}
      />

      <LinkTransactionDialog
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        transaction={transaction}
      />
    </>
  );
}
