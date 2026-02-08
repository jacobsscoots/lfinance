-- Update bills FK to cascade delete when account is deleted
ALTER TABLE public.bills 
DROP CONSTRAINT IF EXISTS bills_account_id_fkey;

ALTER TABLE public.bills 
ADD CONSTRAINT bills_account_id_fkey 
FOREIGN KEY (account_id) 
REFERENCES public.bank_accounts(id) 
ON DELETE CASCADE;