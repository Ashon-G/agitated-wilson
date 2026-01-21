/**
 * YandexAdCard - WebView-based Yandex Advertising Network (YAN) native ad
 * Displays as a swipeable dashboard card
 */

import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import HolographicCard from './HolographicCard';
import { useTheme } from '../../contexts/ThemeContext';

interface YandexAdCardProps {
  /** Block ID (R-A-XXXXXXX-X) from Yandex Advertising Network dashboard */
  blockId?: string;
}

/**
 * Native ad card with holographic styling using WebView
 * Integrates seamlessly with dashboard cards system
 * Returns null when ads are not configured or available
 */
export default function YandexAdCard({ blockId }: YandexAdCardProps) {
  const { isDark } = useTheme();
  const [adLoaded, setAdLoaded] = useState(false);
  const [adHeight, setAdHeight] = useState(120);
  const webViewRef = useRef<WebView>(null);

  // Only render if ads are configured and not on web
  if (Platform.OS === 'web' || !blockId) {
    return null;
  }

  // Don't show if ad failed to load
  if (!adLoaded && adHeight === 0) {
    return null;
  }

  // Generate HTML for Yandex ad
  const adHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      background: transparent;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      overflow: hidden;
    }
    #yandex_rtb_R-A-container {
      width: 100%;
      min-height: 100px;
    }
  </style>
</head>
<body>
  <div id="yandex_rtb_${blockId}"></div>

  <script>
    window.yaContextCb = window.yaContextCb || [];

    // Load Yandex RTB script
    (function() {
      var script = document.createElement('script');
      script.src = 'https://yandex.ru/ads/system/context.js';
      script.async = true;
      document.head.appendChild(script);
    })();

    // Initialize ad when ready
    window.yaContextCb.push(() => {
      Ya.Context.AdvManager.render({
        blockId: "${blockId}",
        renderTo: "yandex_rtb_${blockId}",
        async: true,
        onError: function(error) {
          console.error('Yandex ad error:', error);
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'error',
            error: error
          }));
        },
        onRender: function() {
          console.log('Yandex ad rendered');

          // Calculate actual height after render
          setTimeout(() => {
            var container = document.getElementById('yandex_rtb_${blockId}');
            var height = container ? container.offsetHeight : 120;

            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'loaded',
              height: height
            }));
          }, 300);
        }
      });
    });
  </script>
</body>
</html>
`;

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === 'loaded') {
        setAdLoaded(true);
        if (data.height) {
          setAdHeight(Math.max(data.height, 100));
        }
      } else if (data.type === 'error') {
        console.warn('Yandex ad failed to load:', data.error);
        setAdLoaded(false);
        setAdHeight(0);
      }
    } catch (e) {
      console.error('Error parsing WebView message:', e);
    }
  };

  return (
    <HolographicCard
      gradientColors={
        isDark
          ? ['rgba(245, 158, 11, 0.2)', 'rgba(251, 191, 36, 0.15)', 'rgba(252, 211, 77, 0.1)']
          : ['rgba(245, 158, 11, 0.25)', 'rgba(251, 191, 36, 0.2)', 'rgba(252, 211, 77, 0.15)']
      }
      glowColor={isDark ? 'rgba(245, 158, 11, 0.4)' : 'rgba(245, 158, 11, 0.3)'}
    >
      <View style={styles.cardContent}>
        {/* Ad label */}
        <View style={styles.adLabel}>
          <Text style={[styles.adLabelText, !isDark && { color: 'rgba(31, 41, 55, 0.5)' }]}>
            SPONSORED
          </Text>
        </View>

        {/* Yandex Ad WebView */}
        <WebView
          ref={webViewRef}
          source={{ html: adHTML }}
          style={[styles.webView, { height: adHeight }]}
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          onMessage={handleMessage}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          originWhitelist={['*']}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
        />
      </View>
    </HolographicCard>
  );
}

const styles = StyleSheet.create({
  cardContent: {
    width: '100%',
  },
  webView: {
    width: '100%',
    backgroundColor: 'transparent',
  },
  adLabel: {
    position: 'absolute',
    top: -8,
    right: 8,
    zIndex: 10,
  },
  adLabelText: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.4)',
    letterSpacing: 0.5,
  },
});
