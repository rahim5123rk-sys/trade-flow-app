import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

test('native tabs layout uses native iOS symbols instead of async vector image icons', () => {
  const layoutPath = path.join(process.cwd(), 'app/(app)/(tabs)/_layout.tsx');
  const source = fs.readFileSync(layoutPath, 'utf8');

  assert.match(source, /sf=\{\{\s*default:\s*'house',\s*selected:\s*'house\.fill'/);
  assert.match(source, /sf=\{\{\s*default:\s*'calendar',\s*selected:\s*'calendar'/);
  assert.match(source, /sf=\{\{\s*default:\s*'doc\.text',\s*selected:\s*'doc\.text\.fill'/);
  assert.match(source, /sf=\{\{\s*default:\s*'briefcase',\s*selected:\s*'briefcase\.fill'/);
  assert.match(source, /androidSrc=\{<VectorIcon family=\{Ionicons\}/);
  assert.doesNotMatch(source, /<Icon src=\{<VectorIcon family=\{Ionicons\}/);
});
