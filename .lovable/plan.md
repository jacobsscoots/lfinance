Cheaper Bills page — smarter personalised AI + fix missing “Switch details” button (merged)
Goals

Make the Cheaper Bills AI assistant feel smarter by:

Using your actual usage + tariff better

Remembering what I already do (e.g., dishwasher eco mode) so it stops repeating it

Suggesting next-best actions instead of generic tips

Letting me dismiss tips permanently (“I already do this / not relevant”)

Fix the missing “Switch details / View details” button by:

Making sure scan results are actually stored (comparison_results currently empty)

Making the ServiceCard UI show the button when results exist, and show a clear empty state when they don’t

What I think is happening (root causes)
A) Why “Switch details” isn’t showing

ServiceCard only shows the button when:

service.last_recommendation === "switch" AND

a “best offer” exists from comparison_results

Right now comparison_results is empty after scans. The backend uses:

.upsert(..., { onConflict: "user_id,provider,plan_name" })
But the DB index is partial / doesn’t match the onConflict columns, so Postgres rejects the upsert with:

“there is no unique or exclusion constraint matching the ON CONFLICT specification”
The function doesn’t surface the error, so the scan looks successful but stores nothing.

B) Why AI feels generic / repeats things I already do

The assistant only has readings + tariff + my question. It has no persistent memory of “already do” habits, so it keeps suggesting generic low effort tips.

Implementation Plan
Part 1 — Fix scan result storage so “Switch details” can appear
1) Database migration: replace partial unique index with a real unique index that matches upsert

Drop the existing partial unique index and create a non-partial unique index that matches the upsert columns.

Also, to avoid collisions across different services (energy/broadband/mobile), include service identifiers:

Recommended unique index

(user_id, service_type, tracked_service_id, provider, plan_name)

Then update the upsert to use:

onConflict: "user_id,service_type,tracked_service_id,provider,plan_name"

This prevents overwriting results across services with the same provider/plan name.

2) Backend update: supabase/functions/compare-energy-deals/index.ts

Update the upsert to use the new onConflict set

Capture and return upsert errors (don’t fail silently)

Ensure only 1 best offer per service (set is_best_offer properly)

Ensure each result includes website_url when possible (or store null explicitly)

3) UI robustness: src/components/cheaper-bills/ServiceCard.tsx

Make the UI resilient and stop the “it says switch but no button” confusion:

Determine bestOffer primarily via is_best_offer (not only “cheaper than current”)

If service.last_recommendation === "switch" but there are no stored results:

show a greyed state: “No saved scan results yet — Run scan”

show a “Run scan” CTA button

If results exist:

always show “Switch details / View details” button

open SwitchingPopupDialog

SwitchingPopupDialog requirements

show provider, plan, monthly/annual savings (if fields available)

show “View deal” link:

if website_url exists → open

if missing → show “No switching link available for this deal” (not a dead button)

4) Debugging instrumentation (dev-only)

Add a temporary debug line per ServiceCard (dev-only) showing:

service.id

service.service_type

service.last_recommendation

comparison_results_count

best_deal.website_url exists?

Fix common failure cases:

mismatch like switch vs SWITCH / recommend_switch

comparison_results query filters wrong (missing user_id / wrong provider match / wrong tracked_service_id or service_type)

results exist but not selected/joined into component (null UI)

button is hidden by CSS/overlay/z-index

Part 2 — Make the AI assistant smarter + stop repeating tips you already do

You can implement this either with:

Option A (recommended): dedicated tables (clean, scalable)

Option B (quick): JSONB on cheaper_bills_settings (fast shipping)

I’m fine with either, but it must support:

“already do” memory

“not relevant” memory

ranking by savings/effort/relevance

“why this applies to you”

optional learning from linked transactions/spend patterns

Option A (recommended): tables
5) Create table: energy_profiles

Store a per-user profile used by the assistant and recommendations:

id uuid pk

user_id uuid fk

eco_mode_dishwasher boolean

eco_mode_washer boolean

dryer_usage_per_week int

dishwasher_runs_per_week int

washer_runs_per_week int

shower_minutes_avg int

heating_type text (gas boiler / heat pump / electric heaters / other)

thermostat_temp_c numeric

home_type text (flat / house / other)

occupants int

work_from_home_days int

smart_meter boolean

tariff_type text (variable / fixed / EV / economy7)

has_ev boolean

peak_time_avoidance boolean

notes text

updated_at timestamptz

6) UI: “Energy Profile” section on Cheaper Bills

editable form with toggles/inputs

small “How accurate are these?” banner

“Update profile” button

show “Last updated”

7) Create table: energy_recommendation_feedback

So I can permanently dismiss tips:

id uuid pk

user_id uuid

recommendation_key text (stable keys like eco_dishwasher, reduce_shower_time)

status text enum: already_do, not_relevant, dismissed, helpful

created_at timestamptz

8) AI behaviour rules (must follow)

If eco_mode_dishwasher = true OR feedback says already_do → never recommend dishwasher eco mode again

Instead propose a next-best alternative relevant to my profile + readings

Rank recommendations by:

estimated £/year saving

effort level (low/med/high)

relevance to profile

Each recommendation must include:

Why it applies to me (based on profile fields)

Estimated saving range (rough is fine)

Effort level

Each recommendation card must have buttons:

“I already do this”

“Not relevant”

(Optional) “Helpful”
And store feedback so it stops repeating.

Option B (quick ship): JSONB habits on cheaper_bills_settings

If you want to avoid new tables, add:

cheaper_bills_settings.energy_habits jsonb default {}

Example shape:

{
  "dishwasher_eco": true,
  "washing_low_temp": false,
  "tumble_dryer_rare": true,
  "custom_notes": "..."
}


But you still must implement the “I already do this / not relevant” buttons and persist them (either inside this JSON or a feedback table).

Part 3 — Make it learn from actual usage (optional but strong)

If transactions are linked to energy bills/services, infer:

average monthly electricity spend (last 3/6/12 months)

winter vs summer difference

spikes (months above average)

Then the assistant should reference patterns like:

“Your winter spend is ~X% higher than summer, so heating-related actions matter more.”
If there’s not enough data, fall back to profile-only.

Also (optional): include latest best offer context from comparison_results:

“Switching could save ~£X/year” when relevant.

Files involved (expected)
Backend

supabase/functions/compare-energy-deals/index.ts (fix storing results + error handling)

supabase/functions/analyze-usage-ai/index.ts (fetch profile/habits + feedback + richer analysis)

Frontend

src/components/cheaper-bills/ServiceCard.tsx (fix button visibility logic + empty state + popup)

src/components/cheaper-bills/BillsAssistant.tsx (use profile/habits + render feedback buttons)

src/hooks/useCheaperBillsSettings.ts (if using JSONB approach)

New component: EnergyProfileCard.tsx (if using energy_profiles table)

Database migration

drop/replace comparison_results unique index so upserts work

add either:

energy_profiles + energy_recommendation_feedback

OR cheaper_bills_settings.energy_habits jsonb (+ feedback storage)

Acceptance tests (must provide evidence)

Create a test user profile with eco-mode dishwasher ON:

Ask AI “How can I reduce my bill?”

Confirm it does NOT recommend dishwasher eco mode

Change profile values (e.g., high dryer usage vs low):

Confirm the top 3–5 recommendations actually change

With comparison_results rows present:

Confirm “Switch details” button shows on the ServiceCard

Confirm popup opens and “View deal” link works

With no comparison_results rows:

Confirm the UI shows “No switch deal found yet” + “Run scan” CTA (not just nothing)