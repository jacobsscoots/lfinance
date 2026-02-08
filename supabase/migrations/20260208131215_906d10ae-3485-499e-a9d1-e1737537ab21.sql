-- Part 1: Fix comparison_results unique index to match upsert
-- Drop the existing partial unique index (if exists)
DROP INDEX IF EXISTS comparison_results_user_provider_plan;

-- Create a proper non-partial unique index that matches the upsert columns
CREATE UNIQUE INDEX comparison_results_user_service_provider_plan
ON public.comparison_results (user_id, service_type, COALESCE(tracked_service_id, '00000000-0000-0000-0000-000000000000'::uuid), provider, COALESCE(plan_name, ''));

-- Part 2: Create energy_profiles table for personalized AI recommendations
CREATE TABLE public.energy_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Appliance habits
  eco_mode_dishwasher boolean DEFAULT false,
  eco_mode_washer boolean DEFAULT false,
  low_temp_washing boolean DEFAULT false,
  tumble_dryer_rare boolean DEFAULT false,
  dishwasher_runs_per_week int DEFAULT 0,
  washer_runs_per_week int DEFAULT 0,
  dryer_runs_per_week int DEFAULT 0,
  -- Heating & hot water
  heating_type text, -- 'gas_boiler', 'heat_pump', 'electric_heaters', 'other'
  thermostat_temp_c numeric,
  smart_thermostat boolean DEFAULT false,
  shower_minutes_avg int,
  -- Home details
  home_type text, -- 'flat', 'terrace', 'semi', 'detached', 'other'
  occupants int DEFAULT 1,
  work_from_home_days int DEFAULT 0,
  -- Energy setup
  smart_meter boolean DEFAULT false,
  has_ev boolean DEFAULT false,
  has_solar boolean DEFAULT false,
  tariff_type text, -- 'variable', 'fixed', 'economy7', 'agile', 'ev'
  peak_time_avoidance boolean DEFAULT false,
  -- Custom notes
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on energy_profiles
ALTER TABLE public.energy_profiles ENABLE ROW LEVEL SECURITY;

-- RLS policies for energy_profiles
CREATE POLICY "Users can view own energy profile"
  ON public.energy_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own energy profile"
  ON public.energy_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own energy profile"
  ON public.energy_profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own energy profile"
  ON public.energy_profiles FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_energy_profiles_updated_at
  BEFORE UPDATE ON public.energy_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Part 3: Create energy_recommendation_feedback table for dismissing tips
CREATE TABLE public.energy_recommendation_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recommendation_key text NOT NULL, -- stable keys like 'eco_dishwasher', 'reduce_shower_time'
  status text NOT NULL CHECK (status IN ('already_do', 'not_relevant', 'dismissed', 'helpful')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, recommendation_key)
);

-- Enable RLS on energy_recommendation_feedback
ALTER TABLE public.energy_recommendation_feedback ENABLE ROW LEVEL SECURITY;

-- RLS policies for energy_recommendation_feedback
CREATE POLICY "Users can view own recommendation feedback"
  ON public.energy_recommendation_feedback FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own recommendation feedback"
  ON public.energy_recommendation_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own recommendation feedback"
  ON public.energy_recommendation_feedback FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own recommendation feedback"
  ON public.energy_recommendation_feedback FOR DELETE
  USING (auth.uid() = user_id);