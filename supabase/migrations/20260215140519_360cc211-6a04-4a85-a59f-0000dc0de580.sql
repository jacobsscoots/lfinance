
-- Add section column to differentiate toiletries from laundry items
ALTER TABLE public.toiletry_items
  ADD COLUMN section TEXT NOT NULL DEFAULT 'toiletry';

-- Index for fast filtering
CREATE INDEX idx_toiletry_items_section ON public.toiletry_items(section);
