import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChevronLeft, ChevronRight, Search, X, Calendar, Wallet, Mail, RefreshCw, CheckCircle } from "lucide-react";
import { useCategories } from "@/hooks/useCategories";
import { useAccounts } from "@/hooks/useAccounts";
import { useTransactionTags } from "@/hooks/useTransactionTags";
import { useGmailConnection } from "@/hooks/useGmailConnection";
import { usePaydaySettings } from "@/hooks/usePaydaySettings";
import { TransactionFilters as FilterType } from "@/hooks/useTransactions";
import { 
  getPayCycleForDate, 
  getNextPayCycle, 
  getPrevPayCycle, 
  formatPayCycleLabel,
  formatPayCycleLabelShort,
  toPaydaySettings,
  PayCycle 
} from "@/lib/payCycle";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";

interface TransactionFiltersProps {
  filters: FilterType;
  onFiltersChange: (filters: FilterType) => void;
}

type ViewMode = "paycycle" | "month";

export function TransactionFilters({ filters, onFiltersChange }: TransactionFiltersProps) {
  const { data: categories = [] } = useCategories();
  const { accounts } = useAccounts();
  const { tags } = useTransactionTags();
  const { effectiveSettings } = usePaydaySettings();
  const isMobile = useIsMobile();
  const { isConnected, connection, sync, connect, isSyncing, isConnecting } = useGmailConnection();
  const [searchValue, setSearchValue] = useState(filters.search || "");
  const [viewMode, setViewMode] = useState<ViewMode>("paycycle");
  const [currentPayCycle, setCurrentPayCycle] = useState<PayCycle | null>(null);

  // Initialize pay cycle on mount
  useEffect(() => {
    const paydaySettings = toPaydaySettings(effectiveSettings);
    const cycle = getPayCycleForDate(new Date(), paydaySettings);
    setCurrentPayCycle(cycle);
    
    // Only update filters if in paycycle mode
    if (viewMode === "paycycle") {
      onFiltersChange({
        ...filters,
        dateFrom: cycle.start,
        dateTo: cycle.end,
      });
    }
  }, [effectiveSettings]);

  const currentMonth = filters.dateFrom || startOfMonth(new Date());

  const goToPreviousMonth = () => {
    const newStart = subMonths(currentMonth, 1);
    onFiltersChange({
      ...filters,
      dateFrom: startOfMonth(newStart),
      dateTo: endOfMonth(newStart),
    });
  };

  const goToNextMonth = () => {
    const newStart = addMonths(currentMonth, 1);
    onFiltersChange({
      ...filters,
      dateFrom: startOfMonth(newStart),
      dateTo: endOfMonth(newStart),
    });
  };

  const goToPreviousPayCycle = () => {
    if (!currentPayCycle) return;
    const paydaySettings = toPaydaySettings(effectiveSettings);
    const prevCycle = getPrevPayCycle(currentPayCycle, paydaySettings);
    setCurrentPayCycle(prevCycle);
    onFiltersChange({
      ...filters,
      dateFrom: prevCycle.start,
      dateTo: prevCycle.end,
    });
  };

  const goToNextPayCycle = () => {
    if (!currentPayCycle) return;
    const paydaySettings = toPaydaySettings(effectiveSettings);
    const nextCycle = getNextPayCycle(currentPayCycle, paydaySettings);
    setCurrentPayCycle(nextCycle);
    onFiltersChange({
      ...filters,
      dateFrom: nextCycle.start,
      dateTo: nextCycle.end,
    });
  };

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    const paydaySettings = toPaydaySettings(effectiveSettings);

    if (mode === "paycycle") {
      const cycle = getPayCycleForDate(new Date(), paydaySettings);
      setCurrentPayCycle(cycle);
      onFiltersChange({
        ...filters,
        dateFrom: cycle.start,
        dateTo: cycle.end,
      });
    } else {
      onFiltersChange({
        ...filters,
        dateFrom: startOfMonth(new Date()),
        dateTo: endOfMonth(new Date()),
      });
    }
  };

  const handleSearch = () => {
    onFiltersChange({ ...filters, search: searchValue || undefined });
  };

  const clearSearch = () => {
    setSearchValue("");
    onFiltersChange({ ...filters, search: undefined });
  };

  const clearFilters = () => {
    setSearchValue("");
    const paydaySettings = toPaydaySettings(effectiveSettings);
    
    if (viewMode === "paycycle") {
      const cycle = getPayCycleForDate(new Date(), paydaySettings);
      setCurrentPayCycle(cycle);
      onFiltersChange({
        dateFrom: cycle.start,
        dateTo: cycle.end,
      });
    } else {
      onFiltersChange({
        dateFrom: startOfMonth(new Date()),
        dateTo: endOfMonth(new Date()),
      });
    }
  };

  const hasActiveFilters = filters.categoryId || filters.type || filters.accountId || filters.search || (filters.tagIds && filters.tagIds.length > 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">Filters</CardTitle>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* View Mode Toggle */}
        <Tabs value={viewMode} onValueChange={(v) => handleViewModeChange(v as ViewMode)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="paycycle" className="gap-2">
              <Wallet className="h-3.5 w-3.5" />
              Pay Cycle
            </TabsTrigger>
            <TabsTrigger value="month" className="gap-2">
              <Calendar className="h-3.5 w-3.5" />
              Month
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Date Navigator */}
        {viewMode === "paycycle" ? (
          <div className="flex items-center justify-between gap-2">
            <Button variant="outline" size="icon" onClick={goToPreviousPayCycle}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-medium text-sm text-center flex-1 truncate">
              {currentPayCycle 
                ? (isMobile 
                    ? formatPayCycleLabelShort(currentPayCycle) 
                    : formatPayCycleLabel(currentPayCycle))
                : "Loading..."}
            </span>
            <Button variant="outline" size="icon" onClick={goToNextPayCycle}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <Button variant="outline" size="icon" onClick={goToPreviousMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-medium">{format(currentMonth, "MMMM yyyy")}</span>
            <Button variant="outline" size="icon" onClick={goToNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Search */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search transactions..."
              className="pl-8"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>
          {searchValue && (
            <Button variant="outline" size="icon" onClick={clearSearch}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Filter Selects */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Select
            value={filters.type || "all"}
            onValueChange={(value) =>
              onFiltersChange({
                ...filters,
                type: value === "all" ? undefined : (value as "income" | "expense"),
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="expense">Expense</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.categoryId || "all"}
            onValueChange={(value) =>
              onFiltersChange({
                ...filters,
                categoryId: value === "all" ? undefined : value,
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.accountId || "all"}
            onValueChange={(value) =>
              onFiltersChange({
                ...filters,
                accountId: value === "all" ? undefined : value,
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Account" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Accounts</SelectItem>
              {accounts.map((acc) => (
                <SelectItem key={acc.id} value={acc.id}>
                  {acc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.tagIds?.[0] || "all"}
            onValueChange={(value) =>
              onFiltersChange({
                ...filters,
                tagIds: value === "all" ? undefined : [value],
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Tag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tags</SelectItem>
              {tags.map((tag) => (
                <SelectItem key={tag.id} value={tag.id}>
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full inline-block" style={{ backgroundColor: tag.color }} />
                    {tag.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Gmail Integration */}
        <div className="pt-2 border-t">
          {isConnected ? (
            <div className="space-y-1.5">
              <Button 
                variant="outline" 
                className="w-full gap-2" 
                disabled={isSyncing}
                onClick={() => sync()}
              >
                <RefreshCw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
                {isSyncing ? "Syncing..." : "Sync Receipts"}
              </Button>
              <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
                <CheckCircle className="h-3 w-3 text-success" />
                <span>Gmail connected</span>
                {connection?.last_synced_at && (
                  <span>· Last sync {format(new Date(connection.last_synced_at), "d MMM HH:mm")}</span>
                )}
              </div>
            </div>
          ) : (
            <Button 
              variant="outline" 
              className="w-full gap-2" 
              disabled={isConnecting}
              onClick={() => connect()}
            >
              <Mail className="h-4 w-4" />
              {isConnecting ? "Connecting..." : "Connect Gmail"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
