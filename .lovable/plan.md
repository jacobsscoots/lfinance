
# Show Cheaper Deal Providers with Website Links

## Overview
Enhance the scan results to display which providers are offering cheaper deals, along with clickable links to their websites. This involves:
1. Adding a `website_url` field to store provider links
2. Updating the edge function to include provider URLs
3. Creating a new UI component to display comparison results
4. Adding a collapsible section on each ServiceCard to show cheaper alternatives

---

## Implementation Steps

### Step 1: Add Database Column
Add a `website_url` column to the `comparison_results` table to store provider sign-up links.

```sql
ALTER TABLE comparison_results 
ADD COLUMN website_url TEXT;
```

### Step 2: Update Edge Function with Provider URLs
Update `compare-energy-deals/index.ts` to include website URLs for each provider in the market data:

**Provider URL Mappings:**
- Energy: Octopus, British Gas, EDF, E.ON, Scottish Power, Ovo, Shell, Utility Warehouse
- Broadband: BT, Sky, Virgin Media, Vodafone, Plusnet, TalkTalk, NOW Broadband, Shell Energy
- Mobile: Three, Voxi, GiffGaff, EE, O2, Vodafone, iD Mobile, Smarty, Lebara

The function will populate the `website_url` field when storing results.

### Step 3: Update Types and Hooks
Update `useComparisonResults.ts` to include the new `website_url` field in the `ComparisonResult` interface.

### Step 4: Create Comparison Results Panel Component
Create a new `ScanResultsPanel.tsx` component that displays:
- List of cheaper providers found
- Provider name, plan, monthly cost, annual savings
- "View Deal" button that opens the provider website in a new tab
- Sorted by savings (highest first)

### Step 5: Update ServiceCard to Show Scan Results
Enhance `ServiceCard.tsx` to:
- Show an expandable section when scan results exist
- Display the top 3-5 cheaper alternatives
- Include external link icons with "View Deal" buttons
- Use a collapsible/accordion pattern for clean UI

### Step 6: Update LastScanCard for Quick Access
Enhance `LastScanCard.tsx` to show the best offer found with a direct link when recommendation is "switch".

---

## Technical Details

### Provider Website URLs (Examples)
```typescript
const PROVIDER_URLS = {
  // Energy
  'Octopus Energy': 'https://octopus.energy/dashboard/new-quote/',
  'British Gas': 'https://www.britishgas.co.uk/energy.html',
  'EDF': 'https://www.edfenergy.com/gas-electricity',
  'E.ON Next': 'https://www.eonnext.com/',
  
  // Broadband
  'BT': 'https://www.bt.com/broadband/',
  'Sky': 'https://www.sky.com/broadband/',
  'Virgin Media': 'https://www.virginmedia.com/broadband/',
  
  // Mobile
  'Three': 'https://www.three.co.uk/plans/',
  'Voxi': 'https://www.voxi.co.uk/plans/',
  'GiffGaff': 'https://www.giffgaff.com/sim-only-plans/',
};
```

### New ScanResultsPanel Props
```typescript
interface ScanResultsPanelProps {
  results: ComparisonResult[];
  serviceType: string;
  isLoading?: boolean;
}
```

### ServiceCard Enhancement
```tsx
// Add collapsible section showing alternatives
{hasResults && (
  <Collapsible>
    <CollapsibleTrigger>
      <span>View {results.length} cheaper alternatives</span>
    </CollapsibleTrigger>
    <CollapsibleContent>
      {results.map(result => (
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">{result.provider}</p>
            <p className="text-sm text-muted-foreground">{result.plan_name}</p>
            <p className="text-success">Save £{savings}/year</p>
          </div>
          <Button asChild size="sm">
            <a href={result.website_url} target="_blank" rel="noopener noreferrer">
              View Deal <ExternalLink className="h-3 w-3 ml-1" />
            </a>
          </Button>
        </div>
      ))}
    </CollapsibleContent>
  </Collapsible>
)}
```

---

## Files to Modify
1. `supabase/migrations/` - New migration to add `website_url` column
2. `supabase/functions/compare-energy-deals/index.ts` - Add provider URL mappings
3. `src/hooks/useComparisonResults.ts` - Add `website_url` to interface
4. `src/components/cheaper-bills/ScanResultsPanel.tsx` - **New component**
5. `src/components/cheaper-bills/ServiceCard.tsx` - Add collapsible results section
6. `src/components/cheaper-bills/LastScanCard.tsx` - Add best offer link

---

## User Experience
After scanning:
1. The ServiceCard shows "View 5 cheaper alternatives" link
2. Expanding reveals a list of providers sorted by savings
3. Each row shows: Provider name, plan, monthly cost, annual savings, "View Deal" button
4. Clicking "View Deal" opens the provider's website in a new tab
5. The LastScanCard also shows a quick link to the best offer when recommendation is "switch"
