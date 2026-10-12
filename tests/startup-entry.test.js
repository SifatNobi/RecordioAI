const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const packageJson = JSON.parse(
  fs.readFileSync(path.join(root, 'package.json'), 'utf8')
);
assert.strictEqual(packageJson.main, 'expo-router/entry');
if (fs.existsSync(path.join(root, 'index.tsx'))) {
  const entry = fs.readFileSync(path.join(root, 'index.tsx'), 'utf8');
  assert.ok(entry.includes("import 'react-native-get-random-values';"));
  assert.ok(entry.includes("from 'expo-router/build/qualified-entry'"));
  assert.ok(entry.includes("from 'expo-router/build/renderRootComponent'"));
  assert.ok(entry.includes('renderRootComponent(StartupApp)'));
  assert.ok(!entry.includes('react-native-compat'));
}
console.log('Startup entry regression test passed.');
