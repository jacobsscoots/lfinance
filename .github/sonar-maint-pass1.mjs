import fs from 'node:fs';
import ts from 'typescript';

const issues = JSON.parse(fs.readFileSync('.sonar/maintainability-issues.json', 'utf8'));
const byFile = new Map();
for (const issue of issues) {
  const file = issue.component.split(':', 2)[1];
  if (!byFile.has(file)) byFile.set(file, []);
  byFile.get(file).push(issue);
}

function applyEdits(text, edits) {
  edits.sort((a, b) => b.start - a.start || b.end - a.end);
  let out = text;
  let lastStart = Infinity;
  for (const edit of edits) {
    if (edit.end > lastStart) continue;
    out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
    lastStart = edit.start;
  }
  return out;
}

function lineOf(sf, pos) {
  return sf.getLineAndCharacterOfPosition(pos).line + 1;
}

function fixReadonlyProps(file, text, fileIssues) {
  const targets = fileIssues.filter(i => i.rule === 'typescript:S6759');
  if (!targets.length) return { text, fixed: 0, skipped: 0 };
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const targetLines = new Set(targets.map(i => i.line));
  const edits = [];
  const usedLines = new Set();

  function visit(node) {
    if ((ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)) && node.parameters.length) {
      const startLine = lineOf(sf, node.getStart(sf));
      const endLine = lineOf(sf, node.parameters[0].end);
      for (const targetLine of targetLines) {
        if (targetLine < startLine || targetLine > endLine) continue;
        const p = node.parameters[0];
        if (!ts.isObjectBindingPattern(p.name) || !p.type) continue;
        const typeText = p.type.getText(sf);
        if (/^Readonly\s*</.test(typeText)) {
          usedLines.add(targetLine);
          continue;
        }
        edits.push({ start: p.type.getStart(sf), end: p.type.end, text: `Readonly<${typeText}>` });
        usedLines.add(targetLine);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
  return { text: applyEdits(text, edits), fixed: edits.length, skipped: targets.length - usedLines.size };
}

function fixUnusedImports(file, text, fileIssues) {
  const targets = fileIssues.filter(i => i.rule === 'typescript:S1128');
  if (!targets.length) return { text, fixed: 0, skipped: 0 };
  const names = new Set();
  for (const issue of targets) {
    const m = issue.message.match(/unused import of '([^']+)'/);
    if (m) names.add(m[1]);
  }
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  const edits = [];
  const removed = new Set();

  for (const stmt of sf.statements) {
    if (!ts.isImportDeclaration(stmt) || !stmt.importClause) continue;
    const clause = stmt.importClause;
    let defaultName = clause.name;
    if (defaultName && names.has(defaultName.text)) {
      removed.add(defaultName.text);
      defaultName = undefined;
    }

    let namedBindings = clause.namedBindings;
    if (namedBindings && ts.isNamespaceImport(namedBindings)) {
      if (names.has(namedBindings.name.text)) {
        removed.add(namedBindings.name.text);
        namedBindings = undefined;
      }
    } else if (namedBindings && ts.isNamedImports(namedBindings)) {
      const kept = namedBindings.elements.filter(el => {
        if (names.has(el.name.text)) {
          removed.add(el.name.text);
          return false;
        }
        return true;
      });
      namedBindings = kept.length ? ts.factory.updateNamedImports(namedBindings, kept) : undefined;
    }

    if (defaultName === clause.name && namedBindings === clause.namedBindings) continue;

    if (!defaultName && !namedBindings) {
      let end = stmt.end;
      while (end < text.length && (text[end] === '\r' || text[end] === '\n')) end++;
      edits.push({ start: stmt.getFullStart(), end, text: '' });
      continue;
    }

    const updatedClause = ts.factory.updateImportClause(clause, clause.isTypeOnly, defaultName, namedBindings);
    const updatedDecl = ts.factory.updateImportDeclaration(stmt, stmt.modifiers, updatedClause, stmt.moduleSpecifier, stmt.attributes);
    edits.push({ start: stmt.getStart(sf), end: stmt.end, text: printer.printNode(ts.EmitHint.Unspecified, updatedDecl, sf) });
  }

  return { text: applyEdits(text, edits), fixed: removed.size, skipped: Math.max(0, names.size - removed.size) };
}

let totalFixed = 0;
let totalSkipped = 0;
for (const [file, fileIssues] of byFile) {
  if (!fs.existsSync(file) || (!file.endsWith('.ts') && !file.endsWith('.tsx'))) continue;
  let text = fs.readFileSync(file, 'utf8');
  const a = fixUnusedImports(file, text, fileIssues);
  text = a.text;
  const b = fixReadonlyProps(file, text, fileIssues);
  text = b.text;
  if (a.fixed || b.fixed) fs.writeFileSync(file, text);
  totalFixed += a.fixed + b.fixed;
  totalSkipped += a.skipped + b.skipped;
}

console.log(`Pass 1 fixed ${totalFixed} findings; skipped ${totalSkipped}`);
if (totalSkipped > 0) console.log('Skipped findings will be handled in later targeted passes.');
