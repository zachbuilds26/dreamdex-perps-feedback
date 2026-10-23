const fs = require('fs');
const { keccak256, toUtf8Bytes } = require('ethers');

const src = fs.readFileSync('node_modules/@somnia-chain/markets-sdk/src/contractErrorsAbi.ts', 'utf8');
const entries = [...src.matchAll(/\{ type: "error", name: "([^"]+)", inputs: \[(.*?)\] \}/g)];
const targets = process.argv.slice(2).map(s => s.toLowerCase());
if (!targets.length) { console.log('usage: node find-error.js 0x........'); process.exit(1); }

const found = new Map();
for (const [, name, inputsRaw] of entries) {
  const types = [...inputsRaw.matchAll(/\{ name: "[^"]*", type: "([^"]+)" \}/g)].map(m => m[1]);
  const sig = `${name}(${types.join(',')})`;
  const sel = keccak256(toUtf8Bytes(sig)).slice(0, 10).toLowerCase();
  if (targets.includes(sel)) found.set(sel, (found.get(sel) || []).concat(sig));
}
console.log('table entries:', entries.length);
for (const t of targets) console.log(t, '=>', found.get(t) || 'NOT IN SDK ERROR TABLE');
