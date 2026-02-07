# Transactions Module – Receipt Uploading & Attachments

## Overview

Extend the Transactions module to support receipt uploads (image/PDF), attachment to transactions, and manual viewing/replacement.

This implementation must **not** affect:
- transaction syncing
- bills auto-matching
- account balances
- historical transactions

All receipt functionality is strictly additive and optional.

---

## Assumptions (Locked)

| Area | Decision |
|----|----|
| Storage | Supabase Storage |
| Bucket access | Private |
| File types | JPG, PNG, WebP, PDF |
| Max file size | 10MB |
| Receipts per transaction | One (v1) |
| OCR | Not implemented |
| Auto-attach | Not implemented (future prompt) |
| Delete behaviour | Soft delete (DB cleared, file removed) |
| URL handling | Signed URLs generated on demand |

---

## Database Changes

### Extend `transactions` Table

```sql
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS receipt_path text,
ADD COLUMN IF NOT EXISTS receipt_uploaded_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS receipt_source text;
Column meanings

receipt_path: storage path only (NOT a public URL)

receipt_uploaded_at: timestamp of upload

receipt_source: 'manual' | 'auto' (auto reserved for future)

⚠️ Important: Do not store signed URLs in the database.
Always generate signed URLs at runtime.

Storage Setup
Supabase Storage Bucket
Create private bucket:

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'transaction-receipts',
  'transaction-receipts',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
);
Folder Structure
transaction-receipts/
  user_id/
    transaction_id/
      receipt.ext
Storage RLS Policies
Principle: Users may only access receipts inside their own folder.

Policies:

INSERT: user_id folder only

SELECT: user_id folder only

UPDATE: user_id folder only

DELETE: user_id folder only

No cross-user access. No public reads.

Files to Create
File	Purpose
src/lib/receiptUpload.ts	Storage + validation utilities
src/hooks/useReceiptUpload.ts	Upload/remove state handling
src/components/transactions/ReceiptPreviewDialog.tsx	View / upload / replace receipts
Files to Modify
File	Change
src/hooks/useTransactions.ts	Include receipt fields
src/components/transactions/TransactionList.tsx	Receipt icon + menu actions
src/components/transactions/TransactionRow.tsx	Paperclip indicator
Implementation Details
Receipt Upload Utility
src/lib/receiptUpload.ts

Responsibilities:

validateReceiptFile(file)

MIME type check

10MB size limit

uploadTransactionReceipt(file, userId, transactionId)

uploads to storage

returns storage path only

deleteTransactionReceipt(userId, transactionId)

removes file from storage

getReceiptSignedUrl(path)

generates short-lived signed URL (e.g. 1 hour)

isReceiptPdf(path)

helper for preview rendering

Receipt Upload Hook
src/hooks/useReceiptUpload.ts

Exposes:

uploadReceipt({ file, transactionId })

removeReceipt(transactionId)

isUploading

isRemoving

uploadProgress

Behaviour:

Updates transactions.receipt_path

Sets receipt_uploaded_at

Sets receipt_source = 'manual'

Invalidates transactions query on success

Receipt Preview Dialog
Component: ReceiptPreviewDialog.tsx

Features:

Image preview (responsive)

PDF embedded viewer (or download fallback)

Actions:

Upload

Replace

Download

Remove

Notes:

Uses signed URL generated at open time

No URLs stored long-term

Transaction List UI
Changes:

📎 Paperclip icon shown when receipt_path exists

Tooltip: “Receipt attached”

Dropdown menu options:

Upload receipt (if none)

View receipt (if exists)

Clicking icon opens preview dialog.

Safety Guarantees
No balance impact: receipts do not affect amounts

No sync impact: syncing logic unchanged

No bill impact: auto-matching untouched

Backward compatible: all new fields nullable

Deterministic: no auto-matching or guessing

Explicit Non-Goals (Do Not Implement)
OCR

Receipt text extraction

Multiple receipts per transaction

Auto-attach logic

Expense categorisation

These require separate prompts.

Success Criteria
Users can upload receipts to transactions

Receipts can be viewed, replaced, removed

UI clearly indicates receipt presence

No regressions in syncing, bills, or balances

Signed URLs expire and are regenerated safely

