import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreVertical, Pencil, Trash2, CreditCard, Wallet, PiggyBank, Building2, Eye, EyeOff } from 'lucide-react';
import { BankAccount } from '@/hooks/useAccounts';
import { getProviderLabel } from '@/lib/bankProviders';
import { cn } from '@/lib/utils';

interface AccountCardProps {
  account: BankAccount;
  onEdit: (account: BankAccount) => void;
  onDelete: (account: BankAccount) => void;
  onToggleHidden?: (account: BankAccount) => void;
}

const accountTypeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  current: Wallet,
  savings: PiggyBank,
  credit: CreditCard,
  business: Building2,
};

export function AccountCard({ account, onEdit, onDelete, onToggleHidden }: AccountCardProps) {
  const Icon = accountTypeIcons[account.account_type] || Wallet;
  const balance = Number(account.balance);
  const isNegative = balance < 0;
  
  // Use display_name if set, otherwise fall back to provider label or name
  const displayName = account.display_name || account.name;
  const providerLabel = account.provider ? getProviderLabel(account.provider) : null;

  return (
    <Card className={cn(
      "group hover:shadow-md transition-shadow",
      account.is_hidden && "opacity-60"
    )}>
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base font-medium flex items-center gap-2">
              {displayName}
              {account.is_primary && (
                <Badge variant="secondary" className="text-xs">Primary</Badge>
              )}
              {account.is_hidden && (
                <Badge variant="outline" className="text-xs">Hidden</Badge>
              )}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {providerLabel ? (
                <span>{providerLabel} · <span className="capitalize">{account.account_type}</span></span>
              ) : (
                <span className="capitalize">{account.account_type} account</span>
              )}
            </p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(account)}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            {onToggleHidden && (
              <DropdownMenuItem onClick={() => onToggleHidden(account)}>
                {account.is_hidden ? (
                  <>
                    <Eye className="h-4 w-4 mr-2" />
                    Show Account
                  </>
                ) : (
                  <>
                    <EyeOff className="h-4 w-4 mr-2" />
                    Hide Account
                  </>
                )}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(account)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent>
        <p className={cn(
          "text-2xl font-bold",
          isNegative ? "text-destructive" : "text-foreground"
        )}>
          {isNegative ? '-' : ''}£{Math.abs(balance).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      </CardContent>
    </Card>
  );
}
