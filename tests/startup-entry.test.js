const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const packageJson = JSON.parse(
  fs.readFileSync(path.join(root, 'package.json'), 'utf8')
);
const entry = fs.readFileSync(path.join(root, 'index.tsx'), 'utf8');

assert.strictEqual(packageJson.main, 'index.tsx');
assert.ok(entry.includes("import 'react-native-get-random-values';"));
assert.ok(entry.includes("require('expo-router/build/qualified-entry').App"));
assert.ok(entry.includes('registerRootComponent'));
assert.ok(!entry.includes('react-native-compat'));
console.log('Startup entry regression test passed.');
