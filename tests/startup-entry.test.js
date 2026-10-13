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

// The real entry is expo-router/entry, so the root layout must carry the
// startup hardening: crypto polyfill, error boundary, and splash failsafe.
const layout = fs.readFileSync(
  path.join(root, 'src', 'app', '_layout.tsx'),
  'utf8'
);
assert.ok(
  layout.includes("import 'react-native-get-random-values';"),
  'root layout must load the get-random-values polyfill (index.tsx is not the entry)'
);
assert.ok(
  layout.includes('StartupErrorBoundary'),
  'root layout must render an error boundary so render failures show recovery UI'
);
assert.ok(
  layout.includes('failsafe') || layout.includes('6000'),
  'root layout must force-hide the splash after a timeout so it can never trap the user'
);

// No route may statically import the optional WalletConnect SDK: it must only
// ever be resolved with a guarded dynamic require after startup.
function listFiles(dir, out = []) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    if (name.name === 'node_modules' || name.name === '.git') continue;
    const full = path.join(dir, name.name);
    if (name.isDirectory()) listFiles(full, out);
    else if (/\.(tsx?|jsx?)$/.test(name.name)) out.push(full);
  }
  return out;
}
const staticWalletImporters = listFiles(path.join(root, 'src')).filter((file) => {
  const text = fs.readFileSync(file, 'utf8');
  return /^import\s+[^;]*@walletconnect\/modal-react-native/m.test(text);
});
assert.deepStrictEqual(
  staticWalletImporters,
  [],
  `static WalletConnect imports break startup and must stay lazy: ${staticWalletImporters.join(', ')}`
);
console.log('Startup entry regression test passed.');
