/**
 * TAVA DESIGN SYSTEM - UTILITIES
 * ===============================
 * Helper functions for working with colors, themes, and dynamic styling.
 */

import { getGlassStyles } from './index';

// =============================================================================
// COLOR MANIPULATION UTILITIES
// =============================================================================

/**
 * Convert hex color to RGB object
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    }
    : { r: 34, g: 197, b: 94 }; // Fallback to primary green
}

/**
 * Convert RGB to hex color
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const hex = Math.round(Math.max(0, Math.min(255, n))).toString(16);
    return hex.length === 1 ? `0${hex}` : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Convert hex color to rgba string with alpha
 */
export function hexToRgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Mix two colors together
 * @param color1 - First hex color
 * @param color2 - Second hex color
 * @param ratio - Mix ratio (0 = 100% color1, 1 = 100% color2)
 */
export function mixColors(color1: string, color2: string, ratio: number): string {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);

  const r = rgb1.r + (rgb2.r - rgb1.r) * ratio;
  const g = rgb1.g + (rgb2.g - rgb1.g) * ratio;
  const b = rgb1.b + (rgb2.b - rgb1.b) * ratio;

  return rgbToHex(r, g, b);
}

/**
 * Lighten a color by a percentage
 * @param hex - Hex color
 * @param percent - Percentage to lighten (0-100)
 */
export function lighten(hex: string, percent: number): string {
  return mixColors(hex, '#FFFFFF', percent / 100);
}

/**
 * Darken a color by a percentage
 * @param hex - Hex color
 * @param percent - Percentage to darken (0-100)
 */
export function darken(hex: string, percent: number): string {
  return mixColors(hex, '#000000', percent / 100);
}

/**
 * Get luminance of a color (0-255)
 * Used to determine if text should be light or dark
 */
export function getLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Get contrasting text color (white or black) for given background
 */
export function getContrastColor(hex: string): '#FFFFFF' | '#000000' {
  return getLuminance(hex) > 128 ? '#000000' : '#FFFFFF';
}

/**
 * Check if a color is dark
 */
export function isColorDark(hex: string): boolean {
  return getLuminance(hex) < 128;
}

/**
 * Get darker version of a color for light mode
 * Maps common colors to their darker equivalents
 */
export function getDarkerVariant(color: string): string {
  const colorMap: Record<string, string> = {
    '#38BDF8': '#0369a1', // sky blue -> darker blue
    '#F472B6': '#be185d', // pink -> darker pink/magenta
    '#A78BFA': '#6d28d9', // purple -> darker purple
    '#22C55E': '#15803d', // green -> darker green
    '#818CF8': '#4338ca', // indigo -> darker indigo
    '#EF4444': '#b91c1c', // red -> darker red
    '#F59E0B': '#d97706', // amber -> darker amber
    '#3B82F6': '#1d4ed8', // blue -> darker blue
  };
  return colorMap[color] || darken(color, 20);
}

// =============================================================================
// GRADIENT UTILITIES
// =============================================================================

/**
 * Get gradient colors for glass cards based on accent color
 */
export function getGlassGradient(
  accentColor: string,
  isDark: boolean,
): [string, string, string] {
  const { r, g, b } = hexToRgb(accentColor);

  if (isDark) {
    return [
      `rgba(${r}, ${g}, ${b}, 0.15)`,
      `rgba(${r}, ${g}, ${b}, 0.08)`,
      `rgba(${r}, ${g}, ${b}, 0.03)`,
    ];
  }

  return [
    `rgba(${r}, ${g}, ${b}, 0.12)`,
    `rgba(${r}, ${g}, ${b}, 0.06)`,
    `rgba(${r}, ${g}, ${b}, 0.02)`,
  ];
}

/**
 * Get border gradient colors based on accent color
 */
export function getGlassBorderGradient(
  accentColor: string,
  isDark: boolean,
): [string, string, string] {
  const { r, g, b } = hexToRgb(accentColor);
  const baseOpacity = isDark ? 0.4 : 0.3;

  return [
    `rgba(${r}, ${g}, ${b}, ${baseOpacity})`,
    `rgba(${r}, ${g}, ${b}, ${baseOpacity * 0.6})`,
    `rgba(${r}, ${g}, ${b}, ${baseOpacity * 0.3})`,
  ];
}

/**
 * Create a transparent color overlay
 */
export function createOverlay(color: string, opacity: number): string {
  return hexToRgba(color, opacity);
}

// =============================================================================
// THEME UTILITIES
// =============================================================================

/**
 * Get theme-appropriate text color
 */
export function getTextColor(
  isDark: boolean,
  variant: 'primary' | 'secondary' | 'muted' = 'primary',
): string {
  const glass = getGlassStyles(isDark);

  switch (variant) {
    case 'secondary':
      return glass.textSecondary;
    case 'muted':
      return glass.textMuted;
    default:
      return glass.text;
  }
}

/**
 * Get theme-appropriate background color
 */
export function getBackgroundColor(
  isDark: boolean,
  variant: 'default' | 'light' | 'medium' | 'heavy' | 'solid' = 'default',
): string {
  const glass = getGlassStyles(isDark);

  switch (variant) {
    case 'light':
      return glass.backgroundLight;
    case 'medium':
      return glass.backgroundMedium;
    case 'heavy':
      return glass.backgroundHeavy;
    case 'solid':
      return isDark ? 'rgba(17, 24, 39, 0.85)' : 'rgba(255, 255, 255, 0.9)';
    default:
      return glass.background;
  }
}

/**
 * Get theme-appropriate border color
 */
export function getBorderColor(
  isDark: boolean,
  variant: 'default' | 'light' | 'medium' = 'default',
): string {
  const glass = getGlassStyles(isDark);

  switch (variant) {
    case 'light':
      return glass.borderLight;
    case 'medium':
      return glass.borderMedium;
    default:
      return glass.border;
  }
}

// =============================================================================
// STYLE GENERATION UTILITIES
// =============================================================================

/**
 * Create a colored icon container style
 * @param color - Base color for the container
 * @param isDark - Whether dark mode is active
 */
export function createIconContainerStyle(color: string, isDark: boolean) {
  const iconColor = isDark ? color : getDarkerVariant(color);

  return {
    backgroundColor: `${iconColor}20`,
    borderWidth: 1,
    borderColor: `${iconColor}30`,
  };
}

/**
 * Create a tinted card style (for selected/active states)
 * @param color - Accent color
 */
export function createTintedCardStyle(color: string) {
  return {
    backgroundColor: `${color}15`,
    borderColor: color,
    borderWidth: 1,
  };
}

/**
 * Generate styles for a status badge
 */
export function createStatusBadgeStyle(
  status: 'success' | 'error' | 'warning' | 'info',
  isDark: boolean,
) {
  const colors = {
    success: { bg: '#22C55E', bgDark: '#15803d' },
    error: { bg: '#EF4444', bgDark: '#b91c1c' },
    warning: { bg: '#F59E0B', bgDark: '#d97706' },
    info: { bg: '#3B82F6', bgDark: '#1d4ed8' },
  };

  const statusColor = colors[status];

  return {
    backgroundColor: isDark ? statusColor.bg : statusColor.bgDark,
    color: '#FFFFFF',
  };
}

// =============================================================================
// ANIMATION UTILITIES
// =============================================================================

/**
 * Calculate spring animation config based on gesture velocity
 */
export function getVelocityBasedSpring(velocity: number) {
  const absVelocity = Math.abs(velocity);

  if (absVelocity > 1000) {
    return { damping: 12, stiffness: 200, mass: 0.6 };
  }

  if (absVelocity > 500) {
    return { damping: 15, stiffness: 150, mass: 0.7 };
  }

  return { damping: 18, stiffness: 100, mass: 0.8 };
}

/**
 * Get entrance animation delay for staggered lists
 * @param index - Item index in the list
 * @param baseDelay - Base delay in ms (default 50)
 */
export function getStaggerDelay(index: number, baseDelay: number = 50): number {
  return index * baseDelay;
}

// =============================================================================
// ACCESSIBILITY UTILITIES
// =============================================================================

/**
 * Check if color contrast ratio meets WCAG requirements
 * @param foreground - Text color
 * @param background - Background color
 * @param level - 'AA' or 'AAA' (default 'AA')
 */
export function meetsContrastRequirement(
  foreground: string,
  background: string,
  level: 'AA' | 'AAA' = 'AA',
): boolean {
  const getLum = (hex: string) => {
    const { r, g, b } = hexToRgb(hex);
    const [rs, gs, bs] = [r, g, b].map((c) => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  };

  const l1 = getLum(foreground);
  const l2 = getLum(background);
  const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

  return level === 'AAA' ? ratio >= 7 : ratio >= 4.5;
}

/**
 * Get minimum touch target size for accessibility
 */
export function getMinTouchTarget(): number {
  return 44; // Apple HIG minimum
}

// =============================================================================
// EXPORTS
// =============================================================================

export const ColorUtils = {
  hexToRgb,
  rgbToHex,
  hexToRgba,
  mixColors,
  lighten,
  darken,
  getLuminance,
  getContrastColor,
  isColorDark,
  getDarkerVariant,
};

export const GradientUtils = {
  getGlassGradient,
  getGlassBorderGradient,
  createOverlay,
};

export const ThemeUtils = {
  getTextColor,
  getBackgroundColor,
  getBorderColor,
};

export const StyleUtils = {
  createIconContainerStyle,
  createTintedCardStyle,
  createStatusBadgeStyle,
};

export const AnimationUtils = {
  getVelocityBasedSpring,
  getStaggerDelay,
};

export const AccessibilityUtils = {
  meetsContrastRequirement,
  getMinTouchTarget,
};
