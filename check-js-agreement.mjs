// Checks dashboard/app.js agrees with board.json: extract impliedOf/farmSteps and their
// helpers from app.js by brace matching, run them in isolation, compare every row.
// Usage: node check-js-agreement.mjs [out_dir]   (default: out)
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const out = process.argv[2] ?? 'out';
const appJs = readFileSync('dashboard/app.js', 'utf8');

function extract(src, name) {
  const start = src.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`function ${name} not found in app.js`);
  let i = src.indexOf('{', start);
  let depth = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') {
      depth--;
      if (depth === 0) return src.slice(start, j + 1);
    }
  }
  throw new Error(`unbalanced braces in ${name}`);
}

const names = ['round4', 'baseOf', 'multipliers', 'impliedOf', 'chainOf', 'capitalFor', 'holdDaysFor', 'actionFor', 'categoryAction', 'stepText', 'farmSteps'];
const fns = names.map((n) => extract(appJs, n)).join('\n');
const sandbox = new Function(`${fns}\nreturn { impliedOf, farmSteps };`)();

const board = JSON.parse(readFileSync(join(out, 'board.json'), 'utf8')).rows;
const dataJs = readFileSync(join(out, 'data.js'), 'utf8');
const windowObj = {};
new Function('window', dataJs)(windowObj);
const radar = windowObj.RADAR;

let badImplied = 0;
let badSteps = 0;
for (const row of board) {
  const dashRow = radar.rows.find((r) => r.slug === row.slug);
  if (!dashRow) { console.log('MISSING in data.js:', row.slug); badImplied++; continue; }
  if (sandbox.impliedOf(dashRow, radar.model) !== row.implied_value_usd) {
    if (badImplied < 3) console.log('IMPLIED MISMATCH:', row.slug, sandbox.impliedOf(dashRow, radar.model), 'vs', row.implied_value_usd);
    badImplied++;
  }
  const steps = sandbox.farmSteps(dashRow);
  if (JSON.stringify(steps) !== JSON.stringify(row.farm_steps)) {
    if (badSteps < 3) {
      console.log('STEPS MISMATCH:', row.slug);
      steps.forEach((s, i) => { if (s !== row.farm_steps[i]) console.log('  js :', s, '\n  ts :', row.farm_steps[i]); });
    }
    badSteps++;
  }
}
console.log(`rows checked: ${board.length}, implied mismatches: ${badImplied}, farm-step mismatches: ${badSteps}`);
process.exit(badImplied || badSteps ? 1 : 0);
