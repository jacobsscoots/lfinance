# Life Tracker - Cheaper Bills AI + Switch Details Implementation

## Status: ✅ COMPLETED

All planned features have been implemented.

---

## What Was Implemented

### Part 1: Fix Scan Result Storage
- ✅ **Database**: Replaced partial unique index with proper non-partial index on `(user_id, service_type, tracked_service_id, provider, plan_name)` using COALESCE for nullable columns
- ✅ **Edge Function**: Updated `compare-energy-deals` to use DELETE + INSERT pattern (more reliable than upsert with complex index), added error handling and logging
- ✅ **ServiceCard**: Added empty state with "Run scan for details" CTA when recommendation is "switch" but no results exist

### Part 2: Personalized AI Recommendations
- ✅ **Database Tables Created**:
  - `energy_profiles` - User's appliance habits, home details, energy setup
  - `energy_recommendation_feedback` - Tracks dismissed/helpful tips with unique constraint on (user_id, recommendation_key)
- ✅ **Edge Function**: Updated `analyze-usage-ai` to:
  - Fetch user's energy profile from database
  - Fetch recommendation feedback (already_do, not_relevant, dismissed)
  - Include best switching deal context
  - Analyze usage patterns (weekday/weekend, trends, variability, top usage days)
  - Skip recommendations user has marked
- ✅ **EnergyProfileCard**: New collapsible component with:
  - "Things I Already Do" checkboxes (eco modes, low temp washing, etc.)
  - Home details (type, occupants, WFH days, heating)
  - Energy setup (smart meter, EV, solar, tariff type)
  - Usage details (shower time, thermostat, appliance frequency)
- ✅ **BillsAssistant**: Updated to show:
  - Excluded tips badges (click to undo)
  - Feedback buttons for common recommendations (I already do this / Not relevant / Helpful)

### New Files Created
- `src/hooks/useEnergyProfile.ts` - Hook for energy_profiles CRUD
- `src/hooks/useRecommendationFeedback.ts` - Hook for feedback CRUD with labels
- `src/components/cheaper-bills/EnergyProfileCard.tsx` - Profile form UI

### Modified Files
- `supabase/functions/compare-energy-deals/index.ts` - Fixed result storage
- `supabase/functions/analyze-usage-ai/index.ts` - Personalized recommendations
- `src/components/cheaper-bills/ServiceCard.tsx` - Empty state handling
- `src/components/cheaper-bills/BillsAssistant.tsx` - Feedback buttons
- `src/pages/CheaperBills.tsx` - Added EnergyProfileCard

---

## How It Works

### AI Personalization Flow
1. User fills in their energy profile (optional but improves recommendations)
2. When user asks AI a question, the edge function:
   - Fetches their profile and feedback from database
   - Builds exclusion list from profile checkboxes + explicit feedback
   - Includes this context in the AI prompt
3. AI skips excluded recommendations and suggests next-best alternatives
4. User can mark tips as "already do" or "not relevant" inline
5. Feedback is persisted and used in future conversations

### Switch Details Flow
1. User runs "Scan for Deals" on a service
2. Edge function deletes old results, inserts new ones with proper keys
3. First result is marked `is_best_offer = true`
4. ServiceCard shows "View details" button if bestOffer exists
5. If recommendation is "switch" but no results, shows "Run scan" CTA
6. SwitchingPopupDialog shows deal info with "View Deal" link

---

## Recommendation Keys
The AI uses stable keys for tracking feedback:
- `eco_dishwasher`, `eco_washer`, `low_temp_washing`, `reduce_tumble_dryer`
- `batch_cooking`, `airfryer_microwave`, `reduce_shower_time`
- `lower_thermostat`, `smart_thermostat`, `standby_loads`, `led_bulbs`
- `time_of_use`, `economy7`, `off_peak_appliances`
- `draught_proofing`, `hot_water_timer`, `solar_panels`, `switch_tariff`
