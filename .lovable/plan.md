Yep — good idea, and you can bolt it onto this plan cleanly. The key is: don’t try to “track orders from Amazon/Boots/etc” directly (most retailers don’t give you an easy public “orders API”). The realistic options are:

Email-based order detection (Gmail/Outlook) → pull tracking numbers + order details from confirmation/dispatch emails → store in DB.

Tracking provider API (AfterShip / 17TRACK / etc.) → once you have a tracking number, it auto-updates status via webhook. AfterShip even has an email parsing product.

Gmail push notifications so you don’t poll constantly.

Below is an add-on section you can paste into the plan you got (or re-send to Lovable as an updated requirement). I’ve kept it in the same “plan style” it uses.

Add-on: Automatic Online Order Tracking (Email + Tracking API)
Goal

Reduce manual updates by automatically detecting new toiletry orders from email and tracking them until delivered. The system should:

Detect order confirmations and dispatch emails (Amazon, Boots, Superdrug, Savers, etc.)

Extract key info: retailer, order number (if present), items (optional), tracking number, carrier (if present), ETA/status

Store orders in the database and link them to toiletry items

Auto-update shipment status using a tracking provider API + webhooks

New Database Tables
Table 3: online_orders

Stores detected orders.

Column	Type	Notes
id	uuid PK	
user_id	uuid	RLS scoped
retailer_name	text	e.g. Amazon/Boots/Superdrug
order_number	text	nullable
order_date	timestamptz	from email
status	text	detected / shipped / delivered / cancelled
source	text	gmail / outlook / manual
source_message_id	text	email id for dedupe
created_at	timestamptz	
updated_at	timestamptz	

Unique constraint:

(user_id, source, source_message_id) to prevent re-importing same email twice.

Table 4: order_shipments

Stores tracking numbers + status.

Column	Type	Notes
id	uuid PK	
user_id	uuid	RLS scoped
order_id	uuid	FK to online_orders
tracking_number	text	
carrier	text	nullable
tracking_provider	text	aftership / 17track / manual
status	text	pending / in_transit / delivered / exception
last_event_at	timestamptz	nullable
last_payload	jsonb	raw webhook payload
created_at	timestamptz	
updated_at	timestamptz	

Unique constraint:

(user_id, tracking_number).

Table 5: order_items (optional but nice)

If we can parse item names/quantities.

Column	Type
id	uuid PK
user_id	uuid
order_id	uuid
item_name	text
quantity	int
matched_toiletry_item_id	uuid nullable
Email Integration Options (choose one or support both)
Option A (Recommended): Email parsing service + tracking provider

Use AfterShip Parser API to extract order + tracking info from emails, then feed tracking numbers into AfterShip Tracking API for auto-updates.
Pros: fastest, less brittle than writing custom parsers for every retailer.
Cons: paid service.

Option B: Native Gmail integration + basic parsing + tracking provider

Connect Gmail via OAuth

Watch inbox for new emails (push notifications via Pub/Sub)

Filter likely order emails using Gmail queries (examples):

subject:(dispatched OR shipped OR delivery OR "on its way" OR order) newer_than:30d

from:(amazon.co.uk OR boots.com OR superdrug.com OR savers.co.uk)

Parse email bodies to extract tracking numbers using regex patterns (Royal Mail / Evri / DPD / Yodel etc.)

Send tracking numbers to a tracking provider API (AfterShip or 17TRACK) for webhook status updates.
Pros: cheaper.
Cons: more brittle and more dev work.

Tracking Provider (auto-updates)
Provider Choice

Support at least 1 provider:

AfterShip Tracking API (plus Parser if using Option A).

OR 17TRACK Tracking API with webhook updates.

Webhooks

Create a webhook endpoint in the app backend to receive tracking updates.

On update:

upsert into order_shipments.last_payload

update order_shipments.status

if delivered → set online_orders.status = delivered

17TRACK explicitly supports a “register tracking numbers then receive webhook updates” flow.

UI Changes
Toiletries page

Add “Orders” strip at top:

“In transit (X)”

“Due soon (X)”

“Delivered (X)”
Clicking opens Orders view.

When an order is delivered:

show “Mark as received” (optional auto-confirm)

on confirm, allow:

“Add to stock” → increases current_remaining for matched toiletry items

uses reorder_quantity * pack_size for the stock increase

Settings page

Add “Order Tracking” settings:

Connect Gmail / disconnect

Choose provider: AfterShip / 17TRACK / Manual

Toggle: “Auto-detect retailer emails”

Allowed senders/domains list + keywords list (editable)

Acceptance Tests

New dispatch email comes in → new online_orders created (no duplicates)

Tracking number extracted → order_shipments created and registered with provider

Provider webhook updates shipment status correctly

Delivered shipment → order status becomes delivered

User can one-click “Add to stock” when delivered

Works even if emails don’t include item lines (tracking-only mode)

Notes / Constraints (important)

Retailers usually don’t expose a simple API to read your orders, so email is the reliable source of truth.

Don’t hardcode retailer delivery promises as facts; keep your existing shipping profiles and this tracking layer separate:

shipping profiles = reorder estimate

tracking layer = actual live shipment status