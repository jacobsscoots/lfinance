import fs from 'node:fs';

function edit(path, transform) {
  const before = fs.readFileSync(path, 'utf8');
  const after = transform(before);
  if (before === after) console.warn(`No change: ${path}`);
  fs.writeFileSync(path, after);
}

function replace(path, from, to) {
  edit(path, text => {
    if (!text.includes(from)) console.warn(`Pattern not found in ${path}: ${from}`);
    return text.replaceAll(from, to);
  });
}

// Remaining reliability findings after the first Sonar pass.
replace(
  'supabase/migrations/20260214151750_c25370f1-fd01-4fcf-85cd-dd8436e3390e.sql',
  "IF COALESCE(jwt_secret, '') = '' THEN",
  "IF NULLIF(jwt_secret, '') IS NULL THEN"
);

replace(
  'src/lib/receiptMatcher.ts',
  '/([\\d,]{1,32}\\.?\\d*)\\s{0,20}GBP/i',
  '/([\\d,]{1,32}(?:\\.\\d{1,2})?)\\s{0,20}GBP/i'
);
replace(
  'src/lib/discounts.ts',
  '/(\\d+)\\s{0,20}for\\s{0,20}(?:the\\s{0,20}price\\s{0,20}of\\s{0,20})?(\\d+)/i',
  '/(\\d{1,6})\\s{0,20}for\\s{0,20}(?:the\\s{0,20}price\\s{0,20}of\\s{0,20})?(\\d{1,6})/i'
);
replace(
  'src/lib/nutritionExtraction.ts',
  '/(\\d+)\\s{0,20}(?:g|ml)\\s{0,20}(?:pack|net|e)/i',
  '/(\\d{1,6})\\s{0,20}(?:g|ml)\\s{0,20}(?:pack|net|e)/i'
);

for (const path of [
  'supabase/functions/extract-nutrition/index.ts',
  'supabase/functions/gmail-sync-receipts/index.ts',
  'supabase/functions/gmail-tracking-sync/index.ts',
]) {
  edit(path, text => text
    .replaceAll('replaceAll(/,/g, "")', 'replaceAll(",", "")')
    .replaceAll("replaceAll(/-/g, '+')", "replaceAll('-', '+')")
    .replaceAll("replaceAll(/_/g, '/')", "replaceAll('_', '/')")
    .replaceAll("replaceAll(/-/g, '/')", "replaceAll('-', '/')")
    .replaceAll('replaceAll(/-/g, "+")', 'replaceAll("-", "+")')
    .replaceAll('replaceAll(/_/g, "/")', 'replaceAll("_", "/")')
    .replaceAll('replaceAll(/-/g, "/")', 'replaceAll("-", "/")')
  );
}

for (const path of [
  'src/components/dashboard/AccountsOverview.tsx',
  'src/components/dashboard/AlertsPanel.tsx',
  'src/components/dashboard/BudgetHealthCard.tsx',
  'src/components/dashboard/UpcomingBillsExpanded.tsx',
]) {
  edit(path, text => text.replaceAll('[...Array(', '[...new Array('));
}

console.log('Residual Sonar source fixes applied');
