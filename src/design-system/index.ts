/**
 * TAVA DESIGN SYSTEM
 * ===================
 * A comprehensive design system for building consistent, beautiful mobile interfaces.
 *
 * This file serves as the single source of truth for all design tokens, patterns,
 * and styling guidelines used throughout the Tava application.
 *
 * Usage:
 *   import { DS } from '@/design-system';
 *
 *   // Access colors
 *   <View style={{ backgroundColor: DS.colors.primary[500] }} />
 *
 *   // Access typography
 *   <Text style={DS.typography.titleLarge}>Hello</Text>
 *
 *   // Access spacing
 *   <View style={{ padding: DS.spacing.md }} />
 */

import { StyleSheet, TextStyle, ViewStyle, Platform } from 'react-native';

// =============================================================================
// COLOR SYSTEM
// =============================================================================

/**
 * Primary Color Palette
 * The main brand color is a vibrant green that conveys growth, freshness, and positivity.
 */
export const PRIMARY_COLORS = {
  50: '#F0FDF4',   // Very light green - backgrounds, subtle highlights
  100: '#DCFCE7',  // Light green - hover states, light backgrounds
  200: '#BBF7D0',  // Lighter green - secondary backgrounds
  300: '#86EFAC',  // Light cartoony green - badges, tags
  400: '#4ADE80',  // Medium cartoony green - buttons, active states
  500: '#22C55E',  // Main brand color - primary actions, CTAs
  600: '#16A34A',  // Dark cartoony green - pressed states
  700: '#15803D',  // Darker green - text on light backgrounds
  800: '#166534',  // Very dark green - emphasis text
  900: '#14532D',  // Darkest green - headings
} as const;

/**
 * Accent Colors
 * Supporting colors for specific UI purposes
 */
export const ACCENT_COLORS = {
  blue: '#3B82F6',      // Info, links, secondary actions
  yellow: '#FDE047',    // Warnings, highlights
  orange: '#FB923C',    // Attention, medium priority
  red: '#EF4444',       // Errors, destructive actions, notifications
  gray: '#6B7280',      // Neutral, disabled states
  purple: '#8B5CF6',    // Special features, premium
  pink: '#F472B6',      // Highlights, decorative
  cyan: '#22D3EE',      // Info, progress
  amber: '#F59E0B',     // Warnings
} as const;

/**
 * Premium/Gold Color Palette
 * Used for upgrade buttons, premium features, and special promotions
 */
export const PREMIUM_COLORS = {
  gold: {
    primary: '#D4AF37',
    light: '#F5D67B',
    dark: '#C9A227',
    darker: '#B8960F',
    accent: '#E8C55B',
  },
  gradients: {
    primary: ['#D4AF37', '#F5D67B', '#C9A227'] as const,
    gold: ['#D4AF37', '#F5D67B', '#B8960F'] as const,
    accent: ['#E8C55B', '#D4AF37', '#B8960F'] as const,
  },
} as const;

/**
 * Semantic Colors
 * Colors that convey meaning
 */
export const SEMANTIC_COLORS = {
  success: '#22C55E',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',

  // Dark variants for light mode
  successDark: '#15803d',
  errorDark: '#b91c1c',
  warningDark: '#d97706',
  infoDark: '#1d4ed8',
} as const;

/**
 * Neutral/Gray Scale
 */
export const NEUTRALS = {
  50: '#F9FAFB',
  100: '#F3F4F6',
  200: '#E5E7EB',
  300: '#D1D5DB',
  400: '#9CA3AF',
  500: '#6B7280',
  600: '#4B5563',
  700: '#374151',
  800: '#1F2937',
  900: '#111827',
  950: '#030712',
} as const;

// =============================================================================
// GLASSMORPHISM SYSTEM
// =============================================================================

/**
 * Glass Styles for Dark Mode
 * Premium frosted glass effects for dark interfaces
 */
export const GLASS_DARK = {
  // Backgrounds with varying opacity levels
  background: 'rgba(15, 23, 42, 0.45)',
  backgroundLight: 'rgba(30, 41, 59, 0.35)',
  backgroundMedium: 'rgba(15, 23, 42, 0.55)',
  backgroundHeavy: 'rgba(15, 23, 42, 0.7)',
  backgroundSolid: 'rgba(17, 24, 39, 0.85)',
  backgroundCard: 'rgba(31, 41, 55, 0.95)',

  // Borders with subtle visibility
  border: 'rgba(255, 255, 255, 0.15)',
  borderLight: 'rgba(255, 255, 255, 0.1)',
  borderMedium: 'rgba(255, 255, 255, 0.2)',
  borderHeavy: 'rgba(255, 255, 255, 0.25)',

  // Text colors optimized for dark backgrounds
  text: '#FFFFFF',
  textSecondary: 'rgba(255, 255, 255, 0.8)',
  textMuted: 'rgba(255, 255, 255, 0.6)',
  textDisabled: 'rgba(255, 255, 255, 0.4)',

  // Icon colors
  icon: '#FFFFFF',
  iconSecondary: 'rgba(255, 255, 255, 0.8)',
  iconMuted: 'rgba(255, 255, 255, 0.6)',

  // Accent color for dark mode
  accent: '#4ADE80',
} as const;

/**
 * Glass Styles for Light Mode
 * Subtle glass effects for light interfaces
 */
export const GLASS_LIGHT = {
  // Backgrounds with varying opacity levels
  background: 'rgba(255, 255, 255, 0.10)',
  backgroundLight: 'rgba(255, 255, 255, 0.05)',
  backgroundMedium: 'rgba(255, 255, 255, 0.15)',
  backgroundHeavy: 'rgba(255, 255, 255, 0.20)',
  backgroundSolid: 'rgba(255, 255, 255, 0.9)',
  backgroundCard: 'rgba(255, 255, 255, 0.95)',

  // Borders with subtle visibility
  border: 'rgba(255, 255, 255, 0.5)',
  borderLight: 'rgba(255, 255, 255, 0.3)',
  borderMedium: 'rgba(255, 255, 255, 0.6)',
  borderHeavy: 'rgba(255, 255, 255, 0.7)',

  // Text colors optimized for light backgrounds
  text: '#1e3a5f',
  textSecondary: '#3d5a80',
  textMuted: '#5c7a9a',
  textDisabled: '#9ca3af',

  // Icon colors
  icon: '#3d5a80',
  iconSecondary: '#5c7a9a',
  iconMuted: '#9ca3af',

  // Accent color for light mode
  accent: '#3d5a80',
} as const;

/**
 * Blur Intensities
 * Use with expo-blur BlurView component
 */
export const BLUR_INTENSITY = {
  none: 0,
  subtle: 15,
  light: 25,
  medium: 40,
  heavy: 60,
  extreme: 80,
} as const;

/**
 * Helper to get glass styles based on theme
 */
export const getGlassStyles = (isDark: boolean) => isDark ? GLASS_DARK : GLASS_LIGHT;

// =============================================================================
// TYPOGRAPHY SYSTEM
// =============================================================================

/**
 * Font Sizes
 * Consistent scale for typography
 */
export const FONT_SIZE = {
  xs: 10,
  sm: 12,
  base: 14,
  md: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
  '6xl': 56,
} as const;

/**
 * Font Weights
 * Standard weight mappings
 */
export const FONT_WEIGHT = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
} as const;

/**
 * Line Heights
 * Multipliers for line-height based on font size
 */
export const LINE_HEIGHT = {
  tight: 1.1,
  normal: 1.4,
  relaxed: 1.6,
  loose: 1.8,
} as const;

/**
 * Letter Spacing
 */
export const LETTER_SPACING = {
  tight: -0.5,
  normal: 0,
  wide: 0.3,
  wider: 0.5,
} as const;

/**
 * Typography Styles
 * Pre-composed text styles for consistent typography
 */
export const TYPOGRAPHY = StyleSheet.create({
  // Display / Hero text
  displayLarge: {
    fontSize: 48,
    fontWeight: '700',
    letterSpacing: -0.5,
    lineHeight: 56,
  },
  displayMedium: {
    fontSize: 40,
    fontWeight: '700',
    letterSpacing: -0.5,
    lineHeight: 48,
  },

  // Titles
  titleLarge: {
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 40,
  },
  titleMedium: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 32,
  },
  titleSmall: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 28,
  },

  // Headings
  heading: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
  },
  subheading: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 22,
  },

  // Body text
  body: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
  },
  bodySmall: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  },

  // Captions and labels
  caption: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    letterSpacing: 0.3,
  },

  // Special styles
  button: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  buttonSmall: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  badge: {
    fontSize: 11,
    fontWeight: '700',
  },
});

// =============================================================================
// SPACING SYSTEM
// =============================================================================

/**
 * Spacing Scale
 * Consistent spacing values based on 4px grid
 */
export const SPACING = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 28,
  '4xl': 32,
  '5xl': 40,
  '6xl': 48,
  '7xl': 56,
  '8xl': 64,
} as const;

/**
 * Component-specific spacing
 */
export const COMPONENT_SPACING = {
  // Screen padding
  screenHorizontal: 16,
  screenVertical: 16,

  // Card spacing
  cardPadding: 16,
  cardPaddingLarge: 18,
  cardMarginHorizontal: 16,
  cardMarginBottom: 12,

  // Input spacing
  inputPaddingHorizontal: 20,
  inputPaddingVertical: 16,

  // Button spacing
  buttonPaddingHorizontal: 24,
  buttonPaddingVertical: 16,
  buttonPaddingHorizontalSmall: 10,
  buttonPaddingVerticalSmall: 6,

  // Tab bar
  tabBarPaddingHorizontal: 8,
  tabBarPaddingVertical: 14,

  // Lists
  listItemGap: 12,
  listSectionGap: 24,
} as const;

// =============================================================================
// BORDER RADIUS SYSTEM
// =============================================================================

/**
 * Border Radius Scale
 * Consistent corner rounding
 */
export const BORDER_RADIUS = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 10,
  lg: 12,
  xl: 16,
  '2xl': 20,
  '3xl': 24,
  '4xl': 28,
  '5xl': 32,
  full: 9999,
} as const;

/**
 * Component-specific border radii
 */
export const COMPONENT_RADIUS = {
  badge: 8,
  button: 16,
  buttonSmall: 10,
  buttonRound: 28,
  card: 20,
  cardLarge: 24,
  input: 12,
  modal: 24,
  tabBar: 32,
  avatar: 9999,
  iconContainer: 12,
  indicator: 28,
} as const;

// =============================================================================
// SHADOW SYSTEM
// =============================================================================

/**
 * Shadow Presets
 * Consistent elevation and depth
 */
export const SHADOWS = {
  none: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  soft: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
  strong: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 12,
  },
  elevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.22,
    shadowRadius: 32,
    elevation: 16,
  },
} as const;

/**
 * Colored shadow helper
 * Creates a shadow with a specific color (useful for buttons)
 */
export const createColoredShadow = (color: string, intensity: 'soft' | 'medium' | 'strong' = 'medium') => {
  const intensityMap = {
    soft: { offset: 4, opacity: 0.25, radius: 8, elevation: 5 },
    medium: { offset: 6, opacity: 0.4, radius: 12, elevation: 8 },
    strong: { offset: 8, opacity: 0.5, radius: 16, elevation: 12 },
  };

  const config = intensityMap[intensity];

  return {
    shadowColor: color,
    shadowOffset: { width: 0, height: config.offset },
    shadowOpacity: config.opacity,
    shadowRadius: config.radius,
    elevation: config.elevation,
  };
};

// =============================================================================
// ANIMATION SYSTEM
// =============================================================================

/**
 * Spring Animation Configs
 * Use with react-native-reanimated withSpring
 */
export const SPRING_CONFIGS = {
  // Quick, snappy interactions
  snappy: {
    damping: 20,
    stiffness: 300,
    mass: 0.6,
  },
  // Standard UI interactions
  default: {
    damping: 15,
    stiffness: 150,
    mass: 0.8,
  },
  // Bouncy, playful animations
  bouncy: {
    damping: 12,
    stiffness: 180,
    mass: 0.6,
  },
  // Gentle, smooth transitions
  gentle: {
    damping: 18,
    stiffness: 100,
    mass: 0.7,
  },
  // Heavy, deliberate movements
  heavy: {
    damping: 25,
    stiffness: 80,
    mass: 1.2,
  },
} as const;

/**
 * Timing Animation Durations (in ms)
 */
export const DURATIONS = {
  instant: 50,
  fast: 150,
  normal: 200,
  slow: 300,
  slower: 400,
  entrance: 400,
  exit: 200,
  pulse: 2000,
  glow: 1500,
} as const;

/**
 * Common Animation Patterns
 */
export const ANIMATION_PATTERNS = {
  // Scale on press
  pressScale: {
    default: 0.98,
    button: 0.95,
    card: 0.97,
    tab: 0.9,
  },
  // Floating/pulse effects
  pulse: {
    scale: { min: 1, max: 1.02 },
    opacity: { min: 0.3, max: 0.6 },
  },
  // Icon lift effect for tabs
  iconLift: {
    translateY: -28,
    scale: 1.25,
  },
} as const;

// =============================================================================
// GRADIENT PRESETS
// =============================================================================

/**
 * Gradient Directions
 * Common start/end points for LinearGradient
 */
export const GRADIENT_DIRECTIONS = {
  horizontal: { start: { x: 0, y: 0 }, end: { x: 1, y: 0 } },
  vertical: { start: { x: 0, y: 0 }, end: { x: 0, y: 1 } },
  diagonal: { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } },
  diagonalReverse: { start: { x: 1, y: 0 }, end: { x: 0, y: 1 } },
} as const;

/**
 * Pre-defined Gradient Colors
 */
export const GRADIENTS = {
  // Premium gold gradients
  premium: ['#D4AF37', '#F5D67B', '#C9A227'] as const,
  premiumSubtle: ['rgba(212, 175, 55, 0.2)', 'rgba(200, 162, 39, 0.15)'] as const,

  // Holographic card gradients (dark mode)
  holographicDark: ['rgba(56, 189, 248, 0.15)', 'rgba(129, 140, 248, 0.12)', 'rgba(244, 114, 182, 0.08)'] as const,
  holographicLight: ['rgba(56, 189, 248, 0.2)', 'rgba(129, 140, 248, 0.15)', 'rgba(244, 114, 182, 0.1)'] as const,

  // Card-specific gradients
  stats: ['rgba(129, 140, 248, 0.2)', 'rgba(167, 139, 250, 0.15)', 'rgba(196, 181, 253, 0.1)'] as const,
  setup: ['#FBBF24', '#F59E0B', '#D97706'] as const,
  inbox: ['#3B82F6', '#6366F1', '#8B5CF6'] as const,
  quest: ['#F472B6', '#818CF8', '#38BDF8'] as const,
  keywords: ['#FF6B35', '#F97316', '#EA580C'] as const,

  // Semantic gradients
  success: ['#22C55E', '#16A34A'] as const,
  error: ['#EF4444', '#DC2626'] as const,
  warning: ['#F59E0B', '#D97706'] as const,
} as const;

// =============================================================================
// HAPTIC FEEDBACK PATTERNS
// =============================================================================

/**
 * Haptic Feedback Types
 * Maps to expo-haptics functions
 */
export const HAPTIC_PATTERNS = {
  // Light feedback for basic interactions
  light: 'selection',
  // Medium feedback for important actions
  medium: 'selection',
  // Heavy feedback for critical actions
  heavy: 'selection',
  // Selection feedback for picker changes
  selection: 'selection',
  // Success notification
  success: 'selection',
  // Warning notification
  warning: 'selection',
  // Error notification
  error: 'selection',
} as const;

// =============================================================================
// COMPONENT SIZE PRESETS
// =============================================================================

/**
 * Standard Component Sizes
 */
export const COMPONENT_SIZES = {
  // Tab bar
  tabWidth: 64,
  tabIndicatorSize: 56,

  // Icons
  iconXs: 12,
  iconSm: 16,
  iconMd: 20,
  iconLg: 24,
  iconXl: 28,
  icon2xl: 32,

  // Avatars
  avatarSm: 32,
  avatarMd: 40,
  avatarLg: 48,
  avatarXl: 56,
  avatar2xl: 64,

  // Buttons
  buttonHeightSm: 32,
  buttonHeightMd: 44,
  buttonHeightLg: 56,
  fabSize: 56,

  // Badges
  badgeMinWidth: 16,
  badgeHeight: 16,
  badgeLargeMinWidth: 20,
  badgeLargeHeight: 20,

  // Icon containers
  iconContainerSm: 32,
  iconContainerMd: 40,
  iconContainerLg: 48,

  // Touch targets (minimum accessible size)
  touchTargetMin: 44,
} as const;

// =============================================================================
// Z-INDEX SYSTEM
// =============================================================================

/**
 * Z-Index Scale
 * Consistent layering for overlapping elements
 */
export const Z_INDEX = {
  base: 0,
  dropdown: 10,
  sticky: 20,
  fixed: 30,
  modal: 40,
  popover: 50,
  tooltip: 60,
  toast: 70,
  overlay: 80,
  max: 9999,
} as const;

// =============================================================================
// TOAST STYLES
// =============================================================================

/**
 * Toast background colors per type and theme
 */
export const TOAST_STYLES = {
  dark: {
    success: 'bg-green-900/95',
    error: 'bg-red-900/95',
    warning: 'bg-amber-900/95',
    info: 'bg-gray-800/95',
  },
  light: {
    success: 'bg-green-50',
    error: 'bg-red-50',
    warning: 'bg-amber-50',
    info: 'bg-white',
  },
  border: {
    success: 'border-green-500',
    error: 'border-red-500',
    warning: 'border-amber-500',
    info: 'border-gray-300', // light mode
    infoDark: 'border-gray-600', // dark mode
  },
  icon: {
    success: '#22c55e',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#6b7280',
    infoDark: '#9ca3af',
  },
} as const;

// =============================================================================
// INPUT STYLES
// =============================================================================

/**
 * Input field styles
 */
export const INPUT_STYLES = {
  default: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 0.5,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: COMPONENT_SPACING.inputPaddingHorizontal,
    paddingVertical: COMPONENT_SPACING.inputPaddingVertical,
  },
  error: {
    borderColor: 'rgba(248, 113, 113, 0.2)',
    backgroundColor: 'rgba(248, 113, 113, 0.05)',
  },
  colors: {
    text: '#FFFFFF',
    placeholder: 'rgba(255, 255, 255, 0.5)',
  },
} as const;

// =============================================================================
// EXPORTED DESIGN SYSTEM OBJECT
// =============================================================================

/**
 * Main Design System Export
 * Access all design tokens from a single object
 */
export const DS = {
  // Colors
  colors: {
    primary: PRIMARY_COLORS,
    accent: ACCENT_COLORS,
    premium: PREMIUM_COLORS,
    semantic: SEMANTIC_COLORS,
    neutrals: NEUTRALS,
  },

  // Glass/Frosted effects
  glass: {
    dark: GLASS_DARK,
    light: GLASS_LIGHT,
    blur: BLUR_INTENSITY,
    get: getGlassStyles,
  },

  // Typography
  typography: TYPOGRAPHY,
  fontSize: FONT_SIZE,
  fontWeight: FONT_WEIGHT,
  lineHeight: LINE_HEIGHT,
  letterSpacing: LETTER_SPACING,

  // Layout
  spacing: SPACING,
  componentSpacing: COMPONENT_SPACING,
  radius: BORDER_RADIUS,
  componentRadius: COMPONENT_RADIUS,

  // Effects
  shadows: SHADOWS,
  createColoredShadow,
  gradients: GRADIENTS,
  gradientDirections: GRADIENT_DIRECTIONS,

  // Animation
  spring: SPRING_CONFIGS,
  durations: DURATIONS,
  animation: ANIMATION_PATTERNS,

  // Components
  sizes: COMPONENT_SIZES,
  zIndex: Z_INDEX,

  // Feedback
  haptics: HAPTIC_PATTERNS,

  // Specific component styles
  toast: TOAST_STYLES,
  input: INPUT_STYLES,
} as const;

// Default export
export default DS;

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type PrimaryColor = keyof typeof PRIMARY_COLORS;
export type AccentColor = keyof typeof ACCENT_COLORS;
export type NeutralColor = keyof typeof NEUTRALS;
export type SpacingSize = keyof typeof SPACING;
export type RadiusSize = keyof typeof BORDER_RADIUS;
export type ShadowLevel = keyof typeof SHADOWS;
export type BlurLevel = keyof typeof BLUR_INTENSITY;
export type SpringConfig = keyof typeof SPRING_CONFIGS;
export type Duration = keyof typeof DURATIONS;
