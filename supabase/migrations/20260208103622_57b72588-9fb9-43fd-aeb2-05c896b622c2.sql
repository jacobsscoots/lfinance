-- Add notification_email column to cheaper_bills_settings
ALTER TABLE public.cheaper_bills_settings
ADD COLUMN IF NOT EXISTS notification_email TEXT;

-- Create bright_connections table for smart meter integration
CREATE TABLE IF NOT EXISTS public.bright_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  access_token TEXT,
  token_expires_at TIMESTAMPTZ,
  electricity_resource_id TEXT,
  gas_resource_id TEXT,
  last_synced_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS on bright_connections
ALTER TABLE public.bright_connections ENABLE ROW LEVEL SECURITY;

-- Create policies for bright_connections
CREATE POLICY "Users can view their own bright connection" 
ON public.bright_connections 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own bright connection" 
ON public.bright_connections 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bright connection" 
ON public.bright_connections 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bright connection" 
ON public.bright_connections 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_bright_connections_updated_at
BEFORE UPDATE ON public.bright_connections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();