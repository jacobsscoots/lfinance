
-- Create sync_logs table for tracking automated sync attempts
CREATE TABLE public.sync_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  connection_id UUID REFERENCES public.bank_connections(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, success, failed, token_expired
  accounts_synced INTEGER DEFAULT 0,
  transactions_synced INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their own sync logs
CREATE POLICY "Users can view their own sync logs"
  ON public.sync_logs FOR SELECT
  USING (auth.uid() = user_id);

-- Service role inserts (no authenticated insert policy needed)

-- Add last_sync_error column to bank_connections for surfacing issues in UI
ALTER TABLE public.bank_connections ADD COLUMN IF NOT EXISTS last_sync_error TEXT;

-- Index for efficient cron queries
CREATE INDEX idx_sync_logs_connection_status ON public.sync_logs(connection_id, status);
CREATE INDEX idx_bank_connections_status ON public.bank_connections(status);
