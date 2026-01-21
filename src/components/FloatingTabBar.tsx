import React, { useEffect, useMemo, memo, useCallback } from 'react';
import { View, Text, Pressable, Dimensions, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  SharedValue,
} from 'react-native-reanimated';
import useInboxStore from '../state/inboxStore';
import useWorkspaceStore from '../state/workspaceStore';
import { useTheme } from '../contexts/ThemeContext';
import { hapticFeedback } from '../utils/hapticFeedback';
import { useBottomSheetContext } from '../contexts/BottomSheetContext';
import { GLASS } from '../utils/colors';

const TAB_WIDTH = 64;
const INDICATOR_SIZE = 56;

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

// Get icon based on route name
const getIconName = (routeName: string, active: boolean): IoniconsName => {
  switch (routeName) {
    case 'Home':
      return active ? 'home' : 'home-outline';
    case 'Brain AI':
      return active ? 'bulb' : 'bulb-outline';
    case 'Inbox':
      return active ? 'mail' : 'mail-outline';
    default:
      return 'ellipse';
  }
};

// Get short label for route
const getTabLabel = (routeName: string) => {
  switch (routeName) {
    case 'Home':
      return 'Home';
    case 'Brain AI':
      return 'Brain';
    case 'Inbox':
      return 'Inbox';
    default:
      return routeName;
  }
};

// Animated Tab Item Component
interface TabItemProps {
  route: { key: string; name: string; params?: object };
  index: number;
  isActive: boolean;
  activeTabIndex: SharedValue<number>;
  workspaceColor: string;
  isDark: boolean;
  onPress: () => void;
  notificationCount?: number;
}

// Memoized TabItem to prevent unnecessary re-renders
const TabItem = memo(
  ({
    route,
    index,
    isActive,
    activeTabIndex,
    workspaceColor,
    isDark,
    onPress,
    notificationCount = 0,
  }: TabItemProps) => {
    // Animation values for this specific tab
    const iconTranslateY = useSharedValue(isActive ? -28 : 0);
    const iconScale = useSharedValue(isActive ? 1.25 : 1);
    const textOpacity = useSharedValue(isActive ? 1 : 0);
    const textTranslateY = useSharedValue(isActive ? 0 : 10);

    // Update animations when active state changes
    useEffect(() => {
      if (isActive) {
        // Animate icon up with spring and scale up for magnifying effect
        iconTranslateY.value = withSpring(-28, {
          damping: 12,
          stiffness: 180,
          mass: 0.6,
        });
        iconScale.value = withSpring(1.25, {
          damping: 12,
          stiffness: 180,
          mass: 0.6,
        });
        // Fade in and slide up text
        textOpacity.value = withDelay(100, withTiming(1, { duration: 200 }));
        textTranslateY.value = withDelay(
          100,
          withSpring(0, { damping: 12, stiffness: 180 }),
        );
      } else {
        // Animate icon back down and scale back to normal
        iconTranslateY.value = withSpring(0, {
          damping: 15,
          stiffness: 200,
        });
        iconScale.value = withSpring(1, {
          damping: 15,
          stiffness: 200,
        });
        // Fade out text
        textOpacity.value = withTiming(0, { duration: 150 });
        textTranslateY.value = withTiming(10, { duration: 150 });
      }
    }, [isActive]);

    const animatedIconStyle = useAnimatedStyle(() => {
      return {
        transform: [
          { translateY: iconTranslateY.value },
          { scale: iconScale.value },
        ] as { translateY: number }[] | { scale: number }[],
      };
    });

    const animatedTextStyle = useAnimatedStyle(() => ({
      opacity: textOpacity.value,
      transform: [{ translateY: textTranslateY.value }],
    }));

    return (
      <Pressable
        onPress={onPress}
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          width: TAB_WIDTH,
          height: 48,
        }}
      >
        {/* Icon container - animates up when active */}
        <Animated.View
          style={[
            {
              alignItems: 'center',
              justifyContent: 'center',
            },
            animatedIconStyle,
          ]}
        >
          <Ionicons
            name={getIconName(route.name, isActive)}
            size={22}
            color={isActive ? workspaceColor : isDark ? 'rgba(250, 250, 250, 0.4)' : 'rgba(0, 0, 0, 0.35)'}
          />
        </Animated.View>

        {/* Text label - appears below lifted icon */}
        <Animated.Text
          style={[
            {
              fontSize: 10,
              fontWeight: '600',
              color: workspaceColor,
              position: 'absolute',
              bottom: 4,
            },
            animatedTextStyle,
          ]}
        >
          {getTabLabel(route.name)}
        </Animated.Text>

        {/* Notification badge for Inbox */}
        {route.name === 'Inbox' && notificationCount > 0 && (
          <View
            style={{
              position: 'absolute',
              top: 2,
              right: 10,
              minWidth: 16,
              height: 16,
              backgroundColor: '#EF4444',
              borderRadius: 8,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: notificationCount > 9 ? 4 : 0,
            }}
          >
            <Text
              style={{
                color: 'white',
                fontSize: 10,
                fontWeight: 'bold',
              }}
            >
              {notificationCount > 99 ? '99+' : notificationCount}
            </Text>
          </View>
        )}
      </Pressable>
    );
  },
);

export default function FloatingTabBar({
  state,
  navigation,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  // Use selectors to subscribe only to specific slices of state
  // Get the notification count directly from store (pre-computed to avoid filtering on render)
  const currentWorkspaceId = useWorkspaceStore(s => s.currentWorkspace?.id);
  const currentWorkspaceColor = useWorkspaceStore(s => s.currentWorkspace?.color);

  // Use the pre-computed notification count from the store instead of filtering inboxItems
  const notificationCount = useInboxStore(s => s.notificationCount);

  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  const { isDark } = useTheme();
  const { isBottomSheetOpen } = useBottomSheetContext();

  // Memoize workspace color to avoid recalculating on every render
  const workspaceColor = useMemo(() => currentWorkspaceColor || '#22C55E', [currentWorkspaceColor]);

  // Animation state
  const containerTranslateY = useSharedValue(0);
  const tabBarOpacity = useSharedValue(1);
  const chatButtonScale = useSharedValue(1);
  const chatButtonTranslateY = useSharedValue(0);
  const chatButtonOpacity = useSharedValue(1);

  // Indicator animation - position of the sliding indicator
  const indicatorPosition = useSharedValue(0);
  // Track active tab for icon/text animations (0-3 for 4 tabs)
  const activeTabIndex = useSharedValue(state.index);

  // Calculate distance to center of screen from button position
  const distanceToCenter = screenHeight / 2 - (insets.bottom + 12 + 32 + 28);

  // Get current route index from props
  const currentRouteIndex = state.index;

  // Calculate indicator position based on tab index
  const getIndicatorX = useCallback((index: number) => {
    const baseOffset = 8 + (TAB_WIDTH - INDICATOR_SIZE) / 2;
    if (index < 2) {
      return baseOffset + index * TAB_WIDTH;
    } else {
      // Center button is 56px wide but has some margin, total space it takes is ~64px
      const centerButtonSpace = 64;
      return (
        baseOffset + 2 * TAB_WIDTH + centerButtonSpace + (index - 2) * TAB_WIDTH
      );
    }
  }, []);

  // Update indicator position when tab changes
  useEffect(() => {
    const newX = getIndicatorX(currentRouteIndex);
    indicatorPosition.value = withSpring(newX, {
      damping: 15,
      stiffness: 150,
      mass: 0.8,
    });
    activeTabIndex.value = currentRouteIndex;
  }, [currentRouteIndex, getIndicatorX]);

  // Hide tab bar when bottom sheet is open
  useEffect(() => {
    if (isBottomSheetOpen) {
      tabBarOpacity.value = withTiming(0, { duration: 200 });
      containerTranslateY.value = withTiming(200, { duration: 200 });
    } else {
      tabBarOpacity.value = withTiming(1, { duration: 200 });
      containerTranslateY.value = withSpring(0, {
        damping: 20,
        stiffness: 200,
      });
    }
  }, [isBottomSheetOpen]);

  const handleChatPress = useCallback(() => {
    hapticFeedback.medium();

    const animationDuration = 400;

    (navigation as any).navigate('ChatScreen');

    chatButtonScale.value = withSequence(
      withSpring(0.9, { damping: 15 }),
      withTiming(1.2, {
        duration: animationDuration,
        easing: Easing.out(Easing.cubic),
      }),
    );

    chatButtonTranslateY.value = withTiming(-distanceToCenter, {
      duration: animationDuration,
      easing: Easing.out(Easing.cubic),
    });

    chatButtonOpacity.value = withDelay(
      animationDuration * 0.5,
      withTiming(0, { duration: animationDuration * 0.5 }, finished => {
        if (finished) {
          chatButtonScale.value = 1;
          chatButtonTranslateY.value = 0;
          chatButtonOpacity.value = 1;
        }
      }),
    );
  }, [navigation, distanceToCenter]);

  const handleTabPress = useCallback((route: any) => {
    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });

    if (!event.defaultPrevented) {
      hapticFeedback.selection();
      navigation.navigate(route.name, route.params);
    }
  }, [navigation]);

  // Animated styles
  const animatedContainerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: containerTranslateY.value }],
    opacity: tabBarOpacity.value,
  }));

  const animatedChatButtonStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateY: chatButtonTranslateY.value },
        { scale: chatButtonScale.value },
      ] as { translateY: number }[] | { scale: number }[],
      opacity: chatButtonOpacity.value,
    };
  });

  // Animated indicator style - the sliding pill behind active tab
  const animatedIndicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorPosition.value }],
  }));

  // Memoize route arrays to prevent recreating on every render
  const leftRoutes = useMemo(() => state.routes.slice(0, 2), [state.routes]);
  const rightRoutes = useMemo(() => state.routes.slice(2), [state.routes]);

  return (
    <View
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        pointerEvents: 'box-none',
      }}
    >
      {/* Floating Pill Container */}
      <Animated.View
        style={[
          {
            marginBottom: insets.bottom + 12,
            marginHorizontal: 16,
            alignSelf: 'center',
            minWidth: Math.min(screenWidth - 32, 300),
            maxWidth: screenWidth - 32,
          },
          animatedContainerStyle,
        ]}
      >
        {/* Sliding Indicator */}
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: -10,
              width: INDICATOR_SIZE,
              height: INDICATOR_SIZE,
              borderRadius: INDICATOR_SIZE / 2,
              overflow: 'hidden',
              zIndex: 1,
              backgroundColor: isDark ? 'rgba(24, 24, 27, 0.6)' : 'rgba(255, 255, 255, 0.7)',
              borderWidth: 1,
              borderColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)',
              ...GLASS.shadow.soft,
            },
            animatedIndicatorStyle,
          ]}
        />

        {/* Tab bar background */}
        <View style={styles.tabBarWrapper}>
          {/* Solid background layer - no blur for performance */}
          <View
            style={[
              styles.tabBarContainer,
              GLASS.shadow.medium,
              {
                backgroundColor: isDark ? 'rgba(18, 18, 20, 0.92)' : 'rgba(255, 255, 255, 0.92)',
                borderWidth: 1,
                borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
                borderRadius: 28,
              },
            ]}
          />

          {/* Tab Icons Row - positioned on top of blur */}
          <View style={styles.tabBarContent}>
            {/* Left tabs */}
            {leftRoutes.map((route, index) => {
              const isActive = currentRouteIndex === index;

              return (
                <TabItem
                  key={route.key}
                  route={route}
                  index={index}
                  isActive={isActive}
                  activeTabIndex={activeTabIndex}
                  workspaceColor={workspaceColor}
                  isDark={isDark}
                  onPress={() => handleTabPress(route)}
                />
              );
            })}

            {/* Center Chat Button - Elevated */}
            <Animated.View
              style={[
                {
                  position: 'relative',
                  marginTop: -26,
                },
                animatedChatButtonStyle,
              ]}
            >
              <Pressable
                onPress={handleChatPress}
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  backgroundColor: workspaceColor,
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.15,
                  shadowRadius: 8,
                  elevation: 6,
                }}
              >
                <Ionicons name="chatbubble" size={22} color="white" />
              </Pressable>
            </Animated.View>

            {/* Right tabs */}
            {rightRoutes.map((route, index) => {
              const actualIndex = index + 2;
              const isActive = currentRouteIndex === actualIndex;

              return (
                <TabItem
                  key={route.key}
                  route={route}
                  index={actualIndex}
                  isActive={isActive}
                  activeTabIndex={activeTabIndex}
                  workspaceColor={workspaceColor}
                  isDark={isDark}
                  onPress={() => handleTabPress(route)}
                  notificationCount={
                    route.name === 'Inbox' ? notificationCount : undefined
                  }
                />
              );
            })}
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBarWrapper: {
    position: 'relative',
  },
  tabBarContainer: {
    borderRadius: 28,
    overflow: 'hidden',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  tabBarContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
});
