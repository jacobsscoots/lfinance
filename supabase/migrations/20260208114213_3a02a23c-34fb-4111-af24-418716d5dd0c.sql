-- Deal Sources: RSS feeds, APIs, HTML pages to scan
CREATE TABLE public.deal_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('rss', 'api', 'html', 'manual')),
  base_url TEXT NOT NULL,
  scan_url TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  scan_frequency_minutes INTEGER DEFAULT 60,
  last_scan_at TIMESTAMPTZ,
  last_scan_status TEXT CHECK (last_scan_status IN ('success', 'fail', 'pending')),
  last_error TEXT,
  etag TEXT,
  last_modified TEXT,
  rate_limit_ms INTEGER DEFAULT 1000,
  max_pages INTEGER DEFAULT 5,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Deal Rules: User's filter preferences
CREATE TABLE public.deal_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  keywords_include TEXT[] DEFAULT '{}',
  keywords_exclude TEXT[] DEFAULT '{}',
  category TEXT,
  min_price NUMERIC,
  max_price NUMERIC,
  min_discount_percent NUMERIC,
  store_whitelist TEXT[] DEFAULT '{}',
  store_blacklist TEXT[] DEFAULT '{}',
  shipping_filter TEXT,
  location_filter TEXT,
  notify_email BOOLEAN DEFAULT true,
  notify_in_app BOOLEAN DEFAULT true,
  alert_cooldown_minutes INTEGER DEFAULT 60,
  last_notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Deals: Normalized deal records
CREATE TABLE public.deals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  source_id UUID REFERENCES public.deal_sources(id) ON DELETE CASCADE,
  source_name TEXT NOT NULL,
  title TEXT NOT NULL,
  price NUMERIC NOT NULL,
  old_price NUMERIC,
  discount_percent NUMERIC,
  currency TEXT DEFAULT 'GBP',
  url TEXT NOT NULL,
  image_url TEXT,
  store TEXT,
  category TEXT,
  description_snippet TEXT,
  hash TEXT NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_new BOOLEAN DEFAULT true,
  price_dropped BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create unique index on hash per user for deduplication
CREATE UNIQUE INDEX deals_user_hash_idx ON public.deals(user_id, hash);

-- Deal Price History
CREATE TABLE public.deal_price_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  price NUMERIC NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Deal Notifications: In-app alerts
CREATE TABLE public.deal_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  deal_id UUID REFERENCES public.deals(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES public.deal_rules(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  message TEXT,
  is_read BOOLEAN DEFAULT false,
  notification_type TEXT DEFAULT 'new_deal',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Deal Scan Logs
CREATE TABLE public.deal_scan_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  source_id UUID REFERENCES public.deal_sources(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  status TEXT CHECK (status IN ('running', 'success', 'fail', 'partial')),
  deals_found INTEGER DEFAULT 0,
  deals_inserted INTEGER DEFAULT 0,
  deals_updated INTEGER DEFAULT 0,
  error_message TEXT,
  request_time_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.deal_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_scan_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for deal_sources
CREATE POLICY "Users can view their own deal sources" ON public.deal_sources FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own deal sources" ON public.deal_sources FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own deal sources" ON public.deal_sources FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own deal sources" ON public.deal_sources FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for deal_rules
CREATE POLICY "Users can view their own deal rules" ON public.deal_rules FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own deal rules" ON public.deal_rules FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own deal rules" ON public.deal_rules FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own deal rules" ON public.deal_rules FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for deals
CREATE POLICY "Users can view their own deals" ON public.deals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own deals" ON public.deals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own deals" ON public.deals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own deals" ON public.deals FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for deal_price_history
CREATE POLICY "Users can view their own price history" ON public.deal_price_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own price history" ON public.deal_price_history FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for deal_notifications
CREATE POLICY "Users can view their own notifications" ON public.deal_notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own notifications" ON public.deal_notifications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own notifications" ON public.deal_notifications FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for deal_scan_logs
CREATE POLICY "Users can view their own scan logs" ON public.deal_scan_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own scan logs" ON public.deal_scan_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own scan logs" ON public.deal_scan_logs FOR UPDATE USING (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_deal_sources_updated_at BEFORE UPDATE ON public.deal_sources FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_deal_rules_updated_at BEFORE UPDATE ON public.deal_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_deals_updated_at BEFORE UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();