// ============================================
// FILE: components/RichTextLineInput.tsx
// Rich text editor for invoice/quote line items
// Uses WebView contentEditable for WYSIWYG formatting
// ============================================

import {Ionicons} from '@expo/vector-icons';
import React, {useCallback, useEffect, useImperativeHandle, useRef, useState} from 'react';
import {
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {WebView, WebViewMessageEvent} from 'react-native-webview';

// ─── Constants ──────────────────────────────────────────────
const COLLAPSED_HEIGHT = 48;
const MIN_EXPANDED_HEIGHT = 120;
const MAX_EXPANDED_HEIGHT = 300;
const TOOLBAR_HEIGHT = 44;

// ─── Types ──────────────────────────────────────────────────
interface RichTextLineInputProps {
  value: string; // HTML string
  onChangeText: (html: string) => void;
  placeholder?: string;
  isFocused: boolean;
  onFocus: () => void;
  onBlur: () => void;
  isDark?: boolean;
  theme?: any;
}

export interface RichTextLineInputRef {
  blur: () => void;
}

// ─── HTML Template ──────────────────────────────────────────
function buildEditorHtml(isDark: boolean): string {
  const textColor = isDark ? '#F1F5F9' : '#0F172A';
  const bgColor = isDark ? '#1E293B' : '#FFFFFF';
  const placeholderColor = isDark ? '#64748B' : '#94A3B8';
  const listColor = isDark ? '#94A3B8' : '#64748B';

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    height: 100%;
    background: ${bgColor};
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 15px;
    line-height: 1.5;
    color: ${textColor};
    -webkit-text-size-adjust: 100%;
  }
  #editor {
    min-height: 100%;
    padding: 10px 12px;
    outline: none;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }
  #editor:empty:before {
    content: attr(data-placeholder);
    color: ${placeholderColor};
    pointer-events: none;
  }
  #editor ul, #editor ol {
    padding-left: 24px;
    margin: 4px 0;
  }
  #editor li {
    color: ${textColor};
    margin-bottom: 2px;
  }
  #editor li::marker {
    color: ${listColor};
  }
  #editor b, #editor strong { font-weight: 700; }
  #editor i, #editor em { font-style: italic; }
  #editor u { text-decoration: underline; }
  .indent-1 { margin-left: 24px; }
  .indent-2 { margin-left: 48px; }
  .indent-3 { margin-left: 72px; }
</style>
</head>
<body>
<div id="editor" contenteditable="true" data-placeholder="Description"></div>
<script>
  var editor = document.getElementById('editor');
  var debounceTimer = null;
  
  function sendContent() {
    var html = editor.innerHTML;
    // Treat just <br> or empty content as empty
    if (html === '<br>' || html === '<div><br></div>') html = '';
    // Clean trailing &nbsp; entities
    html = html.replace(/(&nbsp;\\s*)+$/g, '').replace(/(&nbsp;)+<\\/div>/g, '</div>').replace(/(&nbsp;)+<\\/p>/g, '</p>');
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'content',
      html: html
    }));
  }
  
  function sendHeight() {
    var h = Math.max(editor.scrollHeight + 20, 60);
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'height',
      height: h
    }));
  }

  editor.addEventListener('input', function() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function() {
      sendContent();
      sendHeight();
    }, 150);
  });

  editor.addEventListener('focus', function() {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'focus' }));
    setTimeout(sendHeight, 50);
  });

  editor.addEventListener('blur', function() {
    sendContent();
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'blur' }));
  });

  // Receive commands from RN
  window.addEventListener('message', function(e) {
    handleMessage(e);
  });
  document.addEventListener('message', function(e) {
    handleMessage(e);
  });

  function handleMessage(e) {
    try {
      var msg = JSON.parse(e.data);
      if (msg.type === 'command') {
        document.execCommand(msg.command, false, msg.value || null);
        sendContent();
        sendHeight();
      } else if (msg.type === 'setContent') {
        editor.innerHTML = msg.html || '';
        sendHeight();
      } else if (msg.type === 'focus') {
        editor.focus();
      } else if (msg.type === 'blur') {
        editor.blur();
      } else if (msg.type === 'getState') {
        // Report current formatting state
        var state = {
          type: 'formatState',
          bold: document.queryCommandState('bold'),
          italic: document.queryCommandState('italic'),
          underline: document.queryCommandState('underline'),
          unorderedList: document.queryCommandState('insertUnorderedList'),
        };
        window.ReactNativeWebView.postMessage(JSON.stringify(state));
      } else if (msg.type === 'indent') {
        document.execCommand('indent', false, null);
        sendContent();
      } else if (msg.type === 'outdent') {
        document.execCommand('outdent', false, null);
        sendContent();
      }
    } catch(err) {}
  }

  // Initial height report
  setTimeout(sendHeight, 100);
</script>
</body>
</html>`;
}

// ─── Strip HTML for preview ─────────────────────────────────
export function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(div|p|li|ul|ol)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ─── Toolbar Button ─────────────────────────────────────────
function ToolbarButton({
  icon,
  active,
  onPress,
  isDark,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  active?: boolean;
  onPress: () => void;
  isDark: boolean;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.toolbarBtn,
        active && styles.toolbarBtnActive,
        isDark && !active && {backgroundColor: 'rgba(255,255,255,0.08)'},
      ]}
      onPress={onPress}
      activeOpacity={0.6}
    >
      <Ionicons
        name={icon}
        size={18}
        color={active ? '#FFFFFF' : isDark ? '#94A3B8' : '#475569'}
      />
    </TouchableOpacity>
  );
}

// ─── Component ──────────────────────────────────────────────
const RichTextLineInput = React.forwardRef<RichTextLineInputRef, RichTextLineInputProps>(
  ({value, onChangeText, placeholder, isFocused, onFocus, onBlur, isDark = false, theme}, ref) => {
    const webViewRef = useRef<WebView>(null);
    const [contentHeight, setContentHeight] = useState(60);
    const [formatState, setFormatState] = useState({
      bold: false,
      italic: false,
      underline: false,
      unorderedList: false,
    });
    const heightAnim = useSharedValue(COLLAPSED_HEIGHT);
    const initialValueSet = useRef(false);
    const lastValueRef = useRef(value);

    useImperativeHandle(ref, () => ({
      blur: () => {
        webViewRef.current?.injectJavaScript(`document.getElementById('editor').blur(); true;`);
      },
    }));

    // Set initial content once WebView loads
    const handleLoad = useCallback(() => {
      if (value && !initialValueSet.current) {
        initialValueSet.current = true;
        const escaped = value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
        webViewRef.current?.injectJavaScript(
          `window.postMessage(JSON.stringify({ type: 'setContent', html: '${escaped}' })); true;`
        );
      }
    }, [value]);

    // Update content if value changes externally
    useEffect(() => {
      if (initialValueSet.current && value !== lastValueRef.current) {
        lastValueRef.current = value;
        const escaped = value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
        webViewRef.current?.injectJavaScript(
          `window.postMessage(JSON.stringify({ type: 'setContent', html: '${escaped}' })); true;`
        );
      }
    }, [value]);

    // Animate height based on focus state
    useEffect(() => {
      if (isFocused) {
        // Use a fixed expanded height — content scrolls inside the WebView
        heightAnim.value = withTiming(MIN_EXPANDED_HEIGHT + TOOLBAR_HEIGHT, {duration: 250});
      } else {
        heightAnim.value = withTiming(COLLAPSED_HEIGHT, {duration: 200});
      }
    }, [isFocused, heightAnim]);

    const animatedContainerStyle = useAnimatedStyle(() => ({
      height: heightAnim.value,
    }));

    const handleMessage = useCallback((event: WebViewMessageEvent) => {
      try {
        const msg = JSON.parse(event.nativeEvent.data);
        if (msg.type === 'content') {
          lastValueRef.current = msg.html;
          onChangeText(msg.html);
        } else if (msg.type === 'height') {
          setContentHeight(msg.height);
        } else if (msg.type === 'focus') {
          onFocus();
          // Query current format state
          webViewRef.current?.injectJavaScript(
            `window.postMessage(JSON.stringify({ type: 'getState' })); true;`
          );
        } else if (msg.type === 'blur') {
          onBlur();
        } else if (msg.type === 'formatState') {
          setFormatState({
            bold: msg.bold,
            italic: msg.italic,
            underline: msg.underline,
            unorderedList: msg.unorderedList,
          });
        }
      } catch { /* ignore */}
    }, [onChangeText, onFocus, onBlur]);

    const execCommand = useCallback((command: string) => {
      webViewRef.current?.injectJavaScript(
        `window.postMessage(JSON.stringify({ type: 'command', command: '${command}' })); true;`
      );
      // Update state after a tick
      setTimeout(() => {
        webViewRef.current?.injectJavaScript(
          `window.postMessage(JSON.stringify({ type: 'getState' })); true;`
        );
      }, 100);
    }, []);

    const handleIndent = useCallback(() => {
      webViewRef.current?.injectJavaScript(
        `window.postMessage(JSON.stringify({ type: 'indent' })); true;`
      );
    }, []);

    const handleOutdent = useCallback(() => {
      webViewRef.current?.injectJavaScript(
        `window.postMessage(JSON.stringify({ type: 'outdent' })); true;`
      );
    }, []);

    const handleTapPreview = useCallback(() => {
      onFocus();
      setTimeout(() => {
        webViewRef.current?.injectJavaScript(
          `window.postMessage(JSON.stringify({ type: 'focus' })); true;`
        );
      }, 100);
    }, [onFocus]);

    const plainPreview = stripHtml(value);
    const bgColor = isDark
      ? (theme?.surface?.elevated || '#1E293B')
      : (Platform.OS === 'ios' ? 'rgba(248,250,252,0.8)' : '#FFFFFF');
    const borderColor = isDark
      ? (theme?.surface?.border || '#334155')
      : '#E2E8F0';

    return (
      <Animated.View style={[styles.container, animatedContainerStyle, {backgroundColor: bgColor, borderColor}]}>
        {/* Collapsed preview — shown when NOT focused */}
        {!isFocused && (
          <TouchableOpacity
            style={styles.previewWrap}
            onPress={handleTapPreview}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.previewText,
                !plainPreview && styles.placeholderText,
                isDark && {color: plainPreview ? (theme?.text?.title || '#F1F5F9') : (theme?.text?.placeholder || '#64748B')},
              ]}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {plainPreview || placeholder || 'Description'}
            </Text>
            <Ionicons
              name="create-outline"
              size={14}
              color={isDark ? '#64748B' : '#94A3B8'}
              style={styles.editIcon}
            />
          </TouchableOpacity>
        )}

        {/* WebView editor — always rendered but only visible when focused */}
        <View style={[styles.editorWrap, !isFocused && styles.hidden]}>
          <WebView
            ref={webViewRef}
            source={{html: buildEditorHtml(isDark)}}
            onLoad={handleLoad}
            onMessage={handleMessage}
            scrollEnabled={true}
            nestedScrollEnabled={true}
            keyboardDisplayRequiresUserAction={false}
            hideKeyboardAccessoryView={true}
            showsVerticalScrollIndicator={false}
            style={[styles.webView, {backgroundColor: bgColor}]}
            originWhitelist={['*']}
            javaScriptEnabled={true}
          />

          {/* Formatting toolbar */}
          <View style={[styles.toolbar, isDark && {backgroundColor: theme?.surface?.card || '#0F172A', borderTopColor: theme?.surface?.border || '#334155'}]}>
            <ToolbarButton
              icon="text"
              active={formatState.bold}
              onPress={() => execCommand('bold')}
              isDark={isDark}
            />
            <TouchableOpacity
              style={[
                styles.toolbarBtn,
                formatState.italic && styles.toolbarBtnActive,
                isDark && !formatState.italic && {backgroundColor: 'rgba(255,255,255,0.08)'},
              ]}
              onPress={() => execCommand('italic')}
              activeOpacity={0.6}
            >
              <Text
                style={{
                  fontSize: 17,
                  fontStyle: 'italic',
                  fontWeight: '700',
                  fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
                  color: formatState.italic ? '#FFFFFF' : isDark ? '#94A3B8' : '#475569',
                }}
              >
                I
              </Text>
            </TouchableOpacity>
            <ToolbarButton
              icon="remove-outline"
              active={formatState.underline}
              onPress={() => execCommand('underline')}
              isDark={isDark}
            />
            <View style={styles.toolbarDivider} />
            <ToolbarButton
              icon="list"
              active={formatState.unorderedList}
              onPress={() => execCommand('insertUnorderedList')}
              isDark={isDark}
            />
            <ToolbarButton
              icon="arrow-forward-outline"
              onPress={handleIndent}
              isDark={isDark}
            />
            <ToolbarButton
              icon="arrow-back-outline"
              onPress={handleOutdent}
              isDark={isDark}
            />
            <View style={{flex: 1}} />
            <TouchableOpacity
              style={styles.doneBtn}
              onPress={() => {
                webViewRef.current?.injectJavaScript(
                  `document.getElementById('editor').blur(); true;`
                );
                Keyboard.dismiss();
              }}
            >
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    );
  }
);

RichTextLineInput.displayName = 'RichTextLineInput';
export default RichTextLineInput;

// ─── Styles ─────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    marginTop: 8,
    marginBottom: 8,
  },
  previewWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: COLLAPSED_HEIGHT,
  },
  previewText: {
    flex: 1,
    fontSize: 15,
    color: '#0F172A',
    lineHeight: 20,
  },
  placeholderText: {
    color: '#94A3B8',
  },
  editIcon: {
    marginLeft: 8,
  },
  editorWrap: {
    flex: 1,
  },
  hidden: {
    position: 'absolute',
    opacity: 0,
    height: 0,
    width: 0,
    overflow: 'hidden',
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    height: TOOLBAR_HEIGHT,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 4,
  },
  toolbarBtn: {
    width: 34,
    height: 30,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.04)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toolbarBtnActive: {
    backgroundColor: '#6366F1',
  },
  toolbarDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 4,
  },
  doneBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#6366F1',
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
