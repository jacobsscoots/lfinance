
# Mobile Optimization Plan: Investments & Cheaper Bills

## Overview

This plan optimizes both the **Investments** and **Cheaper Bills** pages for mobile devices, ensuring all UI elements are usable on small screens (360px and up). The existing project already uses a `ResponsiveDialog` pattern (Dialog on desktop, Drawer on mobile) which is correctly implemented - this plan focuses on layout, typography, and interaction improvements.

---

## Current Issues Identified

### Investments Page
| Issue | Location | Problem |
|-------|----------|---------|
| Portfolio summary grid cramped | `Investments.tsx` line 294 | 5-column grid doesn't fit on mobile |
| Investment card metrics cramped | `InvestmentCard.tsx` line 133 | 4-column grid overflows on small screens |
| Chart time range buttons overflow | `InvestmentPerformanceChart.tsx` line 169 | 6 buttons in a row don't fit |
| Projection card columns cramped | `ProjectionCard.tsx` line 86-87 | 3-column grid tight on mobile |
| Header buttons too wide | `Investments.tsx` line 238-250 | Two buttons can overflow |

### Cheaper Bills Page
| Issue | Location | Problem |
|-------|----------|---------|
| Tab labels with icons overflow | `CheaperBills.tsx` line 123-140 | 4 tabs with icons don't fit |
| Service card metrics cramped | `ServiceCard.tsx` line 116 | 4-column grid overflows |
| Tariff card details cramped | `CheaperBills.tsx` line 154 | 4-column grid on tariff info |
| AI Assistant quick actions overflow | `BillsAssistant.tsx` line 83-97 | 4 buttons wrap awkwardly |
| Energy usage chart totals side-by-side | `EnergyUsageChart.tsx` line 105 | Can overflow on narrow screens |

---

## Implementation Plan

### Part 1: Investments Page Layout

#### 1.1 Portfolio Summary Card
**File:** `src/pages/Investments.tsx`

Current:
```tsx
<div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
```

Change to:
```tsx
<div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
```

Also reduce font sizes on mobile:
- Change `text-2xl` to `text-lg sm:text-2xl` for values
- Reduce gap on mobile

#### 1.2 Header Buttons
**File:** `src/pages/Investments.tsx`

Wrap buttons to stack on very small screens:
```tsx
<div className="flex flex-wrap gap-2">
```

On mobile, show only icon for "Import from Chip" to save space:
```tsx
<Button variant="outline" onClick={() => setShowChipImportInfo(true)} className="sm:gap-2">
  <Download className="h-4 w-4" />
  <span className="hidden sm:inline">Import from Chip</span>
</Button>
```

#### 1.3 Investment Card
**File:** `src/components/investments/InvestmentCard.tsx`

Change grid to 2 columns on mobile:
```tsx
<div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-4">
```

Reduce value font sizes:
```tsx
<p className="text-lg sm:text-xl font-bold">
```

Improve header layout for mobile - stack title/metadata:
```tsx
<CardHeader className="flex flex-col sm:flex-row sm:items-start justify-between pb-2 gap-2">
```

#### 1.4 Performance Chart Time Range Buttons
**File:** `src/components/investments/InvestmentPerformanceChart.tsx`

Make buttons scrollable horizontally on mobile or use a select dropdown:
```tsx
<div className="flex gap-1 overflow-x-auto pb-1 -mb-1">
```

Or alternatively, reduce to fewer options on mobile (1M, 3M, 1Y, ALL).

#### 1.5 Projection Card
**File:** `src/components/investments/ProjectionCard.tsx`

Make projection periods scrollable on mobile:
```tsx
<div className="grid grid-cols-3 gap-2 sm:gap-3">
```

Reduce padding and font sizes:
```tsx
<div className="text-center p-2 sm:p-3 rounded-lg bg-muted/50">
  <p className="text-xs text-muted-foreground uppercase mb-1">...</p>
  <p className="text-base sm:text-lg font-bold text-foreground">
```

Risk preset buttons - stack or make smaller:
```tsx
<div className="flex flex-col sm:flex-row gap-2">
  {presets.map(...)}
</div>
```

Or use abbreviated labels on mobile: "Cons", "Med", "Agg"

#### 1.6 Contribution List
**File:** `src/components/investments/ContributionList.tsx`

Already mobile-friendly but ensure amounts don't wrap:
```tsx
<span className="font-semibold whitespace-nowrap">
```

#### 1.7 Selected Investment Details Grid
**File:** `src/pages/Investments.tsx`

Stack chart and projections on mobile:
```tsx
<div className="grid gap-6 lg:grid-cols-2">
```

(Already using this pattern - good!)

---

### Part 2: Cheaper Bills Page Layout

#### 2.1 Tab Navigation
**File:** `src/pages/CheaperBills.tsx`

Hide icon text on mobile, show only icons with tooltips:
```tsx
<TabsList className="w-full justify-start overflow-x-auto">
  <TabsTrigger value="energy" className="gap-1 sm:gap-2 px-3 sm:px-4">
    <Zap className="h-4 w-4" />
    <span className="hidden sm:inline">Energy</span>
  </TabsTrigger>
  ...
</TabsList>
```

Alternative: Use scrollable tabs with full text:
```tsx
<TabsList className="w-full h-auto flex-wrap sm:flex-nowrap">
```

#### 2.2 Service Card
**File:** `src/components/cheaper-bills/ServiceCard.tsx`

Change grid to 2 columns on mobile:
```tsx
<div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-4">
```

Reduce value font sizes:
```tsx
<p className="text-base sm:text-lg font-bold">
```

Improve header layout - icon and title can stack on very narrow screens:
```tsx
<CardHeader className="flex flex-row items-start justify-between pb-2 gap-2">
  <div className="flex items-start sm:items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap">
```

#### 2.3 Tariff Details Grid
**File:** `src/pages/CheaperBills.tsx`

Change to 2 columns on mobile:
```tsx
<div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-4 text-sm">
```

#### 2.4 AI Assistant Quick Actions
**File:** `src/components/cheaper-bills/BillsAssistant.tsx`

Make quick action buttons wrap properly and use full width on mobile:
```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
  {quickQuestions.map((q) => (
    <Button
      key={q}
      variant="outline"
      size="sm"
      onClick={() => sendMessage(q)}
      disabled={isLoading}
      className="text-xs justify-start h-auto py-2 px-3"
    >
      <Lightbulb className="h-3 w-3 mr-1 flex-shrink-0" />
      <span className="text-left">{q}</span>
    </Button>
  ))}
</div>
```

#### 2.5 Energy Usage Chart Footer
**File:** `src/components/cheaper-bills/EnergyUsageChart.tsx`

Stack totals on mobile:
```tsx
<div className="flex flex-col sm:flex-row justify-between gap-2 mt-4 pt-4 border-t text-sm">
```

#### 2.6 Overview Cards Row
**File:** `src/pages/CheaperBills.tsx`

Already using `grid-cols-1 sm:grid-cols-3` - good!

---

### Part 3: Shared Improvements

#### 3.1 Chart Heights
Reduce chart heights on mobile for better viewport fit:

**InvestmentPerformanceChart.tsx:**
```tsx
<ChartContainer config={chartConfig} className="h-[200px] sm:h-[300px]">
```

**EnergyUsageChart.tsx:**
```tsx
<ChartContainer config={chartConfig} className="h-[150px] sm:h-[200px]">
```

#### 3.2 Button Text Truncation
Add text truncation to prevent overflow:
```tsx
className="truncate"
```

#### 3.3 Card Padding Reduction
Reduce card padding on mobile:
```tsx
<CardContent className="p-4 sm:p-6">
```

(Shadcn defaults are usually fine, but check spacing)

---

## Technical Changes Summary

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Investments.tsx` | Portfolio summary grid, header buttons, details grid |
| `src/components/investments/InvestmentCard.tsx` | Metrics grid, value font sizes, header layout |
| `src/components/investments/InvestmentPerformanceChart.tsx` | Time range buttons, chart height |
| `src/components/investments/ProjectionCard.tsx` | Projection grid, risk preset buttons |
| `src/components/investments/ContributionList.tsx` | Amount whitespace |
| `src/pages/CheaperBills.tsx` | Tab labels, tariff grid |
| `src/components/cheaper-bills/ServiceCard.tsx` | Metrics grid, value sizes |
| `src/components/cheaper-bills/BillsAssistant.tsx` | Quick action buttons grid |
| `src/components/cheaper-bills/EnergyUsageChart.tsx` | Footer layout, chart height |

---

## Testing Plan

After implementation, test on these viewports:
1. **iPhone SE** (375px) - Smallest common phone
2. **iPhone 14** (390px) - Standard modern phone
3. **iPad Mini** (768px) - Tablet breakpoint
4. **Desktop** (1280px+) - Ensure no regressions

### Test Checklist
- [ ] Investments: Portfolio summary readable on 375px
- [ ] Investments: InvestmentCard shows all 4 metrics without overflow
- [ ] Investments: Chart time range buttons accessible
- [ ] Investments: Projection card values visible
- [ ] Investments: Add/Edit dialogs usable (already uses ResponsiveDialog)
- [ ] Cheaper Bills: All 4 tabs visible/accessible
- [ ] Cheaper Bills: Service card metrics readable
- [ ] Cheaper Bills: AI assistant buttons don't overflow
- [ ] Cheaper Bills: Energy chart totals don't wrap mid-word
- [ ] All dialogs open as bottom drawers on mobile

---

## Implementation Order

1. **Investments page layout** (highest impact - Portfolio Summary, InvestmentCard)
2. **Cheaper Bills tabs and ServiceCard** (second most used area)
3. **Charts height reduction** (improves viewport fit)
4. **AI Assistant and secondary components** (polish)
5. **Browser testing on mobile viewport** (verification)

---

## Notes

- All form dialogs already use `ResponsiveDialog` which automatically converts to bottom drawers on mobile - no changes needed there
- The `useIsMobile()` hook uses 768px breakpoint (matches Tailwind's `md:`)
- Existing responsive patterns (`sm:`, `lg:`) are used consistently - this plan extends that approach
- No database changes required
- No new dependencies needed
