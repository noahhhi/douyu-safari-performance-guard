const fs = require('node:fs');
const assert = require('node:assert/strict');
const source = fs.readFileSync('douyu-safari-performance-guard.user.js', 'utf8');
const metadata = source.split('// ==/UserScript==')[0] + '// ==/UserScript==\n';
assert.equal(fs.readFileSync('douyu-safari-performance-guard.meta.js', 'utf8'), metadata);
const version = metadata.match(/^\/\/ @version\s+(\S+)/m)[1];
assert.equal(version, require('../package.json').version);
assert.ok(source.includes(`const version = '${version}'`));
for (const key of ['homepageURL', 'supportURL', 'updateURL', 'downloadURL']) {
  const url = metadata.match(new RegExp('^// @' + key + '\\s+(\\S+)', 'm'))?.[1];
  assert.ok(url?.startsWith('https://github.com/noahhhi/douyu-safari-performance-guard'), key);
}
console.log('Release metadata: passed');
