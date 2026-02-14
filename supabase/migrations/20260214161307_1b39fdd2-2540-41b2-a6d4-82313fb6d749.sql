-- Add property eligibility fields to energy_profiles
ALTER TABLE public.energy_profiles
  ADD COLUMN IF NOT EXISTS ownership_type TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS boiler_type TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS hot_water_type TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS has_electric_boiler BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_heat_pump BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS insulation_level TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS epc_rating TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS property_age TEXT DEFAULT NULL;

COMMENT ON COLUMN public.energy_profiles.ownership_type IS 'owner, renter, shared_ownership';
COMMENT ON COLUMN public.energy_profiles.boiler_type IS 'gas_combi, gas_system, gas_regular, electric, oil, lpg, none';
COMMENT ON COLUMN public.energy_profiles.hot_water_type IS 'boiler, immersion, heat_pump, solar_thermal';
COMMENT ON COLUMN public.energy_profiles.has_electric_boiler IS 'Whether home has electric boiler (affects tariff eligibility e.g. Cosy Octopus)';
COMMENT ON COLUMN public.energy_profiles.has_heat_pump IS 'Whether home has heat pump (affects tariff eligibility e.g. Cosy Octopus)';
COMMENT ON COLUMN public.energy_profiles.insulation_level IS 'poor, average, good, excellent';
COMMENT ON COLUMN public.energy_profiles.epc_rating IS 'A-G EPC rating';
COMMENT ON COLUMN public.energy_profiles.property_age IS 'pre_1930, 1930_1965, 1966_1995, post_1995, new_build';