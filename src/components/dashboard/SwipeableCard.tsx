/**
 * SwipeableCard - Authentic macOS genie animation
 *
 * The card compresses into its OWN icon. We render a fixed icon at the
 * exact position of the card's icon. During normal state, it's hidden.
 * When swiping/animating begins, we immediately show the fixed icon
 * (which perfectly overlays the card's icon) so the transition is seamless.
 * The card then animates into this fixed icon.
 */

import React, { useState, useCallback, createContext, useContext, memo, useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions, LayoutChangeEvent, Text, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useIsFocused } from '@react-navigation/native';
import { LucideIcon } from 'lucide-react-native';
import useDashboardUIStore from '../../state/dashboardUIStore';
import type { CardId } from '../../state/dashboardUIStore';

// Context to communicate interaction state to children
const SwipeInteractionContext = createContext<Animated.SharedValue<boolean> | null>(null);

export function useSwipeInteraction() {
  return useContext(SwipeInteractionContext);
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DISMISS_THRESHOLD = 100;
const ICON_SIZE = 40;

// The icon inside the card is at:
// - Left: 16px (card content padding) + 1px (gradient border)
// - Vertically centered in the card
const CARD_ICON_LEFT = 17;

const NUM_STRIPS = 24;

export interface SwipeableCardProps {
  id: string;
  children: React.ReactNode;
  icon: LucideIcon;
  iconColor: string;
  canDismiss?: boolean;
  onDismiss?: () => void;
  onMinimize?: () => void;
  onTap?: () => void;
  iconTargetY?: number;
  /** Badge count to show on minimized icon */
  badgeCount?: number;
}

/**
 * Each strip compresses toward the icon position.
 * Bottom strips arrive first, creating the "liquid pouring" effect.
 * Memoized to prevent re-renders during animation.
 */
const GenieStrip = memo(({
  index,
  totalStrips,
  progress,
  cardWidth,
  cardHeight,
  iconCenterX,
  iconCenterY,
  children,
}: {
  index: number;
  totalStrips: number;
  progress: Animated.SharedValue<number>;
  cardWidth: number;
  cardHeight: number;
  iconCenterX: number;
  iconCenterY: number;
  children?: React.ReactNode;
}) => {
  const stripHeight = cardHeight / totalStrips;

  // Position in card: 0 = top strip, 1 = bottom strip
  const normalizedPosition = index / (totalStrips - 1);

  // Invert for animation: bottom leads (0), top follows (1)
  const animationDelay = 1 - normalizedPosition;

  const animatedStyle = useAnimatedStyle(() => {
    const p = progress.value;

    if (p < 0.001) {
      return {
        transform: [
          { translateX: 0 },
          { translateY: 0 },
          { scaleX: 1 },
        ] as const,
        opacity: 1,
      };
    }

    // This strip's current center
    const stripCenterX = cardWidth / 2;
    const stripCenterY = index * stripHeight + stripHeight / 2;

    // Each strip has its own "local progress" based on position
    // Bottom strips (animationDelay=0) start immediately
    // Top strips (animationDelay=1) start later
    const delayAmount = animationDelay * 0.35;
    const localProgress = Math.max(0, Math.min((p - delayAmount) / (1 - delayAmount), 1));

    // Smooth bezier-like easing for natural deceleration
    const easedProgress = localProgress < 0.5
      ? 2 * localProgress * localProgress
      : 1 - Math.pow(-2 * localProgress + 2, 3) / 2;

    // === HORIZONTAL: Move strip center toward icon center ===
    const targetX = iconCenterX - stripCenterX;
    const currentTranslateX = easedProgress * targetX;

    // === VERTICAL: Move strip toward icon's vertical center ===
    const targetY = iconCenterY - stripCenterY;
    const currentTranslateY = easedProgress * targetY;

    // === WIDTH: Compress to icon width ===
    const targetScaleX = ICON_SIZE / cardWidth;
    const currentScaleX = 1 - easedProgress * (1 - targetScaleX);

    // === OPACITY: Fade out as it approaches the icon ===
    // Fade out earlier so the fixed icon underneath is revealed
    const fadeStart = 0.5;
    const opacity = localProgress > fadeStart
      ? 1 - ((localProgress - fadeStart) / (1 - fadeStart))
      : 1;

    return {
      transform: [
        { translateX: currentTranslateX },
        { translateY: currentTranslateY },
        { scaleX: Math.max(currentScaleX, 0.02) },
      ] as const,
      opacity: Math.max(opacity, 0),
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: index * stripHeight,
          left: 0,
          width: cardWidth,
          height: stripHeight + 1, // +1 prevents gaps
          overflow: 'hidden',
          transformOrigin: 'center center',
        },
        animatedStyle,
      ]}
    >
      {/* Show this strip's portion of the card */}
      <View
        style={{
          position: 'absolute',
          top: -index * stripHeight,
          left: 0,
          width: cardWidth,
          height: cardHeight,
        }}
      >
        {children}
      </View>
    </Animated.View>
  );
});

export default function SwipeableCard({
  id,
  children,
  icon: Icon,
  iconColor,
  canDismiss = true,
  onDismiss,
  onTap,
  badgeCount,
}: SwipeableCardProps) {
  const translateX = useSharedValue(0);
  const dismissOpacity = useSharedValue(1);
  const genieProgress = useSharedValue(0);
  const isAnimating = useSharedValue(false);

  // Track if we're in any swipe/animation state where fixed icon should show
  const isInteracting = useSharedValue(false);

  // Icon slide animation - moves icon to left side after genie completes
  const iconSlideX = useSharedValue(0);

  // Track if card is in minimized state (for tap to restore)
  const isMinimized = useSharedValue(false);

  // Track screen focus to reset gesture state properly
  const isFocused = useIsFocused();

  // Track previous focus state to detect tab switches
  const wasFocusedRef = useRef(isFocused);
  const [gestureKey, setGestureKey] = useState(0);

  // Use store for persisted minimized state - use primitive selector for proper reactivity
  const cardMinimizedFromStore = useDashboardUIStore(
    useCallback((s) => s.minimizedCards.has(id as CardId), [id]),
  );
  const minimizeCard = useDashboardUIStore(s => s.minimizeCard);
  const restoreCard = useDashboardUIStore(s => s.restoreCard);

  const [cardDimensions, setCardDimensions] = useState({ width: 300, height: 100 });

  // Calculate the icon center position (the icon inside the card)
  // Icon is at left padding (16px + 1px border) and vertically centered
  const iconCenterX = CARD_ICON_LEFT + ICON_SIZE / 2;
  const iconCenterY = cardDimensions.height / 2;

  // Target X position for minimized icon (left edge of screen)
  // The card is inside a container with paddingLeft: 60, so we need to go back that distance
  // Plus a bit more to reach the minimized icon bar at left: 12
  const minimizedTargetX = -(60 - 12); // From paddingLeft position to left: 12

  // Track if we're currently animating a restore - prevents effect from overriding
  const isRestoringRef = React.useRef(false);

  // Sync animation state with store state
  // This is the ONLY effect that manages state synchronization
  // It handles: initial mount, store changes, AND screen focus changes
  useEffect(() => {
    // Skip if we're in the middle of a restore animation
    if (isRestoringRef.current && !cardMinimizedFromStore) {
      // The restore animation is handling this transition
      return;
    }

    if (cardMinimizedFromStore) {
      // Card should be minimized - set values immediately without animation
      genieProgress.value = 1;
      iconSlideX.value = minimizedTargetX;
      isMinimized.value = true;
      isInteracting.value = true;
      isAnimating.value = false;
    } else {
      // Card should be expanded - reset all values
      genieProgress.value = 0;
      iconSlideX.value = 0;
      isMinimized.value = false;
      isInteracting.value = false;
      translateX.value = 0;
      dismissOpacity.value = 1;
      isAnimating.value = false;
    }
  }, [cardMinimizedFromStore, minimizedTargetX]);

  // Ensure animation state is reset when screen gains focus
  // This is critical for gestures to work after tab switches
  useEffect(() => {
    // Only trigger when transitioning from unfocused to focused
    const wasUnfocused = !wasFocusedRef.current;
    wasFocusedRef.current = isFocused;

    if (isFocused && wasUnfocused) {
      // Force gesture recreation only on tab return
      setGestureKey(k => k + 1);
    }

    if (isFocused) {
      // Always ensure isAnimating is false when focused
      isAnimating.value = false;

      // Re-sync the minimized state values when focused
      if (cardMinimizedFromStore) {
        genieProgress.value = 1;
        iconSlideX.value = minimizedTargetX;
        isMinimized.value = true;
        isInteracting.value = true;
      } else {
        genieProgress.value = 0;
        iconSlideX.value = 0;
        isMinimized.value = false;
        isInteracting.value = false;
        translateX.value = 0;
        dismissOpacity.value = 1;
      }
    }
  }, [isFocused, cardMinimizedFromStore, minimizedTargetX]);


  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setCardDimensions({ width, height });
    }
  }, []);

  // Clear restoring flag - called from worklet
  const clearRestoringFlag = useCallback(() => {
    isRestoringRef.current = false;
  }, []);

  // Handle tap on minimized icon to restore card
  const handleIconTap = useCallback(() => {
    Haptics.selectionAsync();

    // Mark that we're restoring - prevents the sync effect from overriding our animation
    isRestoringRef.current = true;

    // Update store first
    restoreCard(id as CardId);

    // Slide icon back to original position
    iconSlideX.value = withSpring(0, {
      damping: 20,
      stiffness: 180,
      mass: 0.6,
    });

    // Reverse genie animation
    genieProgress.value = withSpring(0, {
      damping: 18,
      stiffness: 120,
      mass: 0.8,
    }, () => {
      isMinimized.value = false;
      isInteracting.value = false;
      isAnimating.value = false;
      // Clear the restoring flag after animation completes
      runOnJS(clearRestoringFlag)();
    });
  }, [id, restoreCard, clearRestoringFlag]);

  // Handle tap on the card (when not minimized) to trigger onTap
  const handleCardTap = useCallback(() => {
    if (onTap) {
      Haptics.selectionAsync();
      onTap();
    }
  }, [onTap]);

  // Persist minimize state to store
  const handleMinimizeComplete = useCallback(() => {
    minimizeCard(id as CardId);
  }, [id, minimizeCard]);

  // Handle tap dispatch based on minimized state
  const handleTapDispatch = useCallback(() => {
    if (cardMinimizedFromStore) {
      handleIconTap();
    } else {
      handleCardTap();
    }
  }, [cardMinimizedFromStore, handleIconTap, handleCardTap]);

  const tapGesture = Gesture.Tap()
    .maxDuration(250)
    .onEnd(() => {
      'worklet';
      runOnJS(handleTapDispatch)();
    });

  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-25, 25])
    .minPointers(1)
    .maxPointers(1)
    .shouldCancelWhenOutside(true)
    .enabled(!cardMinimizedFromStore)
    .onStart(() => {
      'worklet';
      if (isAnimating.value) return;
      isInteracting.value = true;
    })
    .onUpdate((event) => {
      // Skip if animating
      if (isAnimating.value) return;

      if (event.translationX > 0 && canDismiss) {
        // Swiping right to dismiss
        translateX.value = event.translationX;
        dismissOpacity.value = 1 - event.translationX / (SCREEN_WIDTH * 0.5);
        // Reset genie if we were swiping left before
        if (genieProgress.value > 0) {
          genieProgress.value = 0;
        }
      } else if (event.translationX < 0) {
        // Swiping left to minimize - genie follows finger in real-time
        const swipeDistance = Math.abs(event.translationX);
        // Full genie at 200px swipe, starts immediately
        const progress = Math.min(swipeDistance / 200, 1);
        genieProgress.value = progress;

        // Also slide the icon as progress increases (after 50% genie)
        if (progress > 0.5) {
          const slideProgress = (progress - 0.5) / 0.5; // 0 to 1 for the second half
          iconSlideX.value = slideProgress * minimizedTargetX;
        } else {
          iconSlideX.value = 0;
        }
      }
    })
    .onEnd((event) => {
      // Skip if animating
      if (isAnimating.value) return;

      if (event.translationX > DISMISS_THRESHOLD && canDismiss) {
        // Dismiss the card
        isAnimating.value = true;
        translateX.value = withTiming(SCREEN_WIDTH, { duration: 250 });
        dismissOpacity.value = withTiming(0, { duration: 250 }, () => {
          if (onDismiss) runOnJS(onDismiss)();
        });
      } else if (genieProgress.value > 0.5) {
        // Past halfway - complete the minimize animation
        isAnimating.value = true;

        // Animate to full genie
        genieProgress.value = withSpring(1, {
          damping: 20,
          stiffness: 200,
          mass: 0.6,
        });

        // Slide icon to final position
        iconSlideX.value = withSpring(minimizedTargetX, {
          damping: 20,
          stiffness: 180,
          mass: 0.6,
        }, () => {
          isMinimized.value = true;
          isAnimating.value = false; // Reset animating state after completion
          // Persist to store
          runOnJS(handleMinimizeComplete)();
        });
      } else {
        // Snap back - reverse the animation
        translateX.value = withSpring(0, { damping: 20, stiffness: 180, mass: 0.8 });
        dismissOpacity.value = withSpring(1, { damping: 15, stiffness: 200 });
        genieProgress.value = withSpring(0, {
          damping: 18,
          stiffness: 220,
          mass: 0.6,
        });
        iconSlideX.value = withSpring(0, {
          damping: 18,
          stiffness: 220,
          mass: 0.6,
        }, () => {
          isInteracting.value = false;
        });
      }
    })
    .onFinalize(() => {
      // If we didn't trigger an animation, hide the fixed icon
      if (!isAnimating.value && genieProgress.value < 0.01 && !isMinimized.value) {
        isInteracting.value = false;
      }
    });

  // Compose gestures - pan takes priority over tap
  const composedGesture = Gesture.Exclusive(panGesture, tapGesture);

  // Normal card (hidden when genie is active)
  const containerStyle = useAnimatedStyle(() => {
    if (genieProgress.value > 0.01) {
      return { opacity: 0 };
    }
    return {
      transform: [{ translateX: translateX.value }],
      opacity: dismissOpacity.value,
    };
  });

  // Dismiss hint
  const dismissHintStyle = useAnimatedStyle(() => ({
    opacity: translateX.value > 20 ? Math.min(1, translateX.value / 80) : 0,
    transform: [
      { scale: interpolate(translateX.value, [20, 100], [0.8, 1], Extrapolation.CLAMP) },
    ],
  }));

  // Strips container
  const stripsContainerStyle = useAnimatedStyle(() => ({
    opacity: genieProgress.value > 0.01 ? 1 : 0,
  }));

  // Fixed icon - visible whenever interacting or animating, and slides left after genie
  const fixedIconStyle = useAnimatedStyle(() => ({
    opacity: isInteracting.value ? 1 : 0,
    transform: [{ translateX: iconSlideX.value }],
  }));

  return (
    <SwipeInteractionContext.Provider value={isInteracting}>
      <View style={styles.wrapper} onLayout={handleLayout}>
        {/* Minimized icon - positioned absolutely outside GestureDetector for reliable taps */}
        {cardMinimizedFromStore && (
          <Pressable
            onPress={handleIconTap}
            style={[
              styles.minimizedIconPressable,
              {
                left: CARD_ICON_LEFT + minimizedTargetX,
                top: cardDimensions.height / 2 - ICON_SIZE / 2,
              },
            ]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <View style={[styles.fixedIconInner, { backgroundColor: `${iconColor}20` }]}>
              <Icon size={18} color={iconColor} />
            </View>
            {/* Notification badge */}
            {badgeCount !== undefined && badgeCount > 0 && (
              <View style={[styles.badge, { backgroundColor: iconColor }]}>
                <Text style={styles.badgeText}>
                  {badgeCount > 99 ? '99+' : badgeCount}
                </Text>
              </View>
            )}
          </Pressable>
        )}

        <GestureDetector key={gestureKey} gesture={composedGesture}>
          <Animated.View style={styles.gestureContainer}>
            {/* Fixed icon - positioned exactly over the card's icon
                Shows during animation, hidden when fully minimized (Pressable takes over) */}
            <Animated.View
              style={[
                styles.fixedIconContainer,
                {
                  left: CARD_ICON_LEFT,
                  top: cardDimensions.height / 2 - ICON_SIZE / 2,
                },
                fixedIconStyle,
              ]}
              pointerEvents={cardMinimizedFromStore ? 'none' : 'auto'}
            >
              {!cardMinimizedFromStore && (
                <>
                  <View style={[styles.fixedIconInner, { backgroundColor: `${iconColor}20` }]}>
                    <Icon size={18} color={iconColor} />
                  </View>
                  {/* Notification badge - shows when minimized and has count */}
                  {badgeCount !== undefined && badgeCount > 0 && (
                    <View style={[styles.badge, { backgroundColor: iconColor }]}>
                      <Text style={styles.badgeText}>
                        {badgeCount > 99 ? '99+' : badgeCount}
                      </Text>
                    </View>
                  )}
                </>
              )}
            </Animated.View>

            {/* Normal card view */}
            <Animated.View style={[styles.container, containerStyle]}>
              {canDismiss && (
                <Animated.View style={[styles.dismissHint, dismissHintStyle]}>
                  <View style={styles.dismissIcon}>
                    <View style={styles.dismissX}>
                      <View style={[styles.xLine, styles.xLine1]} />
                      <View style={[styles.xLine, styles.xLine2]} />
                    </View>
                  </View>
                </Animated.View>
              )}
              {children}
            </Animated.View>

            {/* Genie animation container - strips compress toward the card's own icon */}
            <Animated.View
              style={[
                styles.stripsContainer,
                { width: cardDimensions.width, height: cardDimensions.height },
                stripsContainerStyle,
              ]}
              pointerEvents="none"
            >
              {/* Strips that compress toward the icon inside the card */}
              {Array.from({ length: NUM_STRIPS }).map((_, index) => (
                <GenieStrip
                  key={index}
                  index={index}
                  totalStrips={NUM_STRIPS}
                  progress={genieProgress}
                  cardWidth={cardDimensions.width}
                  cardHeight={cardDimensions.height}
                  iconCenterX={iconCenterX}
                  iconCenterY={iconCenterY}
                >
                  {children}
                </GenieStrip>
              ))}
            </Animated.View>
          </Animated.View>
        </GestureDetector>
      </View>
    </SwipeInteractionContext.Provider>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  gestureContainer: {
    width: '100%',
  },
  container: {
    width: '100%',
  },
  stripsContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    overflow: 'visible',
  },
  minimizedIconPressable: {
    position: 'absolute',
    width: ICON_SIZE,
    height: ICON_SIZE,
    zIndex: 200, // Above everything including fixed icon
  },
  fixedIconContainer: {
    position: 'absolute',
    width: ICON_SIZE,
    height: ICON_SIZE,
    zIndex: 100, // Above everything
  },
  fixedIconInner: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissHint: {
    position: 'absolute',
    right: -50,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: -1,
  },
  dismissIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissX: {
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  xLine: {
    position: 'absolute',
    width: 14,
    height: 2,
    backgroundColor: '#EF4444',
    borderRadius: 1,
  },
  xLine1: {
    transform: [{ rotate: '45deg' }],
  },
  xLine2: {
    transform: [{ rotate: '-45deg' }],
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
