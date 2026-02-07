import { useState, useEffect } from 'react';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogFooter,
} from '@/components/ui/responsive-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import { BankAccount, CreateAccountInput, UpdateAccountInput } from '@/hooks/useAccounts';

interface AccountFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: BankAccount | null;
  onSubmit: (data: CreateAccountInput | UpdateAccountInput) => void;
  isLoading?: boolean;
}

const accountTypes = [
  { value: 'current', label: 'Current Account' },
  { value: 'savings', label: 'Savings Account' },
  { value: 'credit', label: 'Credit Card' },
  { value: 'business', label: 'Business Account' },
];

export function AccountFormDialog({ open, onOpenChange, account, onSubmit, isLoading }: AccountFormDialogProps) {
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [accountType, setAccountType] = useState('current');
  const [balance, setBalance] = useState('0');
  const [isPrimary, setIsPrimary] = useState(false);

  const isEditing = !!account;
  const isLinkedAccount = !!account?.external_id;

  useEffect(() => {
    if (account) {
      setName(account.name);
      setDisplayName(account.display_name || '');
      setAccountType(account.account_type);
      setBalance(String(account.balance));
      setIsPrimary(account.is_primary);
    } else {
      setName('');
      setDisplayName('');
      setAccountType('current');
      setBalance('0');
      setIsPrimary(false);
    }
  }, [account, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const data = {
      ...(isEditing && { id: account.id }),
      name,
      display_name: displayName.trim() || null,
      account_type: accountType,
      balance: parseFloat(balance) || 0,
      is_primary: isPrimary,
    };

    onSubmit(data);
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{isEditing ? 'Edit Account' : 'Add Account'}</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {isEditing && isLinkedAccount && (
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                placeholder="Custom name for this account"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                This overrides the synced name from your bank
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">
              {isLinkedAccount ? 'Bank Account Name' : 'Account Name'}
            </Label>
            <Input
              id="name"
              placeholder="e.g., Monzo Current"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={isLinkedAccount}
            />
            {isLinkedAccount && (
              <p className="text-xs text-muted-foreground">
                This name is synced from your bank. Use Display Name above to customize.
              </p>
            )}
          </div>

          {!isLinkedAccount && !isEditing && (
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name (Optional)</Label>
              <Input
                id="displayName"
                placeholder="Custom display name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="type">Account Type</Label>
            <Select value={accountType} onValueChange={setAccountType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                {accountTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!isLinkedAccount && (
            <div className="space-y-2">
              <Label htmlFor="balance">Current Balance (£)</Label>
              <Input
                id="balance"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
              />
            </div>
          )}

          {isLinkedAccount && (
            <div className="space-y-2">
              <Label>Current Balance</Label>
              <p className="text-lg font-semibold">
                £{Number(balance).toLocaleString('en-GB', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-muted-foreground">
                Balance is synced automatically from your bank
              </p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <Label htmlFor="primary" className="cursor-pointer">Primary Account</Label>
            <Switch
              id="primary"
              checked={isPrimary}
              onCheckedChange={setIsPrimary}
            />
          </div>

          <ResponsiveDialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !name.trim()}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Save Changes' : 'Add Account'}
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
