

# Life Tracker - Personal Finance & Life Dashboard

A premium, calm personal finance app with UK Open Banking integration, smart pay-cycle tracking, and a cohesive purple-themed design that makes daily money management feel supportive rather than stressful.

---

## Design System & Theme

**Purple Color Palette (Light Mode First)**
- Primary structure: Deep purples (#310055, #3C0663, #4A0A77, #5A108F, #6818A5)
- Interactive accents: Soft purples (#8B2FC9, #AB51E3, #BD68EE, #D283FF, #DC97FF)
- Backgrounds: Soft neutral whites and light grays
- Warning states: Warm amber (accessible, non-clashing)
- Success states: Soft teal-green

**Visual Style**
- Rounded cards with subtle shadows
- Generous spacing and breathing room
- Clean typography hierarchy
- Dark mode toggle available in settings

---

## Core Features (Phase 1)

### 1. Authentication & User Security
- Email/password login with Lovable Cloud
- Secure session management
- Protected routes for all financial data

### 2. Home Dashboard
A calm, glanceable overview showing:
- **Pay Cycle Status**: Days until next payday, money remaining, spending pace indicator
- **Month-to-Date Summary**: Income vs outgoings with visual comparison
- **Net Position**: Running balance trend chart
- **Upcoming Bills**: Next 7 days of scheduled payments
- **Pattern Alerts**: Supportive early warnings when spending trends exceed norms
- Collapsible/reorderable sections for customization

### 3. Smart Pay Cycle Engine
- **Official payday**: 20th of each month
- **Monzo early-pay rule**: If 20th falls on Saturday, Sunday, or Monday → paid on the preceding Friday. Otherwise paid on the 20th.
- Date range: January 2026 - January 2027 (extendable)
- Variable income support: Expected vs actual per month
- Pay-cycle summaries: Income received, total spent, what's left, trend comparison

### 4. Bank Accounts & Transactions
**Manual Entry First (Bank sync added in Phase 1b)**
- Add/edit/remove accounts with custom labels and groupings
- Manual transaction entry with date, amount, merchant, category
- Transaction feed with search and filters
- Category assignment with manual override capability

**Categories System**
- Sensible default category set
- Add/rename/remove categories without breaking history
- Merchant mapping rules (e.g., "AMZN MKTP" → "Amazon" → Shopping)
- Category preserved through renames

### 5. Bills & Subscriptions Manager
- Structured bill entries: Name, amount, frequency, due date, provider, start/end dates
- Review date reminders for savings checks
- Automatic projection into monthly calendar and cashflow forecast
- "Money needed before next payday" calculation

### 6. Monthly Calendar View
- Full month grid layout, Monday-Sunday orientation
- View-only display of bills and predicted outgoings
- Daily totals with clickable detail panels
- Color-coded by category or bill type

### 7. Grocery & Meal Planning
**Grocery Budget Tracking**
- Weekly budget setting
- Saturday/Sunday shop → following Monday cycle logic (8-9 day cycles)
- Manual entry OR linked bank transaction matching
- Overspend warnings and trend history

**Weekly Meal Planner**
- Monday-Sunday grid view
- Simple text-based meal entries per day
- Linked to current grocery cycle for context

### 8. Settings
- Account management (bank accounts, labels)
- Category management (add/rename/remove)
- Budget settings per category
- Payday rules configuration
- Theme toggle (light/dark)
- Data range extension controls

---

## Bank Sync Integration (Phase 1b)

### TrueLayer Open Banking
- Secure OAuth connection flow for Monzo and other UK banks
- Token storage with encryption at rest
- Automatic refresh token handling
- "Last synced" timestamp display

### Transaction Ingestion
- Pull balances and transactions (including pending where supported)
- Background sync with webhook support where available
- Merchant normalization and auto-categorization
- Multi-account support with grouping controls

---

## Phase 2 Features (Designed for Clean Addition)

These will be built on a data model that supports them from day one:

1. **Toiletries Inventory Tracker**
   - Product-level tracking with quantities on hand
   - Average usage rate calculation
   - Estimated run-out dates
   - "Order by" dates based on retailer delivery times

2. **Net Worth Tracking**
   - Combined bank balances + manual assets/liabilities
   - Monthly snapshot history
   - Growth trend visualization

3. **Debt Payoff Tracker**
   - "Debt-free by" target date setting
   - Progress visualization over time
   - Payoff strategy suggestions

4. **Investment Tracking**
   - Manual portfolio entry
   - CSV import fallback for non-connected accounts

---

## Technical Architecture

**Frontend**
- React with TypeScript
- Tailwind CSS with custom purple design tokens
- Recharts for data visualization
- Responsive design (desktop-first, mobile-friendly)

**Backend (Lovable Cloud)**
- Database: Users, accounts, transactions, categories, bills, grocery cycles, meal plans
- Authentication: Email/password with secure sessions
- Edge Functions: TrueLayer API integration, scheduled sync jobs
- Secrets Management: API keys and tokens encrypted

**Data Model Highlights**
- Flexible category system with rename-safe references
- Transaction-to-category mapping table for rule persistence
- Pay cycle calculation as computed view, not stored
- Extendable date ranges without schema changes

---

## What You'll Get

A beautifully designed, genuinely calming personal finance dashboard that:
- Replaces scattered spreadsheets with one cohesive tool
- Shows you exactly where you stand each pay cycle
- Warns you early about overspending patterns (kindly, not naggingly)
- Keeps your grocery and meal planning connected
- Connects securely to your UK bank accounts
- Grows with you as you add Phase 2 features

