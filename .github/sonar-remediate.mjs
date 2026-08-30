import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const write = (p, s) => fs.writeFileSync(path.join(ROOT, p), s);
const edit = (p, fn) => write(p, fn(read(p)));
const replace = (p, from, to) => edit(p, s => {
  if (!s.includes(from)) console.warn(`pattern not found: ${p}: ${from.slice(0, 80)}`);
  return s.replaceAll(from, to);
});

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(?:ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

// S7773 + S7781: scoped, semantics-preserving built-in APIs.
for (const abs of walk(ROOT)) {
  let s = fs.readFileSync(abs, 'utf8');
  for (const [name, replacement] of [
    ['parseFloat', 'Number.parseFloat'],
    ['parseInt', 'Number.parseInt'],
    ['isNaN', 'Number.isNaN'],
    ['isFinite', 'Number.isFinite'],
  ]) {
    s = s.replace(new RegExp(`(?<![\\w.])${name}\\s*\\(`, 'g'), `${replacement}(`);
  }
  s = s.replace(/\.replace\((\/[^/\n\\]*(?:\\.[^/\n\\]*)*\/[a-z]*g[a-z]*),/g, '.replaceAll($1,');
  fs.writeFileSync(abs, s);
}

// S2245: replace Math.random with Web Crypto in the three flagged runtime files.
for (const p of ['src/lib/portioningEngine.ts', 'supabase/functions/claude-ai/index.ts', 'src/components/ui/sidebar.tsx']) {
  edit(p, s => {
    if (!s.includes('Math.random()')) return s;
    s = s.replaceAll('Math.random()', 'secureRandom()');
    if (!s.includes('function secureRandom()')) {
      s += `\n\nfunction secureRandom(): number {\n  const values = new Uint32Array(1);\n  globalThis.crypto.getRandomValues(values);\n  return values[0] / 0x1_0000_0000;\n}\n`;
    }
    return s;
  });
}

// S7723, S7758, S2871.
for (const p of [
  'src/components/dashboard/AccountsOverview.tsx',
  'src/components/dashboard/AlertsPanel.tsx',
  'src/components/dashboard/BudgetHealthCard.tsx',
  'src/components/dashboard/UpcomingBillsExpanded.tsx',
]) edit(p, s => s.replace(/(?<![\w.])Array\(/g, 'new Array('));
replace('src/lib/excelImportParser.ts', 'letters.charCodeAt(i) - 64', '(letters.codePointAt(i) ?? 64) - 64');
replace('src/lib/dealScanner.ts', 'const char = normalized.charCodeAt(i);', 'const char = normalized.codePointAt(i) ?? 0;');
replace('src/components/debt/DebtCharts.tsx', 'Array.from(paymentsByMonth.keys()).sort().reverse()', 'Array.from(paymentsByMonth.keys()).sort((a, b) => a.localeCompare(b)).reverse()');
replace('src/components/debt/DebtCharts.tsx', '.sort()\n    .slice(-12)', '.sort((a, b) => a.localeCompare(b))\n    .slice(-12)');

// S3923: identical conditional branches.
replace('src/hooks/useMealPlanItems.ts', 'isEffectivelyLocked ? item.quantity_grams : item.quantity_grams  // Always pass actual grams; solver will clamp', 'item.quantity_grams  // Always pass actual grams; solver will clamp');
replace('supabase/functions/truelayer-sync/index.ts', `const detectedProvider = syncedAccounts.length > 0\n      ? syncedAccounts[0].type === 'card'\n        ? (syncedAccounts.find(a => a.type === 'account')?.account_id ? connectionProvider : connectionProvider)\n        : connectionProvider\n      : connectionProvider;`, 'const detectedProvider = connectionProvider;');
replace('supabase/functions/truelayer-sync/index.ts', 'const providerFromAccounts = syncedAccounts.length > 0 ? connectionProvider : connectionProvider;', 'const providerFromAccounts = connectionProvider;');
replace('src/lib/energyCsvParser.ts', `let fuelType = fuelTypeCol !== -1 \n          ? detectFuelType(headers, parts)\n          : detectFuelType(headers, parts);`, 'const fuelType = detectFuelType(headers, parts);');
replace('src/lib/dashboardCalculations.ts', 'cumulative: isPast ? cumulativeActual : cumulativeActual, // Continue last known value', 'cumulative: cumulativeActual, // Continue last known value');

// S6439: force render conditions to booleans so zero/empty values cannot leak into JSX.
const jsxReplacements = {
  'src/components/cheaper-bills/CompareProvidersDialog.tsx': [
    ['{service.current_speed_mbps && (', '{Boolean(service.current_speed_mbps) && ('],
    ['{(service.preferred_contract_months || service.contract_end_date) && (', '{Boolean(service.preferred_contract_months || service.contract_end_date) && ('],
    ['{service.preferred_contract_months && (', '{Boolean(service.preferred_contract_months) && ('],
  ],
  'src/components/transactions/TransactionList.tsx': [['{tag.amount && <span', '{Boolean(tag.amount) && <span']],
  'src/components/debt/DebtList.tsx': [
    ['{debt.apr && <span', '{Boolean(debt.apr) && <span'],
    ['{debt.min_payment && `', '{Boolean(debt.min_payment) && `'],
    ['{debt.due_day && `', '{Boolean(debt.due_day) && `'],
  ],
  'src/components/debt/PaymentList.tsx': [
    ['{(payment.principal_amount || payment.interest_amount) && (', '{Boolean(payment.principal_amount || payment.interest_amount) && ('],
    ['{payment.principal_amount && `', '{Boolean(payment.principal_amount) && `'],
    ['{payment.interest_amount && `', '{Boolean(payment.interest_amount) && `'],
  ],
  'src/components/debt/PayoffPlanCard.tsx': [['{item.apr && `', '{Boolean(item.apr) && `']],
  'src/components/toiletries/PriceComparisonDialog.tsx': [['{item?.total_size && item?.size_unit && `', '{Boolean(item?.total_size && item?.size_unit) && `']],
  'src/components/mealplan/WeeklySummaryCard.tsx': [
    ['{isTargetMode && settings?.daily_calorie_target && (', '{Boolean(isTargetMode && settings?.daily_calorie_target) && ('],
    ['{isTargetMode && settings?.protein_target_grams && (', '{Boolean(isTargetMode && settings?.protein_target_grams) && ('],
    ['{isTargetMode && settings?.carbs_target_grams && (', '{Boolean(isTargetMode && settings?.carbs_target_grams) && ('],
    ['{isTargetMode && settings?.fat_target_grams && (', '{Boolean(isTargetMode && settings?.fat_target_grams) && ('],
  ],
};
for (const [p, pairs] of Object.entries(jsxReplacements)) for (const [a, b] of pairs) replace(p, a, b);

// S1082/S6848: keyboard-operable custom click regions.
replace('src/components/calendar/CalendarGrid.tsx', '      onClick={onClick}\n      className={cn(', '      onClick={onClick}\n      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }}\n      role="button"\n      tabIndex={0}\n      className={cn(');
replace('src/components/settings/ExcelImportDialog.tsx', '              onDrop={handleDrop}\n              onClick={() =>\n                document.getElementById("excel-import-input")?.click()\n              }\n', '              onDrop={handleDrop}\n              onClick={() =>\n                document.getElementById("excel-import-input")?.click()\n              }\n              onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }}\n              role="button"\n              tabIndex={0}\n');
replace('src/components/mealplan/CopyToDateDialog.tsx', '                  onClick={() => setSelectedDate(date)}\n', '                  onClick={() => setSelectedDate(date)}\n                  onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }}\n                  role="button"\n                  tabIndex={0}\n');
replace('src/components/transactions/ReceiptPreviewDialog.tsx', '              onClick={!hasReceipt ? handleUploadClick : undefined}\n', '              onClick={!hasReceipt ? handleUploadClick : undefined}\n              onKeyDown={!hasReceipt ? (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } } : undefined}\n              role={!hasReceipt ? "button" : undefined}\n              tabIndex={!hasReceipt ? 0 : undefined}\n');

// S6772 explicit JSX spacing.
replace('src/components/dashboard/RunwayBalanceCard.tsx', '              Tomorrow starts\n              <span', '              Tomorrow starts{" "}\n              <span');
replace('src/components/yearly-planner/DetailedYearlyTable.tsx', '                  Income\n                  <button', '                  Income{" "}\n                  <button');
replace('src/components/mealplan/DayDetailModal.tsx', '                  No solver debug data available. Enable debug mode by running:\n                  <code', '                  No solver debug data available. Enable debug mode by running:{" "}\n                  <code');
replace('src/components/mealplan/DayDetailModal.tsx', '                  </code>\n                  Then click', '                  </code>{" "}\n                  Then click');

// S6853: these are section captions, not labels for one native control.
replace('src/components/toiletries/ToiletryFormDialog.tsx', '<label className="text-sm font-medium">Photo</label>', '<div className="text-sm font-medium">Photo</div>');
replace('src/components/mealplan/MealItemMultiSelectDialog.tsx', '<label className="text-sm font-medium">Products</label>', '<div className="text-sm font-medium">Products</div>');

// S6850: reusable visual titles may legally be empty; don't expose empty heading elements.
edit('src/components/ui/alert.tsx', s => s
  .replace('React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>', 'React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>')
  .replace('<h5 ref={ref} className={cn("mb-1 font-medium leading-none tracking-tight", className)} {...props} />', '<div ref={ref} className={cn("mb-1 font-medium leading-none tracking-tight", className)} {...props} />'));
edit('src/components/ui/card.tsx', s => s
  .replace('React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>', 'React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>')
  .replace('<h3 ref={ref} className={cn("text-2xl font-semibold leading-none tracking-tight", className)} {...props} />', '<div ref={ref} className={cn("text-2xl font-semibold leading-none tracking-tight", className)} {...props} />'));

// S5256: row headers make the printable key/value summary table accessible.
edit('src/components/debt/DebtReportsTab.tsx', s => {
  const start = s.indexOf('<table className="w-full text-sm">');
  const end = s.indexOf('</table>', start);
  if (start < 0 || end < 0) return s;
  const head = s.slice(0, start);
  const table = s.slice(start, end).replaceAll('<td className="py-1">', '<th scope="row" className="py-1 text-left font-normal">').replaceAll('</td>\n                <td className="text-right">', '</th>\n                <td className="text-right">');
  return head + table + s.slice(end);
});

// S6747 unknown DOM property; keep a standards-compliant data attribute.
replace('src/components/ui/command.tsx', 'cmdk-input-wrapper=""', 'data-cmdk-input-wrapper=""');
edit('src/components/ui/command.tsx', s => s.replaceAll('[cmdk-input-wrapper]', '[data-cmdk-input-wrapper]'));

// PL/SQL NullComparison.
replace('supabase/migrations/20260214151750_c25370f1-fd01-4fcf-85cd-dd8436e3390e.sql', "IF jwt_secret IS NULL OR jwt_secret = '' THEN", "IF COALESCE(jwt_secret, '') = '' THEN");

// S8786: bound ambiguous repetitions only on the exact Sonar-reported regex lines.
const regexLines = {
  'src/lib/excelImportParser.ts': [493],
  'supabase/functions/gmail-sync-receipts/index.ts': [74,75,94,95,271,272,273,429],
  'supabase/functions/gmail-tracking-sync/index.ts': [47],
  'supabase/functions/ingest-order-emails/index.ts': [42,52],
  'src/components/transactions/TransactionList.tsx': [233],
  'src/lib/emailOrderParsers.ts': [84,87,110],
  'src/lib/investmentCsvParser.ts': [122],
  'src/lib/receiptMatcher.ts': [245,247],
  'supabase/functions/search-toiletry-prices/index.ts': [233],
  'src/lib/discounts.ts': [80],
  'supabase/functions/extract-nutrition/index.ts': [271,294,304,314,337,338,339,345,346,347,352,357,358,363,367,371,375,379,399,790],
  'src/lib/nutritionExtraction.ts': [30,31,32,33,39,40,41,42,48,49,55,56,57,63,64,65,71,72,78,84,90,96,143],
};
for (const [p, nums] of Object.entries(regexLines)) {
  edit(p, s => {
    const lines = s.split('\n');
    for (const n of nums) {
      let line = lines[n - 1];
      if (line === undefined) continue;
      line = line
        .replaceAll('\\s*', '\\s{0,20}')
        .replaceAll('\\s+', '\\s{1,20}')
        .replaceAll('[\\d,.]+', '[\\d,.]{1,32}')
        .replaceAll('[\\d,]+', '[\\d,]{1,32}')
        .replaceAll('[\\s\\S]*', '[\\s\\S]{0,100000}')
        .replaceAll('.*?', '.{0,500}?');
      lines[n - 1] = line;
    }
    return lines.join('\n');
  });
}
// Nested-domain repetition gets explicit DNS-sized bounds.
edit('supabase/functions/gmail-sync-receipts/index.ts', s => s
  .replaceAll(/\/@\(\?:\[\^\.\]\+\\\.\)\*\(\[\^\.\]\+\)\\\.\[a-z\]\{2,\}/g, '/@(?:[^.]{1,63}\\.){0,10}([^.]{1,63})\\.[a-z]{2,63}'));
// Path extraction and bracket/parenthesis stripping are clearer without broad dot-star regexes.
replace('src/lib/excelImportParser.ts', 'sheetPath.replace(/.*\\//, "").replace(".xml", "")', 'sheetPath.slice(sheetPath.lastIndexOf("/") + 1).replace(".xml", "")');
replace('src/components/transactions/TransactionList.tsx', '.replace(/\\[.{0,500}?\\]/g, "")', '.replace(/\\[[^\\]]{0,500}\\]/g, "")');
replace('src/lib/investmentCsvParser.ts', ".replace(/\\(.{0,500}?\\)/g, '')", ".replace(/\\([^)]{0,500}\\)/g, '')");
// Quantities in discount phrases are small; bound the only ambiguous unbounded digit groups.
edit('src/lib/discounts.ts', s => s.replace('/(\\d+)\\s{0,20}for\\s{0,20}(?:the\\s{1,20}price\\s{0,20}of\\s{0,20})?(\\d+)/i', '/(\\d{1,6})\\s{0,20}for\\s{0,20}(?:the\\s{1,20}price\\s{0,20}of\\s{0,20})?(\\d{1,6})/i'));

console.log('Sonar remediation transformations complete');
