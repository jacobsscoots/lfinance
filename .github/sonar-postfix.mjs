import fs from 'node:fs';

const file = 'src/lib/portioningEngine.ts';
let s = fs.readFileSync(file, 'utf8');

s = s.replace(
  'const shuffled = [...adjustableItems].sort(() => secureRandom() - 0.5);',
  'const shuffled = [...adjustableItems].sort((a, b) => deterministicUnit(`${iter}:${a.id}:shuffle`) - deterministicUnit(`${iter}:${b.id}:shuffle`) || a.id.localeCompare(b.id));'
);
s = s.replace(
  'const pertDelta = (secureRandom() > 0.5 ? 1 : -1) * Math.round(secureRandom() * 20 + 5);',
  'const pertDelta = (deterministicUnit(`${iter}:${pi}:${f.id}:sign`) > 0.5 ? 1 : -1) * Math.round(deterministicUnit(`${iter}:${pi}:${f.id}:magnitude`) * 20 + 5);'
);
s = s.replace(
  'randomStart1.set(item.id, clampToConstraints(item.minPortionGrams + Math.round(secureRandom() * range), item));',
  'randomStart1.set(item.id, clampToConstraints(item.minPortionGrams + Math.round(deterministicUnit(`start1:${item.id}:${targets.calories}:${targets.protein}:${targets.carbs}:${targets.fat}`) * range), item));'
);
s = s.replace(
  'randomStart2.set(item.id, clampToConstraints(item.minPortionGrams + Math.round(secureRandom() * range), item));',
  'randomStart2.set(item.id, clampToConstraints(item.minPortionGrams + Math.round(deterministicUnit(`start2:${item.id}:${targets.calories}:${targets.protein}:${targets.carbs}:${targets.fat}`) * range), item));'
);

s = s.replace(/\n\nfunction secureRandom\(\): number \{\n  const values = new Uint32Array\(1\);\n  globalThis\.crypto\.getRandomValues\(values\);\n  return values\[0\] \/ 0x1_0000_0000;\n\}\n?$/, '');
if (!s.includes('function deterministicUnit(seed: string)')) {
  s += `\n\nfunction deterministicUnit(seed: string): number {\n  let hash = 2166136261;\n  for (let i = 0; i < seed.length; i++) {\n    hash ^= seed.codePointAt(i) ?? 0;\n    hash = Math.imul(hash, 16777619);\n  }\n  return (hash >>> 0) / 0x1_0000_0000;\n}\n`;
}
fs.writeFileSync(file, s);

for (const [p, transform] of [
  ['src/components/transactions/TransactionList.tsx', line => line.replace('.{0,500}?', '[^\\]]{0,500}')],
  ['src/lib/investmentCsvParser.ts', line => line.replace('.{0,500}?', '[^)]{0,500}')],
]) {
  let text = fs.readFileSync(p, 'utf8');
  const lines = text.split('\n');
  const target = p.includes('TransactionList') ? 233 : 122;
  lines[target - 1] = transform(lines[target - 1]);
  fs.writeFileSync(p, lines.join('\n'));
}

console.log('Deterministic solver and residual regex fixes applied');
