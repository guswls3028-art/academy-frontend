const fs = require('fs');
const path = require('path');
const p = path.join(process.cwd(), 'node_modules/.pnpm/@babel+parser@7.29.0/node_modules/@babel/parser/lib/index.js');
let s = fs.readFileSync(p, 'utf8');
const marker = "'use strict';";
const start = s.indexOf(marker);
if (start === -1) {
  console.error('Marker not found');
  process.exit(1);
}
fs.writeFileSync(p, s.slice(start));
console.log('Fixed: removed', start, 'bytes from @babel/parser lib/index.js');
