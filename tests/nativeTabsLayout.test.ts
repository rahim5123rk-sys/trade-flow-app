import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

test('tabs layout uses the homemade liquid glass tab bar with a centered FAB and bottom-anchored quick-actions menu', () => {
  const tabsLayoutPath = path.join(process.cwd(), 'app/(app)/(tabs)/_layout.tsx');
  const appLayoutPath = path.join(process.cwd(), 'app/(app)/_layout.tsx');
  const navPath = path.join(process.cwd(), 'components/LiquidGlassNav.tsx');

  const tabsSource = fs.readFileSync(tabsLayoutPath, 'utf8');
  const appLayoutSource = fs.readFileSync(appLayoutPath, 'utf8');
  const navSource = fs.readFileSync(navPath, 'utf8');

  assert.match(tabsSource, /import\s+\{\s*Tabs\s*\}\s+from\s+'expo-router'/);
  assert.match(tabsSource, /LiquidGlassTabBar/);
  assert.match(tabsSource, /tabBar=\{\(props\)\s*=>\s*<LiquidGlassTabBar\s+\{\.\.\.props\}\s*\/?>\}/);
  assert.doesNotMatch(tabsSource, /unstable-native-tabs|NativeTabs\.Trigger/);

  assert.match(navSource, /fabSpacer/);
  assert.match(navSource, /<Pressable[\s\S]*onPress=\{\(\) => navigateToIndex\(visibleIdx\)\}/);
  assert.doesNotMatch(navSource, /navSide:/);

  // FAB itself stays centered.
  assert.match(appLayoutSource, /globalFabWrap:\s*\{[\s\S]*left:\s*0,[\s\S]*right:\s*0,[\s\S]*alignItems:\s*'center'/);
  assert.doesNotMatch(appLayoutSource, /globalFabWrap:\s*\{[\s\S]*right:\s*20/);

  // Quick-actions menu sits horizontally inset and anchors to the bottom of the screen.
  assert.match(appLayoutSource, /fabMenuContainer:\s*\{[\s\S]*left:\s*16,[\s\S]*right:\s*16,[\s\S]*justifyContent:\s*'flex-end'/);
  // Each action row is rendered via the new FabMenuItem component (icon chip + title + subtitle).
  assert.match(appLayoutSource, /function FabMenuItem\b/);
  assert.match(appLayoutSource, /fabRowIconChip:/);
  assert.match(appLayoutSource, /fabRowTitle:/);
  assert.match(appLayoutSource, /fabRowSub:/);
});
