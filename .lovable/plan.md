
# Plan: Cheaper Bills Feature

## Overview

This plan creates a comprehensive "Cheaper Bills" section to help automatically find better deals for energy, broadband, and mobile services, with automated monthly reports and an AI assistant for usage analysis.

---

## Part 1: Database Schema

### New Tables

**Table: `tracked_services`**
Stores the services being monitored for better deals.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| user_id | uuid | Owner |
| service_type | text | 'energy', 'broadband', 'mobile', 'insurance', 'streaming' |
| provider | text | e.g., "British Gas", "EE", "BT" |
| plan_name | text | e.g., "Fix & Protect 24" |
| monthly_cost | numeric | Current monthly payment |
| contract_start_date | date | When contract began |
| contract_end_date | date | When contract ends (nullable for rolling) |
| is_tracking_enabled | boolean | ON/OFF toggle |
| last_scan_date | timestamp | When last comparison ran |
| last_recommendation | text | 'switch', 'dont_switch', 'review' |
| last_recommendation_reason | text | Plain English explanation |
| estimated_savings_annual | numeric | £/year if switched |
| exit_fee | numeric | Early termination cost |
| notes | text | Optional |
| status | text | 'active', 'ended', 'pending' |
| created_at, updated_at | timestamp | Auto |

**Table: `service_allowances`**
Stores allowances/speeds for broadband/mobile.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| tracked_service_id | uuid | FK to tracked_services |
| allowance_type | text | 'data_gb', 'minutes', 'texts', 'speed_mbps' |
| allowance_value | numeric | The amount |
| is_unlimited | boolean | Default false |

**Table: `energy_readings`**
Stores consumption data (smart meter or manual).

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| user_id | uuid | Owner |
| reading_date | date | Date of reading |
| fuel_type | text | 'electricity', 'gas' |
| consumption_kwh | numeric | kWh used |
| cost_estimate | numeric | £ cost for that day/period |
| source | text | 'smart_meter', 'manual', 'csv_import' |
| created_at | timestamp | Auto |

**Table: `energy_tariffs`**
Stores current tariff details.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| user_id | uuid | Owner |
| tariff_name | text | e.g., "SVT", "Fix & Save 12M" |
| provider | text | e.g., "British Gas" |
| fuel_type | text | 'electricity', 'gas', 'dual' |
| unit_rate_kwh | numeric | p/kWh |
| standing_charge_daily | numeric | p/day |
| is_fixed | boolean | Fixed vs variable |
| fix_end_date | date | When fixed rate ends |
| created_at, updated_at | timestamp | Auto |

**Table: `comparison_results`**
Stores results from comparison scans.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| user_id | uuid | Owner |
| tracked_service_id | uuid | FK (nullable) |
| service_type | text | 'energy', 'broadband', 'mobile' |
| provider | text | Compared provider |
| plan_name | text | Deal name |
| monthly_cost | numeric | £/month |
| annual_cost | numeric | £/year |
| features | jsonb | Speed, data, etc. |
| source | text | 'manual', 'octopus_api', 'guided' |
| scanned_at | timestamp | When result was captured |
| is_best_offer | boolean | Marked as best |
| created_at | timestamp | Auto |

**Table: `cheaper_bills_settings`**
User preferences for the feature.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| user_id | uuid | Owner (unique) |
| savings_threshold | numeric | Min £/year to recommend switch (default 50) |
| preferred_contract_type | text | 'fixed', 'flexible', 'any' |
| risk_preference | text | 'stable', 'balanced', 'lowest_cost' |
| scan_frequency | text | 'monthly', 'weekly' |
| email_notifications | boolean | Send email reports |
| in_app_notifications | boolean | Show in-app alerts |
| created_at, updated_at | timestamp | Auto |

**Table: `bill_reports`**
Stores history of sent reports.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| user_id | uuid | Owner |
| report_date | date | When report was generated |
| report_type | text | 'monthly', 'contract_ending', 'manual' |
| content | jsonb | Full report data |
| sent_via | text | 'email', 'in_app', 'both' |
| created_at | timestamp | Auto |

---

## Part 2: Page Structure

### Navigation
Add "Cheaper Bills" to both `AppSidebar.tsx` and `MobileNav.tsx`:
- Icon: `Percent` or `BadgePoundSterling` from lucide-react
- Route: `/cheaper-bills`

### Page Layout: `src/pages/CheaperBills.tsx`

```text
+----------------------------------------------------------+
|  Cheaper Bills                        [Run Comparison Scan]
|----------------------------------------------------------+
|  Overview Cards Row                                       |
|  +------------------+  +------------------+  +------------+|
|  | Est. Savings     |  | Next Contract    |  | Last Scan  ||
|  | £156/year        |  | EE Mobile        |  | 3 days ago ||
|  | available        |  | ends 15 Mar      |  | Don't      ||
|  +------------------+  +------------------+  | Switch     ||
|                                              +------------+|
+----------------------------------------------------------+
|  Tabs: [Energy] [Broadband] [Mobile] [Other]             |
|----------------------------------------------------------+
|  Energy Tab:                                              |
|  +------------------------------------------------------+|
|  | Current Tariff: British Gas SVT                      ||
|  | Monthly: £145 | Unit: 28.4p/kWh | Standing: 54p/day  ||
|  | Contract: Variable (rolling)                          ||
|  | [Edit Tariff] [View Usage] [Find Better Deal]        ||
|  +------------------------------------------------------+|
|                                                           |
|  Usage Summary (last 30 days):                           |
|  ~~~~~~~~~~~~ (bar chart - daily kWh) ~~~~~~~~~~~        |
|  Total: 342 kWh | Est. Cost: £97.13                      |
|  [Add Reading] [Import CSV]                              |
|                                                           |
|  Best Offers Found:                                       |
|  +------------------------------------------------------+|
|  | Octopus Flexible | £128/mo | Save £204/yr | [Compare]||
|  | EDF Fix 24      | £131/mo | Save £168/yr | [Compare] ||
|  +------------------------------------------------------+|
|                                                           |
|  AI Insights:                                             |
|  "Your usage peaks on weekday evenings. A time-of-use    |
|  tariff could save you ~£15/month based on your pattern."|
|----------------------------------------------------------+
```

---

## Part 3: Components

### Overview Components
- `src/components/cheaper-bills/SavingsOverviewCard.tsx` - Total potential savings
- `src/components/cheaper-bills/NextContractCard.tsx` - Soonest contract ending
- `src/components/cheaper-bills/LastScanCard.tsx` - Last scan result

### Service Management
- `src/components/cheaper-bills/ServiceCard.tsx` - Individual service display
- `src/components/cheaper-bills/ServiceFormDialog.tsx` - Add/edit service
- `src/components/cheaper-bills/ServiceList.tsx` - List of tracked services

### Energy Specific
- `src/components/cheaper-bills/EnergyUsageChart.tsx` - Daily/monthly consumption
- `src/components/cheaper-bills/TariffFormDialog.tsx` - Add/edit tariff details
- `src/components/cheaper-bills/ReadingFormDialog.tsx` - Manual reading entry
- `src/components/cheaper-bills/CsvImportDialog.tsx` - Import readings from CSV
- `src/components/cheaper-bills/EnergyDashboard.tsx` - Combined energy view

### Comparison
- `src/components/cheaper-bills/ComparisonResultCard.tsx` - Single offer display
- `src/components/cheaper-bills/ComparisonDialog.tsx` - Run comparison flow
- `src/components/cheaper-bills/GuidedComparisonPanel.tsx` - Deep-link to comparison sites
- `src/components/cheaper-bills/SwitchChecklist.tsx` - What to expect when switching

### AI Assistant
- `src/components/cheaper-bills/BillsAssistant.tsx` - AI chat/insights panel
- `src/components/cheaper-bills/UsageInsights.tsx` - AI-generated usage analysis

### Settings
- `src/components/cheaper-bills/CheaperBillsSettings.tsx` - Preferences card

---

## Part 4: Hooks

| Hook | Purpose |
|------|---------|
| `useTrackedServices.ts` | CRUD for tracked services |
| `useEnergyReadings.ts` | CRUD for energy readings + aggregations |
| `useEnergyTariffs.ts` | CRUD for tariff info |
| `useComparisonResults.ts` | Fetch/store comparison data |
| `useCheaperBillsSettings.ts` | User preferences |
| `useBillReports.ts` | Report history |
| `useBillsAssistant.ts` | AI assistant interactions |

---

## Part 5: Edge Functions

### `compare-energy-deals/index.ts`
Uses the Octopus Energy API (if available - it's public) or provides a guided comparison flow.

**Logic:**
1. Accept user's tariff details and consumption
2. If Octopus API available: fetch current tariffs, calculate costs
3. Generate comparison results with projected annual cost
4. Apply user's savings threshold to make recommendation
5. Store results in `comparison_results`

**Octopus API Note:** Octopus Energy has a public API that doesn't require authentication for tariff data. We can use this to get real rates.

### `send-bill-report/index.ts`
Sends monthly email reports using Resend.

**Flow:**
1. Triggered monthly (via pg_cron) or 30 days before contract ends
2. Gather: current services, latest comparison results, usage summary
3. Format email with summary and recommendations
4. Send via Resend
5. Log in `bill_reports` table

### `analyze-usage-ai/index.ts`
AI-powered usage analysis.

**Uses Lovable AI** (`google/gemini-2.5-flash`) to:
1. Analyze consumption patterns
2. Identify peaks, baselines, anomalies
3. Suggest simple reduction tips
4. Answer user questions about bills

---

## Part 6: Energy Auto-Tracking

### Smart Meter Integration
Most smart meter platforms (IHD apps like Chameleon, Bright) don't have public APIs. Implementation approach:

**Option 1: n3rgy Consumer Access**
The UK's n3rgy service provides free access to smart meter data with user consent. Requires user to authorize via DCC (Data Communications Company).

**Option 2: Manual/CSV Fallback (Primary)**
- Manual entry form for monthly readings
- CSV import supporting common export formats:
  - Columns: date, electricity_kwh, gas_kwh, cost
  - Auto-detect column order

### SmartThings Integration (Optional)
If user has SmartThings energy monitor, could potentially use their API. Mark as "coming soon" initially.

---

## Part 7: Comparison Flow (Safe Approach)

Since comparison sites block automation:

### Guided Comparison Flow
1. User clicks "Find Better Deal"
2. System generates a "comparison-ready summary":
   - Annual consumption (kWh)
   - Current annual cost
   - Postcode
   - Current provider
3. Display deep-links to comparison sites:
   - **Energy:** Uswitch, Compare the Market, Money Saving Expert
   - **Broadband:** Uswitch, Broadband Choices
   - **Mobile:** Uswitch, Compare the Market
4. Pre-fill what's allowed in URL params
5. Provide copy-paste box for other fields
6. After user returns, prompt to log the best offer found

### API-Based (Where Available)
- **Octopus Energy:** Public tariff API for electricity/gas rates
- Others: Guided approach only

---

## Part 8: Recommendation Logic

### Switch Recommendation Algorithm

```typescript
function shouldSwitch(
  currentAnnualCost: number,
  bestOfferAnnualCost: number,
  exitFee: number,
  savingsThreshold: number,
  riskPreference: 'stable' | 'balanced' | 'lowest_cost'
): { recommend: boolean; reason: string } {
  const grossSavings = currentAnnualCost - bestOfferAnnualCost;
  const netSavings = grossSavings - exitFee;
  
  // Don't switch if net savings below threshold
  if (netSavings < savingsThreshold) {
    return { 
      recommend: false, 
      reason: `Net savings (£${netSavings.toFixed(0)}) below your £${savingsThreshold} threshold` 
    };
  }
  
  // Risk preference adjustments
  if (riskPreference === 'stable' && !bestOffer.isFixed) {
    return {
      recommend: false,
      reason: "Variable tariff doesn't match your preference for stable bills"
    };
  }
  
  return {
    recommend: true,
    reason: `Switch to save £${netSavings.toFixed(0)}/year after exit fees`
  };
}
```

---

## Part 9: Monthly Email Report

### Email Content Structure
```
Subject: Your Cheaper Bills Report - February 2026

SUMMARY
-------
Potential savings this month: £156/year across all services

ENERGY
------
Current: British Gas SVT - £145/mo
Best offer: Octopus Flexible - £128/mo
Savings: £204/year
Last 30 days usage: 342 kWh (£97.13)
Recommendation: SWITCH ✓

BROADBAND
---------
Provider: BT Full Fibre
Contract ends: 15 April 2026 (67 days away)
Action: Start comparing deals now

MOBILE (EE)
-----------
Contract ends: 15 March 2026 (36 days away)
Current: £45/mo for 50GB
Action: Review SIM-only deals

NEXT STEPS
----------
1. Switch energy via [link to app]
2. Set reminder for broadband renewal
3. Check EE retention offers

[View Full Report in App]
```

### Email Trigger Rules
- Monthly: 1st of each month
- Contract ending: 30 days before end date
- Prevent duplicates: Check `bill_reports` for existing report in period

---

## Part 10: AI Assistant

### Implementation
Component: `BillsAssistant.tsx`

**Features:**
1. **Usage Analysis**
   - Identify consumption spikes
   - Calculate baseline usage
   - Estimate waste/inefficiency

2. **Simple Reduction Tips**
   - Based on usage patterns
   - Low-effort suggestions only
   - e.g., "Your evening usage is 40% higher than morning - consider shifting laundry to off-peak"

3. **Smart Questions**
   - Only asks when genuinely needed
   - e.g., "I don't have your gas standing charge - what's the daily rate?"

**Prompt Pattern:**
```
You are a helpful energy and bills assistant. Analyze the user's consumption data and provide insights.

Rules:
- Be concise and actionable
- Focus on low-effort savings
- Don't recommend major lifestyle changes
- Ask questions only when missing critical info
- Explain costs in simple terms

User's data:
- Monthly consumption: {kWh}
- Current tariff: {details}
- Usage patterns: {daily breakdown}
```

---

## Part 11: Settings

Add settings under Cheaper Bills page (or Settings tab):

| Setting | Default | Options |
|---------|---------|---------|
| Savings threshold | £50/year | £25, £50, £75, £100, custom |
| Preferred contract | Any | Fixed, Flexible, Any |
| Risk preference | Balanced | Stable, Balanced, Lowest Cost |
| Scan frequency | Monthly | Weekly, Monthly, Manual only |
| Email notifications | ON | ON/OFF |
| In-app notifications | ON | ON/OFF |

---

## Part 12: Edge Cases

| Scenario | Handling |
|----------|----------|
| No smart meter data | Manual entry + CSV import prominent |
| Multiple meters | Support multiple energy tariff records |
| Moving house | "Move date" field, archive old data |
| New tariff mid-month | Pro-rata calculation |
| Intro offers expiring | Track fix_end_date, warn 60 days before |
| Exit fees | Factor into net savings calculation |
| Duplicate reminders | Dedupe by report_type + period in `bill_reports` |
| No email configured | Resend requires RESEND_API_KEY secret |

---

## Part 13: Auto-Detection from Transactions

### Integration with Gmail/Transactions
Leverage existing receipt scanning to detect:
- Provider payments (British Gas, EDF, EE, BT, etc.)
- Contract renewal patterns
- Price changes

**Logic:**
1. Scan transactions for utility provider names
2. Track payment amounts over time
3. Detect significant changes (>10% increase)
4. Suggest adding to tracked services if not already tracked

---

## Part 14: Calendar Integration (Optional)

Add calendar reminders for contract end dates:
- Button: "Add to Calendar" on service card
- Generate .ics file download
- Reminder 30, 14, 7 days before

---

## Part 15: Files to Create

### Pages
| File | Purpose |
|------|---------|
| `src/pages/CheaperBills.tsx` | Main page |

### Components (18 files)
| File | Purpose |
|------|---------|
| `src/components/cheaper-bills/SavingsOverviewCard.tsx` | Total savings display |
| `src/components/cheaper-bills/NextContractCard.tsx` | Soonest expiring contract |
| `src/components/cheaper-bills/LastScanCard.tsx` | Last scan status |
| `src/components/cheaper-bills/ServiceCard.tsx` | Individual service row |
| `src/components/cheaper-bills/ServiceFormDialog.tsx` | Add/edit service |
| `src/components/cheaper-bills/ServiceList.tsx` | Service list container |
| `src/components/cheaper-bills/EnergyUsageChart.tsx` | Consumption chart |
| `src/components/cheaper-bills/TariffFormDialog.tsx` | Tariff details form |
| `src/components/cheaper-bills/ReadingFormDialog.tsx` | Manual reading entry |
| `src/components/cheaper-bills/EnergyCsvImportDialog.tsx` | CSV import |
| `src/components/cheaper-bills/EnergyDashboard.tsx` | Energy tab content |
| `src/components/cheaper-bills/ComparisonResultCard.tsx` | Offer display |
| `src/components/cheaper-bills/GuidedComparisonPanel.tsx` | Comparison deep-links |
| `src/components/cheaper-bills/SwitchChecklist.tsx` | Switch guidance |
| `src/components/cheaper-bills/BillsAssistant.tsx` | AI assistant |
| `src/components/cheaper-bills/UsageInsights.tsx` | AI insights display |
| `src/components/cheaper-bills/CheaperBillsSettings.tsx` | Settings form |
| `src/components/cheaper-bills/BillHealthScore.tsx` | Competitiveness score |

### Hooks (7 files)
| File | Purpose |
|------|---------|
| `src/hooks/useTrackedServices.ts` | Services CRUD |
| `src/hooks/useEnergyReadings.ts` | Readings CRUD |
| `src/hooks/useEnergyTariffs.ts` | Tariffs CRUD |
| `src/hooks/useComparisonResults.ts` | Comparison data |
| `src/hooks/useCheaperBillsSettings.ts` | Settings |
| `src/hooks/useBillReports.ts` | Report history |
| `src/hooks/useBillsAssistant.ts` | AI chat |

### Utilities (2 files)
| File | Purpose |
|------|---------|
| `src/lib/billsCalculations.ts` | Cost projections, savings |
| `src/lib/energyCsvParser.ts` | Parse CSV imports |

### Edge Functions (3 files)
| File | Purpose |
|------|---------|
| `supabase/functions/compare-energy-deals/index.ts` | Fetch Octopus rates, compare |
| `supabase/functions/send-bill-report/index.ts` | Monthly email via Resend |
| `supabase/functions/analyze-usage-ai/index.ts` | AI usage analysis |

### Files to Modify
| File | Changes |
|------|---------|
| `src/App.tsx` | Add /cheaper-bills route |
| `src/components/layout/AppSidebar.tsx` | Add nav item |
| `src/components/layout/MobileNav.tsx` | Add nav item |
| `supabase/config.toml` | Add edge function configs |

---

## Part 16: Implementation Phases

### Phase 1: Core Structure
1. Database migration for all tables
2. Navigation updates
3. Basic page layout with tabs
4. Service tracking CRUD (hooks + dialogs)

### Phase 2: Energy Feature
5. Energy readings form + CSV import
6. Tariff management
7. Usage chart
8. Octopus API integration for comparison

### Phase 3: Comparison & Recommendations
9. Guided comparison flow
10. Recommendation algorithm
11. Comparison results display
12. Bill health score

### Phase 4: AI Assistant
13. Usage analysis edge function
14. BillsAssistant component
15. Insights display

### Phase 5: Email Reports
16. RESEND_API_KEY secret (user provides)
17. send-bill-report edge function
18. Report history
19. pg_cron schedule (manual SQL)

### Phase 6: Polish
20. Calendar .ics export
21. Transaction auto-detection
22. Mobile optimization
23. End-to-end testing

---

## Part 17: Prerequisites

### Required Secrets
- `RESEND_API_KEY` - For sending email reports (user must configure)

### Optional APIs
- **Octopus Energy API** - Public, no auth needed for tariff data
- **n3rgy Consumer Access** - Smart meter data (requires user consent flow)

---

## Part 18: Testing Checklist

After implementation:
- [ ] Add a tracked energy service with tariff details
- [ ] Manually enter 30 days of readings
- [ ] Import readings via CSV
- [ ] Run comparison scan
- [ ] Verify recommendation logic with different thresholds
- [ ] Test AI assistant with usage questions
- [ ] Verify email report sends (requires RESEND_API_KEY)
- [ ] Test mobile responsiveness
- [ ] Verify existing Investments page works correctly
- [ ] Test Gmail receipt integration end-to-end
