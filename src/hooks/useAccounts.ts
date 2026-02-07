import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface BankAccount {
  id: string;
  user_id: string;
  name: string;
  account_type: string;
  balance: number;
  is_primary: boolean;
  display_name: string | null;
  is_hidden: boolean;
  provider: string | null;
  external_id: string | null;
  connection_id: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateAccountInput {
  name: string;
  account_type?: string;
  balance?: number;
  is_primary?: boolean;
  display_name?: string;
}

export interface UpdateAccountInput {
  id: string;
  name?: string;
  account_type?: string;
  balance?: number;
  is_primary?: boolean;
  display_name?: string;
  is_hidden?: boolean;
}

export function useAccounts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const accountsQuery = useQuery({
    queryKey: ['accounts', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bank_accounts')
        .select('*')
        .order('is_primary', { ascending: false })
        .order('name');

      if (error) throw error;
      
      // Deduplicate by id (defensive measure)
      const uniqueAccounts = Array.from(
        new Map((data || []).map(a => [a.id, a])).values()
      ) as BankAccount[];
      
      return uniqueAccounts;
    },
    enabled: !!user,
    // Auto-refresh every 10 minutes
    refetchInterval: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const createAccount = useMutation({
    mutationFn: async (input: CreateAccountInput) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('bank_accounts')
        .insert({
          user_id: user.id,
          name: input.name,
          account_type: input.account_type || 'current',
          balance: input.balance || 0,
          is_primary: input.is_primary || false,
          display_name: input.display_name || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data as BankAccount;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success('Account created');
    },
    onError: (error) => {
      toast.error(`Failed to create account: ${error.message}`);
    },
  });

  const updateAccount = useMutation({
    mutationFn: async (input: UpdateAccountInput) => {
      const { id, ...updates } = input;
      const { data, error } = await supabase
        .from('bank_accounts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as BankAccount;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success('Account updated');
    },
    onError: (error) => {
      toast.error(`Failed to update account: ${error.message}`);
    },
  });

  const deleteAccount = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('bank_accounts')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success('Account deleted');
    },
    onError: (error) => {
      toast.error(`Failed to delete account: ${error.message}`);
    },
  });

  const toggleHidden = useMutation({
    mutationFn: async ({ id, is_hidden }: { id: string; is_hidden: boolean }) => {
      const { data, error } = await supabase
        .from('bank_accounts')
        .update({ is_hidden })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as BankAccount;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success(data.is_hidden ? 'Account hidden' : 'Account visible');
    },
    onError: (error) => {
      toast.error(`Failed to update account: ${error.message}`);
    },
  });

  // All accounts (including hidden)
  const allAccounts = accountsQuery.data ?? [];
  
  // Visible accounts only (excludes hidden)
  const visibleAccounts = allAccounts.filter(a => !a.is_hidden);
  
  // Total balance excludes hidden accounts
  const totalBalance = visibleAccounts.reduce((sum, acc) => sum + Number(acc.balance), 0);

  return {
    accounts: visibleAccounts,
    allAccounts,
    visibleAccounts,
    isLoading: accountsQuery.isLoading,
    error: accountsQuery.error,
    totalBalance,
    createAccount,
    updateAccount,
    deleteAccount,
    toggleHidden,
  };
}
