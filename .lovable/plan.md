
# Cheaper Bills: Resend Email + Smart Meter Integration

## Overview

This plan covers two integrations for your Cheaper Bills module:

1. **Resend Email Notifications** - Contract end reminders, savings alerts, weekly summaries
2. **Glowmarkt/Bright API Integration** - Automatic electricity meter readings from your Chameleon IHD

---

## Part 1: Resend Email Integration

### What You'll Get
- Contract ending reminder emails (e.g., "Your EDF contract ends in 30 days")
- Savings opportunity alerts (e.g., "We found you could save £87/year")
- Weekly/monthly summary emails with usage stats

### Prerequisites
You already have the Resend API ready. I'll need you to provide the API key when we start implementation.

### Implementation Steps

**Step 1: Add RESEND_API_KEY secret**
- I'll request the API key from you
- You'll paste it into the secure input

**Step 2: Create `send-bills-notification` edge function**
Handles three notification types:
- `contract_reminder` - Upcoming contract end dates
- `savings_alert` - When a comparison finds significant savings
- `usage_summary` - Weekly/monthly usage report

**Step 3: Update database schema**
Add `user_email` preference storage:
- Add `notification_email` column to `cheaper_bills_settings`
- Store user's preferred email for notifications

**Step 4: Add notification triggers**
- Update `compare-energy-deals` to optionally send savings alerts
- Create a scheduled check for contract end dates (using pg_cron)
- Add UI toggle in Cheaper Bills settings for email preferences

---

## Part 2: Glowmarkt/Bright API Integration (Chameleon IHD)

### How Chameleon Smart Meter Data Works

Your Chameleon IHD is a "Consumer Access Device" (CAD) that connects directly to your SMETS2 smart meter via ZigBee. The IHD pushes data to Hildebrand's cloud platform, accessible via the **Glowmarkt/Bright API**.

**Important clarification**: "Chameleon" is the hardware manufacturer - there's no separate "Chameleon API". The data flows like this:

```text
Your SMETS2 Meter --> Chameleon IHD (via ZigBee) --> Hildebrand Cloud --> Bright/Glowmarkt API
```

### What You Need

1. **Bright App account** - Download from App Store/Google Play, sign up
2. **CAD device paired** - Your Chameleon IHD must be connected to the meter and WiFi
3. **API access enabled** - Email support@hildebrand.co.uk requesting API access with:
   - Your Bright account username
   - Your CAD's MAC ID (printed on the device)

### What You'll Get

- Automatic half-hourly electricity readings synced to your app
- Real-time consumption data (updates every 10 seconds when CAD is connected)
- Historical data up to 13 months back
- Cost estimates using your current tariff rates

### Implementation Steps

**Step 1: Add Bright credentials as secrets**
- `BRIGHT_USERNAME` - Your Bright app email
- `BRIGHT_PASSWORD` - Your Bright app password
- Application ID is public: `b0f1b774-a586-4f72-9edd-27ead8aa7a8d`

**Step 2: Create `bright-sync-readings` edge function**
```text
Functionality:
1. Authenticate with Bright API (POST /api/v0-1/auth)
2. Discover resources (GET /api/v0-1/resource)
   - electricity.consumption (kWh)
   - electricity.consumption.cost (pence)
   - gas.consumption (if available)
3. Fetch readings for date range (GET /resource/{id}/readings)
4. Upsert readings into energy_readings table
5. Store token in database for reuse (expires after 7 days)
```

**Step 3: Update database schema**
Add table for storing API tokens and resource IDs:
```sql
CREATE TABLE bright_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  access_token TEXT,
  token_expires_at TIMESTAMPTZ,
  electricity_resource_id TEXT,
  gas_resource_id TEXT,
  last_synced_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Step 4: Add UI for Bright connection**
- Settings card in Cheaper Bills: "Connect Smart Meter"
- Shows connection status, last sync time
- Manual "Sync Now" button
- Auto-sync toggle (uses pg_cron for hourly sync)

**Step 5: Set up scheduled sync (optional)**
Using pg_cron:
- Every hour: sync last 2 hours of data
- Daily at 2am: sync full previous day (handles any gaps)

---

## Technical Details

### Bright API Endpoints Used

| Endpoint | Purpose |
|----------|---------|
| `POST /api/v0-1/auth` | Get JWT token (valid 7 days) |
| `GET /api/v0-1/resource` | List available data streams |
| `GET /api/v0-1/resource/{id}/readings` | Fetch consumption data |
| `GET /api/v0-1/resource/{id}/current` | Get real-time reading |

### Reading Aggregation Options

| Period | Description | Use Case |
|--------|-------------|----------|
| `PT30M` | Half-hourly | Default billing data |
| `PT1H` | Hourly | Charts, trends |
| `P1D` | Daily | Summary cards |

### Files to Create/Modify

**New Files:**
- `supabase/functions/send-bills-notification/index.ts`
- `supabase/functions/bright-sync-readings/index.ts`
- `src/hooks/useBrightConnection.ts`
- `src/components/cheaper-bills/SmartMeterCard.tsx`
- `src/components/cheaper-bills/BrightConnectDialog.tsx`

**Modified Files:**
- `src/pages/CheaperBills.tsx` - Add Smart Meter card
- `src/hooks/useCheaperBillsSettings.ts` - Add notification email field
- `src/components/cheaper-bills/ServiceCard.tsx` - Add "Send Reminder" action
- `supabase/functions/compare-energy-deals/index.ts` - Add email notification trigger

---

## Implementation Order

1. **Resend Email Setup** (simpler, faster)
   - Add secret
   - Create edge function
   - Add UI toggles
   - Test with contract reminder

2. **Bright/Glowmarkt Integration** (more complex)
   - Add secrets
   - Create database tables
   - Create sync edge function
   - Add connection UI
   - Test sync
   - Optional: Add scheduled sync

---

## Questions Addressed

**"How do I implement Chameleon for automatic meter readings?"**

There's no direct "Chameleon API" - instead, you use the **Glowmarkt/Bright API** which receives data from your Chameleon IHD. The IHD acts as a bridge between your smart meter and the internet.

**Requirements:**
- Bright App account (free)
- CAD connected to WiFi and meter
- API access enabled (email Hildebrand support)

Once connected, you'll get automatic half-hourly readings without needing to manually enter anything!
