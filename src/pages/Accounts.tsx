import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { CreditCard, Plus, Wallet, Loader2, Eye, EyeOff } from "lucide-react";
import { useAccounts, BankAccount, CreateAccountInput, UpdateAccountInput } from "@/hooks/useAccounts";
import { useBankConnections } from "@/hooks/useBankConnections";
import { AccountCard } from "@/components/accounts/AccountCard";
import { AccountFormDialog } from "@/components/accounts/AccountFormDialog";
import { DeleteAccountDialog } from "@/components/accounts/DeleteAccountDialog";
import { BankConnectionCard } from "@/components/accounts/BankConnectionCard";

export default function Accounts() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { 
    accounts, 
    allAccounts, 
    isLoading, 
    totalBalance, 
    createAccount, 
    updateAccount, 
    deleteAccount,
    toggleHidden 
  } = useAccounts();
  const { connections, completeConnection } = useBankConnections();
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<BankAccount | null>(null);
  const [isProcessingCallback, setIsProcessingCallback] = useState(false);
  const [showHiddenAccounts, setShowHiddenAccounts] = useState(false);

  // Create a map of connection_id -> status for quick lookup
  const connectionStatusMap = new Map(
    connections.map(conn => [conn.id, conn.status])
  );

  // Handle TrueLayer OAuth callback
  useEffect(() => {
    const isCallback = searchParams.get('truelayer_callback');
    const code = searchParams.get('code');
    const connectionId = localStorage.getItem('pending_bank_connection_id');

    if (isCallback && code && connectionId && !isProcessingCallback) {
      setIsProcessingCallback(true);
      
      // Clear URL params
      setSearchParams({});
      
      // Complete the connection
      completeConnection.mutate(
        { code, connectionId },
        {
          onSettled: () => {
            setIsProcessingCallback(false);
          },
        }
      );
    }
  }, [searchParams, setSearchParams, completeConnection, isProcessingCallback]);

  const handleAdd = () => {
    setSelectedAccount(null);
    setFormOpen(true);
  };

  const handleEdit = (account: BankAccount) => {
    setSelectedAccount(account);
    setFormOpen(true);
  };

  const handleDelete = (account: BankAccount) => {
    setSelectedAccount(account);
    setDeleteOpen(true);
  };

  const handleToggleHidden = (account: BankAccount) => {
    toggleHidden.mutate({ id: account.id, is_hidden: !account.is_hidden });
  };

  const handleFormSubmit = async (data: CreateAccountInput | UpdateAccountInput) => {
    if ('id' in data) {
      await updateAccount.mutateAsync(data);
    } else {
      await createAccount.mutateAsync(data);
    }
    setFormOpen(false);
  };

  const handleDeleteConfirm = async () => {
    if (selectedAccount) {
      await deleteAccount.mutateAsync(selectedAccount.id);
      setDeleteOpen(false);
    }
  };

  // Filter accounts based on visibility toggle
  const displayedAccounts = showHiddenAccounts ? allAccounts : accounts;
  const hiddenCount = allAccounts.length - accounts.length;

  // Show loading state while processing OAuth callback
  if (isProcessingCallback || completeConnection.isPending) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <h2 className="text-xl font-semibold mb-2">Connecting your bank...</h2>
          <p className="text-muted-foreground">
            We're syncing your accounts and transactions. This may take a moment.
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Accounts</h1>
            <p className="text-muted-foreground">
              Manage your bank accounts and balances
            </p>
          </div>
          <Button onClick={handleAdd} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Account
          </Button>
        </div>

        {/* Bank Connection Card */}
        <BankConnectionCard />

        {/* Total Balance Card */}
        <Card className="bg-primary text-primary-foreground">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium opacity-90 flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Total Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-10 w-40 bg-primary-foreground/20" />
            ) : (
              <p className="text-3xl font-bold">
                £{totalBalance.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            )}
            <p className="text-sm opacity-80 mt-1">
              Across {accounts.length} visible account{accounts.length !== 1 ? 's' : ''}
              {hiddenCount > 0 && (
                <span className="ml-1">({hiddenCount} hidden)</span>
              )}
            </p>
          </CardContent>
        </Card>

        {/* Show Hidden Toggle */}
        {hiddenCount > 0 && (
          <div className="flex items-center gap-2">
            <Switch
              id="show-hidden"
              checked={showHiddenAccounts}
              onCheckedChange={setShowHiddenAccounts}
            />
            <Label htmlFor="show-hidden" className="text-sm text-muted-foreground cursor-pointer flex items-center gap-2">
              {showHiddenAccounts ? (
                <Eye className="h-4 w-4" />
              ) : (
                <EyeOff className="h-4 w-4" />
              )}
              Show hidden accounts ({hiddenCount})
            </Label>
          </div>
        )}

        {/* Accounts Grid */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <Skeleton className="h-4 w-24 mt-2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-32" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : displayedAccounts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <CreditCard className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">No accounts yet</h3>
              <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
                Add your bank accounts manually or connect your bank for automatic syncing.
              </p>
              <Button onClick={handleAdd} variant="outline" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Account Manually
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {displayedAccounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                connectionStatus={account.connection_id ? connectionStatusMap.get(account.connection_id) : null}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onToggleHidden={handleToggleHidden}
              />
            ))}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <AccountFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        account={selectedAccount}
        onSubmit={handleFormSubmit}
        isLoading={createAccount.isPending || updateAccount.isPending}
      />

      <DeleteAccountDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        account={selectedAccount}
        onConfirm={handleDeleteConfirm}
        isLoading={deleteAccount.isPending}
      />
    </AppLayout>
  );
}
