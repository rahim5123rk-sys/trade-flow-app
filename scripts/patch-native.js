/**
 * Patches react-native-bottom-tabs RepresentableView.swift to fix touch handling.
 *
 * Root cause: Each React Native tab screen is wrapped in a plain UIView via
 * SwiftUI's UIViewRepresentable. The RN view is added as a subview but with
 * NO frame constraints or autoresizing mask. When SwiftUI sizes the wrapper
 * to fill the tab content area, the RN view inside keeps its original frame.
 * iOS hit-testing uses the view's frame, so touches visually land on screen
 * but resolve to "outside" the RN view — onPress never fires.
 *
 * Fix: Set autoresizingMask so the RN view resizes with its wrapper, and
 * explicitly sync the frame in updateUIView.
 */
const fs = require('fs');
const path = require('path');

// ── Patch 1: react-native-bottom-tabs RepresentableView.swift ──
const rvPath = path.join(
  __dirname,
  '../node_modules/react-native-bottom-tabs/ios/RepresentableView.swift'
);

if (fs.existsSync(rvPath)) {
  let content = fs.readFileSync(rvPath, 'utf8');

  const OLD_MAKE = `  func makeUIView(context: Context) -> PlatformView {
    let wrapper = UIView()
    wrapper.addSubview(view)
    return wrapper
  }

  func updateUIView(_ uiView: PlatformView, context: Context) {}`;

  const NEW_MAKE = `  func makeUIView(context: Context) -> PlatformView {
    let wrapper = UIView()
    view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    wrapper.addSubview(view)
    return wrapper
  }

  func updateUIView(_ uiView: PlatformView, context: Context) {
    if let child = uiView.subviews.first {
      child.frame = uiView.bounds
    }
  }`;

  if (content.includes(OLD_MAKE)) {
    content = content.replace(OLD_MAKE, NEW_MAKE);
    fs.writeFileSync(rvPath, content, 'utf8');
    console.log('[patch-native] ✅ Patched RepresentableView.swift (touch handling fix)');
  } else if (content.includes('autoresizingMask')) {
    console.log('[patch-native] ✅ RepresentableView.swift already patched, skipping');
  } else {
    console.warn('[patch-native] ⚠️  RepresentableView.swift — could not find patch target');
  }
} else {
  console.log('[patch-native] RepresentableView.swift not found, skipping');
}
