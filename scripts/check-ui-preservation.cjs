/* Compare ASTs after removing only the approved presentation changes.
   Usage: node scripts/check-ui-preservation.cjs <base-commit> */
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { parse } = require('@babel/parser');
const base = process.argv[2] || '4c8cac08543953f19b8cf19f62f6f28972d91ff5';
const files = execFileSync('git', ['diff', '--name-only', base, '--', 'src'], { encoding: 'utf8' }).trim().split('\n').filter(f => /\.(jsx|js)$/.test(f));
function clean(node) {
  if (Array.isArray(node)) return node.map(clean).filter(v => v !== undefined);
  if (!node || typeof node !== 'object') return node;
  if (node.type === 'ImportDeclaration' && (node.source.value.includes('/UI/PageHeader') || node.source.value.endsWith('/enterprise.css'))) return undefined;
  if (node.type === 'JSXAttribute' && node.name.name === 'className') return undefined;
  if (node.type === 'JSXIdentifier' && node.name === 'PageHeader') return { type: 'JSXIdentifier', name: 'div' };
  const result = {};
  for (const [key, value] of Object.entries(node)) {
    if (['start', 'end', 'loc', 'extra', 'leadingComments', 'trailingComments', 'innerComments', 'comments', 'tokens'].includes(key)) continue;
    result[key] = clean(value);
  }
  return result;
}
let checked = 0;
for (const file of files) {
  let original;
  try { original = execFileSync('git', ['show', `${base}:${file}`], { encoding: 'utf8', stdio: ['ignore','pipe','ignore'] }); } catch { continue; }
  const opts = { sourceType: 'module', plugins: ['jsx'] };
  if (JSON.stringify(clean(parse(original, opts))) !== JSON.stringify(clean(parse(fs.readFileSync(file, 'utf8'), opts)))) {
    throw new Error(`Non-presentation change detected: ${file}`);
  }
  checked++;
}
console.log(`PASS: ${checked} existing source files retain all non-presentation AST nodes (handlers, hooks, APIs, payloads, calculations, validation, routing and JSX conditions).`);
