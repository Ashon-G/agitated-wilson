import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, Image, Platform } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';

interface TavaMascotProps {
  onReady?: () => void;
  onError?: (error: string) => void;
  size?: number;
  style?: object;
}

const TAVA_ASSETS = {
  transparent_image: 'https://assets.masco.dev/e52135/tava-3df8/sorting-nebula-orbs-c8d0611d.png',
  animation_webm: 'https://assets.masco.dev/e52135/tava-3df8/sorting-nebula-orbs-f5e5e5b0.webm',
  image: 'https://assets.masco.dev/e52135/tava-3df8/sorting-nebula-orbs-5b9205ec.png',
  video: 'https://assets.masco.dev/e52135/tava-3df8/sorting-nebula-orbs-996b0e7a.mp4',
  animation_hevc: 'https://assets.masco.dev/e52135/tava-3df8/sorting-nebula-orbs-f379769b.mov',
};

export default function TavaMascot({
  onReady,
  onError,
  size = 300,
  style,
}: TavaMascotProps) {
  const videoRef = useRef<Video>(null);
  const [videoFailed, setVideoFailed] = useState(false);

  useEffect(() => {
    // Report ready after a short delay to ensure component is mounted
    const timer = setTimeout(() => {
      onReady?.();
    }, 100);
    return () => clearTimeout(timer);
  }, [onReady]);

  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (!status.isLoaded && 'error' in status) {
      console.log('[TavaMascot] Video playback error, falling back to image');
      setVideoFailed(true);
    }
  };

  const handleVideoError = (error: string) => {
    console.log('[TavaMascot] Video error:', error);
    setVideoFailed(true);
  };

  // Use HEVC video on iOS, MP4 on Android, fallback to image on web or if video fails
  const videoSource = Platform.select({
    ios: { uri: TAVA_ASSETS.animation_hevc },
    android: { uri: TAVA_ASSETS.video },
    default: null,
  });

  const shouldShowVideo = !videoFailed && videoSource && Platform.OS !== 'web';

  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      {shouldShowVideo ? (
        <Video
          ref={videoRef}
          source={videoSource}
          style={styles.video}
          resizeMode={ResizeMode.CONTAIN}
          isLooping
          shouldPlay
          isMuted
          onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
          onError={handleVideoError}
        />
      ) : (
        <Image
          source={{ uri: TAVA_ASSETS.transparent_image }}
          style={styles.image}
          resizeMode="contain"
          onError={() => {
            console.log('[TavaMascot] Image error');
            onError?.('Failed to load Tava mascot');
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
