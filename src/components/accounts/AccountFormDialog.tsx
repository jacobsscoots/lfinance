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
  const [accountType, setAccountType] = useState('current');
  const [balance, setBalance] = useState('0');
  const [isPrimary, setIsPrimary] = useState(false);

  const isEditing = !!account;

  useEffect(() => {
    if (account) {
      setName(account.name);
      setAccountType(account.account_type);
      setBalance(String(account.balance));
      setIsPrimary(account.is_primary);
    } else {
      setName('');
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
          <div className="space-y-2">
            <Label htmlFor="name">Account Name</Label>
            <Input
              id="name"
              placeholder="e.g., Monzo Current"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

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
