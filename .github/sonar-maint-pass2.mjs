import fs from 'node:fs';
import https from 'node:https';
import ts from 'typescript';

function getJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'lfinance-sonar-remediation' } }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) return reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 500)}`));
        resolve(JSON.parse(body));
      });
    }).on('error', reject);
  });
}

async function fetchIssues() {
  const all = [];
  for (let page = 1; ; page++) {
    const qs = new URLSearchParams({
      componentKeys: 'jacobsscoots_lfinance',
      issueStatuses: 'OPEN,CONFIRMED',
      ps: '500',
      p: String(page),
    });
    const payload = await getJson(`https://sonarcloud.io/api/issues/search?${qs}`);
    all.push(...(payload.issues ?? []));
    if (all.length >= (payload.paging?.total ?? all.length)) break;
  }
  return all;
}

function fileFromIssue(issue) {
  return issue.component?.split(':', 2)[1];
}

function lineOf(sf, pos) {
  return sf.getLineAndCharacterOfPosition(pos).line + 1;
}

function applyEdits(text, edits) {
  edits.sort((a, b) => b.start - a.start || b.end - a.end);
  let out = text;
  let boundary = Infinity;
  let applied = 0;
  for (const e of edits) {
    if (e.end > boundary) continue;
    out = out.slice(0, e.start) + e.text + out.slice(e.end);
    boundary = e.start;
    applied++;
  }
  return { text: out, applied };
}

function fixReadonlyProps(file, text, issues) {
  const targets = issues.filter(i => i.rule === 'typescript:S6759');
  if (!targets.length) return { text, fixed: 0, skipped: 0 };
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const lines = new Set(targets.map(i => i.line));
  const edits = [];
  const handled = new Set();

  function consider(node) {
    if (!(ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)) || node.parameters.length === 0) return;
    const p = node.parameters[0];
    if (!p.type) return;
    const start = lineOf(sf, node.getStart(sf));
    const paramStart = lineOf(sf, p.getStart(sf));
    const paramEnd = lineOf(sf, p.end);
    for (const target of lines) {
      if (target !== start && (target < paramStart || target > paramEnd)) continue;
      const typeText = p.type.getText(sf);
      handled.add(target);
      if (/^Readonly\s*</.test(typeText) || /^ReadonlyArray\s*</.test(typeText)) continue;
      edits.push({ start: p.type.getStart(sf), end: p.type.end, text: `Readonly<${typeText}>` });
    }
  }
  function visit(node) { consider(node); ts.forEachChild(node, visit); }
  visit(sf);
  const result = applyEdits(text, edits);
  return { text: result.text, fixed: result.applied, skipped: targets.length - handled.size };
}

function fixRegExpExec(file, text, issues) {
  const targets = issues.filter(i => i.rule === 'typescript:S6594');
  if (!targets.length) return { text, fixed: 0, skipped: 0 };
  const targetLines = new Set(targets.map(i => i.line));
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const edits = [];
  const handled = new Set();

  function visit(node) {
    if (ts.isCallExpression(node) && node.arguments.length === 1 && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'match') {
      const line = lineOf(sf, node.getStart(sf));
      if (targetLines.has(line)) {
        const receiver = node.expression.expression.getText(sf);
        const regex = node.arguments[0];
        const regexText = regex.getText(sf);
        let safe = true;
        if (ts.isRegularExpressionLiteral(regex)) {
          const lastSlash = regexText.lastIndexOf('/');
          const flags = lastSlash >= 0 ? regexText.slice(lastSlash + 1) : '';
          if (flags.includes('g')) safe = false;
        }
        if (safe) {
          edits.push({ start: node.getStart(sf), end: node.end, text: `${regexText}.exec(${receiver})` });
          handled.add(line);
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
  const result = applyEdits(text, edits);
  return { text: result.text, fixed: result.applied, skipped: targets.length - handled.size };
}

function fixDuplicateImports(file, text, issues) {
  const targets = issues.filter(i => i.rule === 'typescript:S3863');
  if (!targets.length) return { text, fixed: 0, skipped: 0 };
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const imports = sf.statements.filter(ts.isImportDeclaration);
  const byModule = new Map();
  for (const imp of imports) {
    if (!ts.isStringLiteral(imp.moduleSpecifier)) continue;
    const module = imp.moduleSpecifier.text;
    if (!byModule.has(module)) byModule.set(module, []);
    byModule.get(module).push(imp);
  }
  const edits = [];
  let fixed = 0;
  let skipped = 0;

  for (const [module, group] of byModule) {
    if (group.length < 2) continue;
    const related = targets.filter(i => group.some(g => i.line >= lineOf(sf, g.getStart(sf)) && i.line <= lineOf(sf, g.end)));
    if (!related.length) continue;
    const clauses = group.map(g => g.importClause);
    if (clauses.some(c => !c || (c.namedBindings && ts.isNamespaceImport(c.namedBindings)))) {
      skipped += related.length;
      continue;
    }
    // Only merge when declarations are separated by whitespace. This avoids deleting comments or unrelated code.
    let contiguous = true;
    for (let i = 1; i < group.length; i++) {
      const gap = text.slice(group[i - 1].end, group[i].getStart(sf));
      if (!/^\s*$/.test(gap)) { contiguous = false; break; }
    }
    if (!contiguous) { skipped += related.length; continue; }

    let defaultName = null;
    const specs = [];
    let valid = true;
    for (const clause of clauses) {
      if (clause.name) {
        if (defaultName && defaultName !== clause.name.text) { valid = false; break; }
        defaultName = clause.name.text;
      }
      if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        for (const el of clause.namedBindings.elements) {
          specs.push({
            imported: el.propertyName?.text ?? el.name.text,
            local: el.name.text,
            typeOnly: clause.isTypeOnly || el.isTypeOnly,
          });
        }
      }
    }
    if (!valid) { skipped += related.length; continue; }

    const seen = new Set();
    const unique = specs.filter(s => {
      const key = `${s.imported}|${s.local}|${s.typeOnly}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const allTypeOnly = !defaultName && unique.length > 0 && unique.every(s => s.typeOnly);
    const named = unique.map(s => {
      const alias = s.imported === s.local ? s.local : `${s.imported} as ${s.local}`;
      return `${!allTypeOnly && s.typeOnly ? 'type ' : ''}${alias}`;
    }).join(', ');
    let clauseText = '';
    if (defaultName) clauseText += defaultName;
    if (named) clauseText += `${defaultName ? ', ' : ''}{ ${named} }`;
    if (!clauseText) { skipped += related.length; continue; }
    const replacement = `import ${allTypeOnly ? 'type ' : ''}${clauseText} from ${JSON.stringify(module)};`;
    edits.push({ start: group[0].getStart(sf), end: group[group.length - 1].end, text: replacement });
    fixed += related.length;
  }

  const result = applyEdits(text, edits);
  return { text: result.text, fixed, skipped };
}

const allIssues = await fetchIssues();
const wanted = new Set(['typescript:S6759', 'typescript:S6594', 'typescript:S3863']);
const relevant = allIssues.filter(i => wanted.has(i.rule));
const byFile = new Map();
for (const issue of relevant) {
  const file = fileFromIssue(issue);
  if (!file) continue;
  if (!byFile.has(file)) byFile.set(file, []);
  byFile.get(file).push(issue);
}

const stats = { totalOpen: allIssues.length, targeted: relevant.length, fixed: 0, skipped: 0, byRule: {} };
for (const issue of relevant) stats.byRule[issue.rule] = (stats.byRule[issue.rule] ?? 0) + 1;

for (const [file, issues] of byFile) {
  if (!fs.existsSync(file) || (!file.endsWith('.ts') && !file.endsWith('.tsx'))) { stats.skipped += issues.length; continue; }
  let text = fs.readFileSync(file, 'utf8');
  for (const fixer of [fixDuplicateImports, fixRegExpExec, fixReadonlyProps]) {
    const r = fixer(file, text, issues);
    text = r.text;
    stats.fixed += r.fixed;
    stats.skipped += r.skipped;
  }
  fs.writeFileSync(file, text);
}

console.log(JSON.stringify(stats, null, 2));
