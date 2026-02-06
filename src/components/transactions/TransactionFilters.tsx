import { useState } from "react";
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
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { useCategories } from "@/hooks/useCategories";
import { useAccounts } from "@/hooks/useAccounts";
import { TransactionFilters as FilterType } from "@/hooks/useTransactions";

interface TransactionFiltersProps {
  filters: FilterType;
  onFiltersChange: (filters: FilterType) => void;
}

export function TransactionFilters({ filters, onFiltersChange }: TransactionFiltersProps) {
  const { data: categories = [] } = useCategories();
  const { accounts } = useAccounts();
  const [searchValue, setSearchValue] = useState(filters.search || "");

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

  const handleSearch = () => {
    onFiltersChange({ ...filters, search: searchValue || undefined });
  };

  const clearSearch = () => {
    setSearchValue("");
    onFiltersChange({ ...filters, search: undefined });
  };

  const clearFilters = () => {
    setSearchValue("");
    onFiltersChange({
      dateFrom: startOfMonth(new Date()),
      dateTo: endOfMonth(new Date()),
    });
  };

  const hasActiveFilters = filters.categoryId || filters.type || filters.accountId || filters.search;

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
        {/* Month Navigator */}
        <div className="flex items-center justify-between">
          <Button variant="outline" size="icon" onClick={goToPreviousMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-medium">{format(currentMonth, "MMMM yyyy")}</span>
          <Button variant="outline" size="icon" onClick={goToNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
        </div>
      </CardContent>
    </Card>
  );
}
