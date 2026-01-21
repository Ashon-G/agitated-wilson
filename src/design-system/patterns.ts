/**
 * TAVA DESIGN SYSTEM - COMPONENT PATTERNS
 * ========================================
 * Pre-built style patterns for common components.
 * Import these patterns and apply them to your components for consistency.
 *
 * Usage:
 *   import { ComponentPatterns } from '@/design-system/patterns';
 *
 *   <View style={ComponentPatterns.card.glass} />
 */

import { StyleSheet, ViewStyle, TextStyle } from 'react-native';
import {
  DS,
  GLASS_DARK,
  GLASS_LIGHT,
  SHADOWS,
  BORDER_RADIUS,
  SPACING,
  COMPONENT_SPACING,
  FONT_SIZE,
  FONT_WEIGHT,
} from './index';

// =============================================================================
// CARD PATTERNS
// =============================================================================

export const CardPatterns = StyleSheet.create({
  // Standard glass card (dark mode)
  glassDark: {
    borderRadius: BORDER_RADIUS['2xl'],
    overflow: 'hidden',
    marginHorizontal: COMPONENT_SPACING.cardMarginHorizontal,
    marginBottom: COMPONENT_SPACING.cardMarginBottom,
    backgroundColor: GLASS_DARK.background,
    borderWidth: 0.5,
    borderColor: GLASS_DARK.border,
    padding: COMPONENT_SPACING.cardPaddingLarge,
  },

  // Standard glass card (light mode)
  glassLight: {
    borderRadius: BORDER_RADIUS['2xl'],
    overflow: 'hidden',
    marginHorizontal: COMPONENT_SPACING.cardMarginHorizontal,
    marginBottom: COMPONENT_SPACING.cardMarginBottom,
    backgroundColor: GLASS_LIGHT.backgroundSolid,
    borderWidth: 0.5,
    borderColor: GLASS_LIGHT.border,
    padding: COMPONENT_SPACING.cardPaddingLarge,
  },

  // Holographic card with shadow
  holographic: {
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    ...SHADOWS.elevated,
  },

  // Elevated card
  elevated: {
    borderRadius: BORDER_RADIUS['2xl'],
    backgroundColor: 'rgba(17, 24, 39, 0.85)',
    ...SHADOWS.medium,
  },

  // Flat card (no shadow)
  flat: {
    borderRadius: BORDER_RADIUS['2xl'],
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: SPACING.lg,
  },
});

// =============================================================================
// BUTTON PATTERNS
// =============================================================================

export const ButtonPatterns = StyleSheet.create({
  // Primary filled button
  primary: {
    borderRadius: BORDER_RADIUS.xl,
    paddingVertical: COMPONENT_SPACING.buttonPaddingVertical,
    paddingHorizontal: COMPONENT_SPACING.buttonPaddingHorizontal,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },

  // Secondary/outline button
  secondary: {
    borderRadius: BORDER_RADIUS.xl,
    paddingVertical: COMPONENT_SPACING.buttonPaddingVertical,
    paddingHorizontal: COMPONENT_SPACING.buttonPaddingHorizontal,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },

  // Small/compact button
  compact: {
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: COMPONENT_SPACING.buttonPaddingVerticalSmall,
    paddingHorizontal: COMPONENT_SPACING.buttonPaddingHorizontalSmall,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },

  // Floating action button (FAB)
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.medium,
  },

  // Icon button
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Pressed state
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
});

// =============================================================================
// INPUT PATTERNS
// =============================================================================

export const InputPatterns = StyleSheet.create({
  // Standard text input container
  container: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden',
  },

  // Input field
  input: {
    paddingHorizontal: COMPONENT_SPACING.inputPaddingHorizontal,
    paddingVertical: COMPONENT_SPACING.inputPaddingVertical,
    fontSize: FONT_SIZE.md,
    color: '#FFFFFF',
    fontWeight: FONT_WEIGHT.regular,
  },

  // Error state container
  containerError: {
    borderColor: 'rgba(248, 113, 113, 0.2)',
    backgroundColor: 'rgba(248, 113, 113, 0.05)',
  },

  // Label above input
  label: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    marginBottom: SPACING.xs,
  },

  // Helper/error text below input
  helperText: {
    fontSize: FONT_SIZE.sm,
    marginTop: SPACING.xs,
  },
});

// =============================================================================
// TAB BAR PATTERNS
// =============================================================================

export const TabBarPatterns = StyleSheet.create({
  // Floating tab bar container
  container: {
    borderRadius: BORDER_RADIUS['5xl'],
    overflow: 'hidden',
    ...SHADOWS.medium,
  },

  // Tab bar inner content
  content: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: COMPONENT_SPACING.tabBarPaddingHorizontal,
    paddingVertical: COMPONENT_SPACING.tabBarPaddingVertical,
  },

  // Individual tab
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 64,
    height: 48,
  },

  // Tab indicator (pill behind active tab)
  indicator: {
    width: 56,
    height: 56,
    borderRadius: 28,
    position: 'absolute',
  },

  // Notification badge
  badge: {
    position: 'absolute',
    top: 2,
    right: 10,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Badge text
  badgeText: {
    color: 'white',
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
  },
});

// =============================================================================
// ICON CONTAINER PATTERNS
// =============================================================================

export const IconContainerPatterns = StyleSheet.create({
  // Small icon container
  sm: {
    width: 32,
    height: 32,
    borderRadius: BORDER_RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Medium icon container
  md: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Large icon container
  lg: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Circular
  circular: {
    borderRadius: 9999,
  },
});

// =============================================================================
// BADGE PATTERNS
// =============================================================================

export const BadgePatterns = StyleSheet.create({
  // Default badge
  default: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },

  // Small badge (for tabs)
  small: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Dot badge (no text)
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Badge text
  text: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

// =============================================================================
// MODAL PATTERNS
// =============================================================================

export const ModalPatterns = StyleSheet.create({
  // Backdrop/overlay
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Modal container
  container: {
    borderRadius: BORDER_RADIUS['3xl'],
    overflow: 'hidden',
    marginHorizontal: SPACING.lg,
    maxWidth: 400,
    width: '100%',
  },

  // Modal content
  content: {
    padding: SPACING['2xl'],
  },

  // Modal header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },

  // Modal footer (actions)
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
    marginTop: SPACING.xl,
  },
});

// =============================================================================
// LIST PATTERNS
// =============================================================================

export const ListPatterns = StyleSheet.create({
  // List container
  container: {
    gap: COMPONENT_SPACING.listItemGap,
  },

  // List item
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    gap: SPACING.md,
  },

  // List item with press state
  itemPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    gap: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
  },

  // Divider between items
  divider: {
    height: 1,
    marginLeft: SPACING.lg,
  },

  // Section header
  sectionHeader: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    marginTop: COMPONENT_SPACING.listSectionGap,
  },
});

// =============================================================================
// TOAST PATTERNS
// =============================================================================

export const ToastPatterns = StyleSheet.create({
  // Toast container
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.xl,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderLeftWidth: 4,
    ...SHADOWS.medium,
  },

  // Toast icon
  icon: {
    marginRight: SPACING.md,
  },

  // Toast content
  content: {
    flex: 1,
    marginRight: SPACING.sm,
  },

  // Toast message
  message: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.medium,
  },

  // Toast action button
  action: {
    paddingHorizontal: SPACING.sm,
  },

  // Toast dismiss button
  dismiss: {
    marginLeft: SPACING.sm,
  },
});

// =============================================================================
// LAYOUT PATTERNS
// =============================================================================

export const LayoutPatterns = StyleSheet.create({
  // Screen container
  screen: {
    flex: 1,
  },

  // Centered content
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Row layout
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Row with space between
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  // Column layout
  column: {
    flexDirection: 'column',
  },

  // Fill available space
  fill: {
    flex: 1,
  },

  // Absolute fill
  absoluteFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});

// =============================================================================
// EXPORT ALL PATTERNS
// =============================================================================

export const ComponentPatterns = {
  card: CardPatterns,
  button: ButtonPatterns,
  input: InputPatterns,
  tabBar: TabBarPatterns,
  iconContainer: IconContainerPatterns,
  badge: BadgePatterns,
  modal: ModalPatterns,
  list: ListPatterns,
  toast: ToastPatterns,
  layout: LayoutPatterns,
};

export default ComponentPatterns;
