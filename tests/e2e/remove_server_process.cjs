const fs = require('fs');
const path = require('path');
const dir = '/home/jhonny/TCC/document-editor/tests/e2e';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.cjs')).map(f => path.join(dir, f));

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/const { spawn } = require\('child_process'\);\s*(const|let) serverProcess.*\}\);/s, '');
  content = content.replace(/let serverProcess;\s*await new Promise[\s\S]*?\}\);/s, '');
  content = content.replace(/if\s*\(serverProcess\)\s*\{?\s*serverProcess\.kill\(\);\s*\}?/g, '');
  fs.writeFileSync(file, content, 'utf8');
}
console.log('Removed serverProcess logic from all files.');
