const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const packageJson = JSON.parse(
  fs.readFileSync(path.join(root, 'package.json'), 'utf8')
);
const entry = fs.readFileSync(path.join(root, 'index.ts'), 'utf8');

assert.strictEqual(packageJson.main, 'index.ts');
assert.ok(entry.includes("import 'react-native-get-random-values';"));
assert.ok(entry.includes("import '@walletconnect/react-native-compat';"));
assert.ok(entry.includes("import 'expo-router/entry';"));
assert.ok(
  entry.indexOf("import 'expo-router/entry';") >
    entry.indexOf("import '@walletconnect/react-native-compat';")
);
console.log('Startup entry regression test passed.');
