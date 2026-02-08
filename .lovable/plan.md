

# Cheaper Bills: Provider Update, Smart Meter Chart, and Test Email

## Overview

This plan addresses three requests:
1. Add "Outfox Energy" to the tariff provider list
2. Display smart meter data on the usage chart
3. Add a "Send Test Email" button to verify Resend integration

---

## Part 1: Add Outfox Energy to Tariff Providers

### Current State
The `TariffFormDialog.tsx` has a hardcoded provider list:
```
["British Gas", "EDF", "Octopus Energy", "E.ON", "Scottish Power", "SSE", "Bulb", "OVO"]
```

The `ServiceFormDialog.tsx` already includes Outfox Energy in its list.

### Changes Required

**File: `src/components/cheaper-bills/TariffFormDialog.tsx`**

Update the PROVIDERS array to include Outfox Energy and match the comprehensive list from ServiceFormDialog:
- Add: "Outfox Energy", "Shell Energy", "Utility Warehouse"

---

## Part 2: Display Smart Meter Data on Usage Chart

### Current State
- `SmartMeterCard` shows connection status and last sync time
- `EnergyUsageChart` displays readings from `useEnergyReadings()`
- Smart meter sync writes to `energy_readings` table with `source: "bright"`
- The chart already shows any readings in the table

### Why It Should Already Work
When you sync from the smart meter, the `bright-sync-readings` edge function inserts readings into `energy_readings` with `source: "bright"`. The `useEnergyReadings` hook fetches all readings for the user regardless of source, and the chart displays them.

### Potential Issue
If no data is showing, it could be because:
1. The smart meter hasn't been synced yet
2. The date range doesn't match (chart shows last 30 days by default)
3. Readings are being stored but with dates outside the range

### Changes Required

**File: `src/components/cheaper-bills/EnergyUsageChart.tsx`**

Add a visual indicator showing the data source breakdown (manual vs smart meter):
- Show a small badge or legend indicating how many readings came from smart meter vs manual entry
- This helps confirm smart meter data is flowing correctly

**File: `src/pages/CheaperBills.tsx`**

Add a hint near the chart showing data source status:
- "X readings from smart meter" if smart meter is connected

---

## Part 3: Add Test Email Button

### Current State
- `send-bills-notification` edge function is ready and deployed
- `NotificationSettingsCard` has email settings but no way to send a test
- RESEND_API_KEY secret is configured

### Changes Required

**File: `src/components/cheaper-bills/NotificationSettingsCard.tsx`**

Add a "Send Test Email" button that:
1. Calls the `send-bills-notification` edge function with type `usage_summary`
2. Uses the configured email address (or falls back to account email)
3. Shows loading state and success/error feedback

**New functionality:**
- Add `sendTestEmail` function using `supabase.functions.invoke`
- Button with loading spinner
- Toast notification on success/failure

---

## Technical Details

### Files to Modify

| File | Change |
|------|--------|
| `src/components/cheaper-bills/TariffFormDialog.tsx` | Add Outfox Energy + more providers |
| `src/components/cheaper-bills/EnergyUsageChart.tsx` | Add source breakdown indicator |
| `src/components/cheaper-bills/NotificationSettingsCard.tsx` | Add "Send Test Email" button |

### Test Email Request Body

```typescript
{
  type: "usage_summary",
  data: {
    period: "Test",
    totalUsage: 123.4,
    totalCost: 45.67,
  }
}
```

### Resend Domain Note

The edge function uses `noreply@lfinance.lovable.app` as the sender. This domain needs to be verified in Resend for emails to send successfully. If not verified, the test email will fail with a domain verification error.

---

## Implementation Order

1. Update TariffFormDialog providers (quick, isolated change)
2. Add source indicator to EnergyUsageChart
3. Add test email button to NotificationSettingsCard

---

## Verification Steps

After implementation:
1. Open Cheaper Bills page
2. Click "Add Tariff" - verify Outfox Energy appears in dropdown
3. If smart meter is connected, sync and verify data appears on chart with source indicator
4. Enter email in notification settings and click "Send Test Email"
5. Check inbox for test email with usage summary format

