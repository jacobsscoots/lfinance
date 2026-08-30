import fs from 'node:fs';
import https from 'node:https';
import ts from 'typescript';

const TARGET_RULES = new Set([
  'typescript:S3863','typescript:S7776','typescript:S7754','typescript:S6353',
  'typescript:S5906','typescript:S6582','typescript:S6535'
]);

function getJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'lfinance-sonar-remediation' } }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', c => body += c);
      res.on('end', () => res.statusCode >= 200 && res.statusCode < 300 ? resolve(JSON.parse(body)) : reject(new Error(`HTTP ${res.statusCode}`)));
    }).on('error', reject);
  });
}

async function fetchIssues() {
  const out=[];
  for (let p=1;;p++) {
    const q=new URLSearchParams({componentKeys:'jacobsscoots_lfinance',issueStatuses:'OPEN,CONFIRMED',ps:'500',p:String(p)});
    const d=await getJson(`https://sonarcloud.io/api/issues/search?${q}`);
    out.push(...(d.issues??[]));
    if (out.length >= (d.paging?.total ?? out.length)) break;
  }
  return out;
}

function sourceFile(file,text){return ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);}
function lineOf(sf,pos){return sf.getLineAndCharacterOfPosition(pos).line+1;}
function applyEdits(text,edits){
  edits.sort((a,b)=>b.start-a.start||b.end-a.end);
  let out=text,boundary=Infinity,applied=0;
  for(const e of edits){if(e.end>boundary)continue;out=out.slice(0,e.start)+e.text+out.slice(e.end);boundary=e.start;applied++;}
  return {text:out,applied};
}

function fixDuplicateImports(file,text,issues){
  const targets=issues.filter(i=>i.rule==='typescript:S3863');
  if(!targets.length)return {text,fixed:0,skipped:0};
  const sf=sourceFile(file,text); const imports=sf.statements.filter(ts.isImportDeclaration); const by=new Map();
  for(const imp of imports){if(!ts.isStringLiteral(imp.moduleSpecifier))continue;const m=imp.moduleSpecifier.text;if(!by.has(m))by.set(m,[]);by.get(m).push(imp);}
  const edits=[];let fixed=0,skipped=0;
  for(const [module,group] of by){
    if(group.length<2)continue;
    const related=targets.filter(i=>group.some(g=>i.line>=lineOf(sf,g.getStart(sf))&&i.line<=lineOf(sf,g.end)));
    if(!related.length)continue;
    const clauses=group.map(g=>g.importClause);
    if(clauses.some(c=>!c||(c.namedBindings&&ts.isNamespaceImport(c.namedBindings)))){skipped+=related.length;continue;}
    let defaultName=null,valid=true;const specs=[];
    for(const c of clauses){
      if(c.name){if(defaultName&&defaultName!==c.name.text){valid=false;break;}defaultName=c.name.text;}
      if(c.namedBindings&&ts.isNamedImports(c.namedBindings))for(const el of c.namedBindings.elements)specs.push({imported:el.propertyName?.text??el.name.text,local:el.name.text,typeOnly:c.isTypeOnly||el.isTypeOnly});
    }
    if(!valid){skipped+=related.length;continue;}
    const seen=new Set();const uniq=specs.filter(s=>{const k=`${s.imported}|${s.local}|${s.typeOnly}`;if(seen.has(k))return false;seen.add(k);return true;});
    const allType=!defaultName&&uniq.length>0&&uniq.every(s=>s.typeOnly);
    const named=uniq.map(s=>`${!allType&&s.typeOnly?'type ':''}${s.imported===s.local?s.local:`${s.imported} as ${s.local}`}`).join(', ');
    let clause='';if(defaultName)clause+=defaultName;if(named)clause+=`${defaultName?', ':''}{ ${named} }`;
    if(!clause){skipped+=related.length;continue;}
    edits.push({start:group[0].getStart(sf),end:group[0].end,text:`import ${allType?'type ':''}${clause} from ${JSON.stringify(module)};`});
    for(const imp of group.slice(1))edits.push({start:imp.getStart(sf),end:imp.end,text:''});
    fixed+=related.length;
  }
  const r=applyEdits(text,edits);return {text:r.text,fixed,skipped};
}

function fixSets(file,text,issues){
  const targets=issues.filter(i=>i.rule==='typescript:S7776');if(!targets.length)return {text,fixed:0,skipped:0};
  let out=text,fixed=0,skipped=0;
  for(const issue of targets){
    const m=issue.message.match(/`([^`]+)` should be a `Set`/);if(!m){skipped++;continue;}const name=m[1];
    const sf=sourceFile(file,out);let decl=null;
    function visit(n){if(ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name)&&n.name.text===name&&n.initializer&&ts.isArrayLiteralExpression(n.initializer))decl=n;ts.forEachChild(n,visit);}visit(sf);
    if(!decl){skipped++;continue;}
    const edits=[{start:decl.initializer.getStart(sf),end:decl.initializer.end,text:`new Set(${decl.initializer.getText(sf)})`}];
    if(decl.type){const t=decl.type.getText(sf);let nt=null;const arr=t.match(/^(.+)\[\]$/);const gen=t.match(/^Array<(.+)>$/);if(arr)nt=`ReadonlySet<${arr[1]}>`;else if(gen)nt=`ReadonlySet<${gen[1]}>`;if(nt)edits.push({start:decl.type.getStart(sf),end:decl.type.end,text:nt});}
    const first=applyEdits(out,edits);out=first.text;
    out=out.replaceAll(`${name}.includes(`,`${name}.has(`);
    fixed++;
  }
  return {text:out,fixed,skipped};
}

function fixSome(file,text,issues){
  const targets=issues.filter(i=>i.rule==='typescript:S7754');if(!targets.length)return {text,fixed:0,skipped:0};
  const sf=sourceFile(file,text),lines=new Set(targets.map(i=>i.line)),edits=[];const handled=new Set();
  function visit(n){
    if(ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)&&n.expression.name.text==='find'&&lines.has(lineOf(sf,n.getStart(sf)))){
      edits.push({start:n.expression.name.getStart(sf),end:n.expression.name.end,text:'some'});handled.add(lineOf(sf,n.getStart(sf)));
    }
    if(ts.isBinaryExpression(n)&&n.operatorToken.kind===ts.SyntaxKind.GreaterThanToken&&n.right.getText(sf)==='0'&&ts.isPropertyAccessExpression(n.left)&&n.left.name.text==='length'&&ts.isCallExpression(n.left.expression)&&ts.isPropertyAccessExpression(n.left.expression.expression)&&n.left.expression.expression.name.text==='filter'){
      const line=lineOf(sf,n.getStart(sf));if(lines.has(line)){const fc=n.left.expression;const recv=fc.expression.expression.getText(sf);const args=fc.arguments.map(a=>a.getText(sf)).join(', ');edits.push({start:n.getStart(sf),end:n.end,text:`${recv}.some(${args})`});handled.add(line);}
    }
    ts.forEachChild(n,visit);
  }visit(sf);const r=applyEdits(text,edits);return {text:r.text,fixed:r.applied,skipped:targets.length-handled.size};
}

function fixLineRules(text,issues){
  const lines=text.split(/\r?\n/);let fixed=0,skipped=0;
  const grouped=new Map();for(const i of issues){if(!grouped.has(i.line))grouped.set(i.line,[]);grouped.get(i.line).push(i);}
  for(const [lineNo,items] of grouped){
    let line=lines[lineNo-1];if(line===undefined){skipped+=items.length;continue;}const before=line;
    if(items.some(i=>i.rule==='typescript:S6353')) line=line.replaceAll('[0-9]','\\d');
    if(items.some(i=>i.rule==='typescript:S5906')) line=line.replace(/expect\((.+?)\.length\)\.toBe\((.+?)\)/,'expect($1).toHaveLength($2)');
    if(items.some(i=>i.rule==='typescript:S6535')){
      line=line.replaceAll('[\\/\\-.]','[/.-]').replaceAll('[\\/\\-]','[/-]');
      line=line.replaceAll('[\\(\\[]?','(?:\\(|\\[)?').replaceAll('[\\)\\]]?','(?:\\)|\\])?');
    }
    if(items.some(i=>i.rule==='typescript:S6582')){
      line=line.replace(/!([A-Za-z_$][\w$]*) \|\| !\1\.([A-Za-z_$][\w$]*) \|\| \1\.\2\.length === 0/g,(_,a,b)=>`!${a}?.${b}?.length`);
      line=line.replace(/!([A-Za-z_$][\w$]*) \|\| \1\.([A-Za-z_$][\w$]*) !==/g,(_,a,b)=>`${a}?.${b} !==`);
      line=line.replace(/\b([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?) && \1\.([A-Za-z_$][\w$]*)/g,'$1?.$2');
      line=line.replace(/\b([A-Za-z_$][\w$]*) && \1\[/g,'$1?.[');
    }
    if(line!==before){lines[lineNo-1]=line;fixed+=items.filter(i=>['typescript:S6353','typescript:S5906','typescript:S6535','typescript:S6582'].includes(i.rule)).length;}else skipped+=items.filter(i=>['typescript:S6353','typescript:S5906','typescript:S6535','typescript:S6582'].includes(i.rule)).length;
  }
  return {text:lines.join('\n')+(text.endsWith('\n')?'\n':''),fixed,skipped};
}

const all=await fetchIssues();const relevant=all.filter(i=>TARGET_RULES.has(i.rule));const byFile=new Map();
for(const i of relevant){const f=i.component.split(':',2)[1];if(!byFile.has(f))byFile.set(f,[]);byFile.get(f).push(i);}
const stats={totalOpen:all.length,targeted:relevant.length,fixed:0,skipped:0,byRule:{}};for(const i of relevant)stats.byRule[i.rule]=(stats.byRule[i.rule]??0)+1;
for(const [file,issues] of byFile){if(!fs.existsSync(file)){stats.skipped+=issues.length;continue;}let text=fs.readFileSync(file,'utf8');for(const fixer of [fixDuplicateImports,fixSets,fixSome]){const r=fixer(file,text,issues);text=r.text;stats.fixed+=r.fixed;stats.skipped+=r.skipped;}const lr=fixLineRules(text,issues);text=lr.text;stats.fixed+=lr.fixed;stats.skipped+=lr.skipped;fs.writeFileSync(file,text);}
console.log(JSON.stringify(stats,null,2));
