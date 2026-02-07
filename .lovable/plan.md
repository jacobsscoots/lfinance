Settings Module: Payday Rules & Payslip Upload (Safe, Additive)
Overview

Extend the Settings module with two additive features:

Editable Payday Rules – user-configurable payday date and adjustment logic

Payslip Upload & Extraction – upload payslips (PDF/image), extract pay data, and optionally match to income transactions

⚠️ Hard rule:
These features must not modify existing balances, transactions, bill logic, or calculations. All changes are opt-in, additive, and reversible.

Feature 1: Editable Payday Rules
Current State (Baseline)

Payday defaults to 20th of the month

UK working-day logic already exists

Some dashboards and calendars already depend on this behaviour

Target State (v1 – Safe)

User can:

Set payday date (1–28 only)

Choose adjustment rule:

previous_working_day (default)

next_working_day

closest_working_day

no_adjustment

Monthly frequency only (explicitly locked for v1)

If no settings exist, system must behave exactly as it does today

Database Changes

Create a separate, optional table for payday settings:

CREATE TABLE public.user_payday_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payday_date integer NOT NULL DEFAULT 20 CHECK (payday_date BETWEEN 1 AND 28),
  adjustment_rule text NOT NULL DEFAULT 'previous_working_day'
    CHECK (adjustment_rule IN (
      'previous_working_day',
      'next_working_day',
      'closest_working_day',
      'no_adjustment'
    )),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);


Enable RLS (read/update own row only).

Payday Calculation Rules (Critical Guardrail)

All payday functions must accept optional settings

If settings are missing → use current hardcoded logic

No existing callers should break

export function getPayday(
  year: number,
  month: number,
  settings?: {
    paydayDate: number;
    adjustmentRule: AdjustmentRule;
  }
): Date {
  const effectiveDate = settings?.paydayDate ?? 20;
  const rule = settings?.adjustmentRule ?? 'previous_working_day';
  // existing logic reused internally
}


⚠️ No global state. No mutation. No overrides.

Files to Create / Modify (Payday)
File	Action
src/hooks/usePaydaySettings.ts	CREATE
src/components/settings/PaydaySettings.tsx	CREATE
src/lib/payday.ts	MODIFY (accept settings param only)
src/lib/ukWorkingDays.ts	MODIFY (add rule helpers)
src/pages/Settings.tsx	MODIFY
src/hooks/useDashboardData.ts	MODIFY (pass settings if present)
Feature 2: Payslip Upload & Extraction
Scope (v1 – Locked)

Included

Upload payslip (PDF/image)

Extract key fields

Store extracted data

Optionally match to income transaction

Explicitly Excluded

OCR correction UI

Expense categorisation

Auto-creation of transactions

Balance changes

Multi-payslip per transaction

Database: Payslips Table
CREATE TABLE public.payslips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  file_path text NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now(),

  gross_pay numeric(10,2),
  net_pay numeric(10,2),
  tax_deducted numeric(10,2),
  ni_deducted numeric(10,2),
  pension_deducted numeric(10,2),

  pay_period_start date,
  pay_period_end date,
  employer_name text,

  extraction_confidence text CHECK (extraction_confidence IN ('high','medium','low')),
  extraction_raw jsonb,

  matched_transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL,
  match_status text DEFAULT 'pending'
    CHECK (match_status IN ('pending','auto_matched','manual_matched','no_match')),
  matched_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);


RLS: user can only access their own rows.

Storage (Payslips)

Bucket: payslips (private)

Path format: {userId}/{payslipId}/original.ext

Max size: 10MB

MIME types: JPG, PNG, WebP, PDF

Payslip Extraction (Edge Function)
Guardrails (Very Important)

Extraction runs once per upload

No re-processing unless user explicitly requests

Raw model output always stored (extraction_raw)

Confidence score required

Never overwrite manually edited fields

// supabase/functions/extract-payslip/index.ts
// Vision-based structured extraction
// Returns JSON only (no free text)

Auto-Matching Rules (Income Only)

A payslip may auto-match only if ALL are true:

Transaction type = income

Amount within ±£0.50 of extracted net_pay

Date within ±2 days of pay_period_end

Transaction not already linked to another payslip

Exactly one match exists

Otherwise → match_status = 'pending'

⚠️ Never modify the transaction amount. Never affect balances.

UI Components
Settings → Payslips

Upload button

List of past payslips

Status badges:

Auto-matched

Pending review

No match

Payslip Detail Dialog

Read-only extracted values

Confidence indicator

Link / unlink transaction

View original file

Delete payslip

Files to Create / Modify (Payslips)
File	Action
supabase/functions/extract-payslip/index.ts	CREATE
src/lib/payslipUpload.ts	CREATE
src/hooks/usePayslips.ts	CREATE
src/components/settings/PayslipSettings.tsx	CREATE
src/components/settings/PayslipPreviewDialog.tsx	CREATE
src/pages/Settings.tsx	MODIFY
Safety Guarantees (Non-Negotiable)

No balance changes

No transaction edits

No bill logic changes

Payday defaults preserved if settings missing

AI extraction is single-pass and stored

All features opt-in

Clarification Questions (Must Be Answered Before Build)

Should payslip matching ignore refunds/reversals?

If multiple income transactions match, should we always force manual review?

Should employer name be used as a secondary hint for matching (read-only)?

Should users be allowed to manually override extracted values?

Should extraction be disabled entirely if confidence = low?

(Implementation must pause until these are confirmed.)

Implementation Order

Payday settings (DB → hook → logic → UI)

Payslip storage + upload

Extraction edge function

Matching logic

UI review flow