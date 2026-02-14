-- Add linked_account_id to debts table for auto-sync from bank accounts
ALTER TABLE public.debts 
ADD COLUMN linked_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL;

-- Create index for lookup
CREATE INDEX idx_debts_linked_account ON public.debts(linked_account_id) WHERE linked_account_id IS NOT NULL;

-- Create a function that syncs debt balances from linked bank accounts
-- Called after bank sync completes
CREATE OR REPLACE FUNCTION public.sync_debt_from_linked_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- When a bank account balance changes, update any linked debt
  -- Credit card balances are negative in bank_accounts, positive in debts
  UPDATE public.debts 
  SET current_balance = ABS(NEW.balance),
      updated_at = now()
  WHERE linked_account_id = NEW.id
    AND status = 'open';
  
  RETURN NEW;
END;
$$;

-- Trigger on bank_accounts balance update
CREATE TRIGGER sync_debt_balance_on_account_update
AFTER UPDATE OF balance ON public.bank_accounts
FOR EACH ROW
WHEN (OLD.balance IS DISTINCT FROM NEW.balance)
EXECUTE FUNCTION public.sync_debt_from_linked_account();