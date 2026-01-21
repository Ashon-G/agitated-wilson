import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, Pressable, Dimensions, StyleSheet, Platform } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface FullscreenVideoPlayerProps {
  videoUrl: string;
  isVisible: boolean;
  onClose: () => void;
  isSkippable?: boolean;
  onVideoEnd?: () => void;
}

export default function FullscreenVideoPlayer({
  videoUrl,
  isVisible,
  onClose,
  isSkippable = false,
  onVideoEnd,
}: FullscreenVideoPlayerProps) {
  const insets = useSafeAreaInsets();
  const [isVideoEnded, setIsVideoEnded] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const opacity = useSharedValue(0);
  const videoRef = useRef<VideoView>(null);

  const player = useVideoPlayer(videoUrl, (p) => {
    p.loop = false;
    p.muted = false;
    p.play();
  });

  // Listen for video ending
  useEffect(() => {
    if (!player) return;

    const subscription = player.addListener('playingChange', (event) => {
      // Check if video has ended (not playing and currentTime is near duration)
      if (!event.isPlaying && player.currentTime > 0) {
        // Small buffer for end detection
        const { duration } = player;
        if (duration > 0 && player.currentTime >= duration - 0.5) {
          setIsVideoEnded(true);
          onVideoEnd?.();
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [player, onVideoEnd]);

  // Reset state when visibility changes
  useEffect(() => {
    if (isVisible) {
      setIsVideoEnded(false);
      setShowControls(false);
      opacity.value = withTiming(1, { duration: 300 });
      player?.play();
    } else {
      opacity.value = withTiming(0, { duration: 300 });
      player?.pause();
    }
  }, [isVisible, player]);

  const handleClose = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onClose();
  }, [onClose]);

  const handleTapVideo = useCallback(() => {
    // Only show controls if skippable or video has ended
    if (isSkippable || isVideoEnded) {
      setShowControls((prev) => !prev);
    }
  }, [isSkippable, isVideoEnded]);

  const animatedContainerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  // Can close if skippable OR video has ended
  const canClose = isSkippable || isVideoEnded;

  if (!isVisible) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(300)}
      style={[styles.container, animatedContainerStyle]}
    >
      {/* Video Player */}
      <Pressable onPress={handleTapVideo} style={styles.videoContainer}>
        <VideoView
          ref={videoRef}
          player={player}
          style={styles.video}
          contentFit="contain"
          nativeControls={false}
        />
      </Pressable>

      {/* Close Button - Only show when allowed */}
      {canClose && (
        <Animated.View
          entering={FadeIn.duration(200)}
          style={[
            styles.closeButtonContainer,
            { top: insets.top + 16 },
          ]}
        >
          <Pressable
            onPress={handleClose}
            style={styles.closeButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={24} color="#fff" />
          </Pressable>
        </Animated.View>
      )}

      {/* Non-skippable indicator */}
      {!isSkippable && !isVideoEnded && (
        <Animated.View
          entering={FadeIn.delay(500).duration(300)}
          style={[styles.nonSkippableIndicator, { top: insets.top + 16 }]}
        >
          <View style={styles.nonSkippableBadge}>
            <Text style={styles.nonSkippableText}>Watch to continue</Text>
          </View>
        </Animated.View>
      )}

      {/* Video ended indicator with close prompt */}
      {isVideoEnded && (
        <Animated.View
          entering={FadeIn.duration(300)}
          style={styles.endedOverlay}
        >
          <Pressable onPress={handleClose} style={styles.endedContent}>
            <Text style={styles.endedText}>Tap anywhere to continue</Text>
          </Pressable>
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
    zIndex: 9999,
  },
  videoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  closeButtonContainer: {
    position: 'absolute',
    right: 16,
    zIndex: 10,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  nonSkippableIndicator: {
    position: 'absolute',
    left: 16,
    zIndex: 10,
  },
  nonSkippableBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  nonSkippableText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
  endedOverlay: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  endedContent: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  endedText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
});
