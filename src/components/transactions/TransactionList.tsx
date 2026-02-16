import { useState, useMemo, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { MoreVertical, Pencil, Trash2, ArrowDownLeft, ArrowUpRight, Receipt, Paperclip, Upload, Eye, Link, Apple, Mail } from "lucide-react";
import { Transaction } from "@/hooks/useTransactions";
import { cn } from "@/lib/utils";
import { ReceiptPreviewDialog } from "./ReceiptPreviewDialog";
import { LinkTransactionDialog } from "./LinkTransactionDialog";
import { TagAssignPopover, TransactionTagBadges } from "./TagAssignPopover";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useTransactionTags, useTagAssignments } from "@/hooks/useTransactionTags";
import { Virtuoso } from "react-virtuoso";

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

interface FlatItem {
  type: "header" | "transaction";
  date?: string;
  transaction?: Transaction;
  gmailReceipt?: any;
}

export function TransactionList({ transactions, onEdit, onDelete }: TransactionListProps) {
  const { user } = useAuth();
  const { tags } = useTransactionTags();

  const transactionIds = useMemo(() => transactions.map(t => t.id), [transactions]);
  const { assignmentMap, assign, unassign } = useTagAssignments(transactionIds);

  const { data: gmailMatches } = useQuery({
    queryKey: ["gmail-receipt-matches", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("gmail_receipts")
        .select("matched_transaction_id, merchant_name, amount, match_confidence, subject, from_email, received_at, order_reference")
        .eq("user_id", user.id)
        .eq("match_status", "matched")
        .not("matched_transaction_id", "is", null);
      return data || [];
    },
    enabled: !!user,
  });

  const gmailMatchMap = useMemo(
    () => new Map((gmailMatches || []).map(r => [r.matched_transaction_id, r])),
    [gmailMatches]
  );

  const flatItems = useMemo<FlatItem[]>(() => {
    const grouped = transactions.reduce((groups, transaction) => {
      const date = transaction.transaction_date;
      if (!groups[date]) groups[date] = [];
      groups[date].push(transaction);
      return groups;
    }, {} as Record<string, Transaction[]>);

    const sortedDates = Object.keys(grouped).sort((a, b) =>
      new Date(b).getTime() - new Date(a).getTime()
    );

    const items: FlatItem[] = [];
    for (const date of sortedDates) {
      items.push({ type: "header", date });
      for (const tx of grouped[date]) {
        items.push({
          type: "transaction",
          transaction: tx,
          gmailReceipt: gmailMatchMap.get(tx.id) || null,
        });
      }
    }
    return items;
  }, [transactions, gmailMatchMap]);

  const handleAssign = useCallback((transactionId: string, tagId: string) => {
    assign.mutate({ transactionId, tagId });
  }, [assign]);

  const handleUnassign = useCallback((transactionId: string, tagId: string) => {
    unassign.mutate({ transactionId, tagId });
  }, [unassign]);

  const renderItem = useCallback(
    (index: number) => {
      const item = flatItems[index];
      if (item.type === "header") {
        return (
          <h3 className="text-sm font-medium text-muted-foreground mb-3 mt-6 first:mt-0 px-1">
            {format(new Date(item.date!), "EEEE, d MMMM yyyy")}
          </h3>
        );
      }
      return (
        <div className="mb-2">
          <TransactionRow
            transaction={item.transaction!}
            onEdit={onEdit}
            onDelete={onDelete}
            gmailReceipt={item.gmailReceipt}
            allTags={tags}
            assignedTagIds={assignmentMap.get(item.transaction!.id) || []}
            onAssignTag={(tagId) => handleAssign(item.transaction!.id, tagId)}
            onUnassignTag={(tagId) => handleUnassign(item.transaction!.id, tagId)}
          />
        </div>
      );
    },
    [flatItems, onEdit, onDelete, tags, assignmentMap, handleAssign, handleUnassign]
  );

  if (flatItems.length > 50) {
    return (
      <TooltipProvider>
        <Virtuoso
          style={{ height: "calc(100vh - 280px)" }}
          totalCount={flatItems.length}
          overscan={20}
          itemContent={renderItem}
        />
      </TooltipProvider>
    );
  }

  // Small list — render normally
  const grouped = transactions.reduce((groups, transaction) => {
    const date = transaction.transaction_date;
    if (!groups[date]) groups[date] = [];
    groups[date].push(transaction);
    return groups;
  }, {} as Record<string, Transaction[]>);

  const sortedDates = Object.keys(grouped).sort((a, b) =>
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
              {grouped[date].map((transaction) => (
                <TransactionRow
                  key={transaction.id}
                  transaction={transaction}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  gmailReceipt={gmailMatchMap.get(transaction.id) || null}
                  allTags={tags}
                  assignedTagIds={assignmentMap.get(transaction.id) || []}
                  onAssignTag={(tagId) => handleAssign(transaction.id, tagId)}
                  onUnassignTag={(tagId) => handleUnassign(transaction.id, tagId)}
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
  gmailReceipt: { merchant_name: string | null; amount: number | null; match_confidence: string | null; subject: string | null; from_email: string | null; received_at: string | null; order_reference: string | null } | null;
  allTags: { id: string; name: string; color: string }[];
  assignedTagIds: string[];
  onAssignTag: (tagId: string) => void;
  onUnassignTag: (tagId: string) => void;
}

function TransactionRow({ transaction, onEdit, onDelete, gmailReceipt, allTags, assignedTagIds, onAssignTag, onUnassignTag }: TransactionRowProps) {
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [gmailReceiptOpen, setGmailReceiptOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  
  const amount = Number(transaction.amount);
  const isIncome = transaction.type === "income";
  const hasReceipt = !!transaction.receipt_path;
  const hasGmailReceipt = !!gmailReceipt;
  const isApple = isAppleTransaction(transaction);

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
       <div className="group flex items-center gap-2 p-3 rounded-lg border bg-card hover:shadow-sm transition-shadow overflow-hidden">
        <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
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
          <div className="min-w-0 flex-1 overflow-hidden">
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
              {hasGmailReceipt && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setGmailReceiptOpen(true)}
                      className="shrink-0"
                    >
                      <Badge variant="secondary" className="text-xs py-0 gap-1 bg-success/10 text-success border-success/30 cursor-pointer hover:bg-success/20 transition-colors">
                        <Mail className="h-3 w-3" />
                        <span className="hidden sm:inline">View receipt</span>
                      </Badge>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Click to view Gmail receipt details ({gmailReceipt.match_confidence} confidence)</p>
                  </TooltipContent>
                </Tooltip>
              )}
              <TagAssignPopover
                transactionId={transaction.id}
                allTags={allTags}
                assignedTagIds={assignedTagIds}
                onAssign={onAssignTag}
                onUnassign={onUnassignTag}
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
              {transaction.merchant && <span className="truncate max-w-[120px] sm:max-w-none">{transaction.merchant}</span>}
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
              <TransactionTagBadges tagIds={assignedTagIds} allTags={allTags} />
              {transaction.account && (
                <span className="hidden sm:inline">• {transaction.account.name}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
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

      {hasGmailReceipt && gmailReceipt && (
        <Dialog open={gmailReceiptOpen} onOpenChange={setGmailReceiptOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader className="pr-8">
              <DialogTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-success" />
                Gmail Receipt
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-sm">
                <span className="text-muted-foreground">Merchant</span>
                <span className="font-medium">{gmailReceipt.merchant_name || transaction.merchant || transaction.description}</span>

                <span className="text-muted-foreground">Amount</span>
                <span className="font-medium">
                  £{(gmailReceipt.amount ?? Number(transaction.amount)).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>

                {gmailReceipt.subject && (
                  <>
                    <span className="text-muted-foreground">Subject</span>
                    <span className="font-medium break-words">{gmailReceipt.subject}</span>
                  </>
                )}

                {gmailReceipt.from_email && (
                  <>
                    <span className="text-muted-foreground">From</span>
                    <span className="font-medium text-xs break-all">{gmailReceipt.from_email}</span>
                  </>
                )}

                {gmailReceipt.order_reference && (
                  <>
                    <span className="text-muted-foreground">Order ref</span>
                    <span className="font-mono text-xs break-all">{gmailReceipt.order_reference}</span>
                  </>
                )}

                {gmailReceipt.received_at && (
                  <>
                    <span className="text-muted-foreground">Received</span>
                    <span className="font-medium">{format(new Date(gmailReceipt.received_at), "d MMM yyyy, HH:mm")}</span>
                  </>
                )}

                <span className="text-muted-foreground">Confidence</span>
                <span>
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-xs",
                      gmailReceipt.match_confidence === "high" && "border-success/50 text-success",
                      gmailReceipt.match_confidence === "medium" && "border-warning/50 text-warning",
                      gmailReceipt.match_confidence === "low" && "border-destructive/50 text-destructive",
                    )}
                  >
                    {gmailReceipt.match_confidence}
                  </Badge>
                </span>
              </div>

              <div className="pt-2 border-t flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={async () => {
                    const { error } = await supabase
                      .from("gmail_receipts")
                      .update({
                        match_status: "dismissed",
                        matched_transaction_id: null,
                        matched_at: null,
                      })
                      .eq("matched_transaction_id", transaction.id);
                    if (!error) {
                      toast.success("Receipt unlinked");
                      queryClient.invalidateQueries({ queryKey: ["gmail-receipt-matches"] });
                      setGmailReceiptOpen(false);
                    } else {
                      toast.error("Failed to unlink receipt");
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Wrong match — unlink
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
