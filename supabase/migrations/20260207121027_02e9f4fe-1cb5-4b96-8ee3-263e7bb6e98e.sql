-- Add inventory and packaging columns to products
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS quantity_on_hand integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS quantity_in_use integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS reorder_threshold integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS target_quantity integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS gross_pack_size_grams numeric,
ADD COLUMN IF NOT EXISTS packaging_weight_grams numeric DEFAULT 0;

-- Add inventory, packaging, and import fields to toiletry_items
ALTER TABLE toiletry_items 
ADD COLUMN IF NOT EXISTS quantity_on_hand integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS quantity_in_use integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS reorder_threshold integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS target_quantity integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS gross_size numeric,
ADD COLUMN IF NOT EXISTS packaging_weight numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS image_url text,
ADD COLUMN IF NOT EXISTS brand text,
ADD COLUMN IF NOT EXISTS offer_price numeric,
ADD COLUMN IF NOT EXISTS offer_label text,
ADD COLUMN IF NOT EXISTS source_url text;