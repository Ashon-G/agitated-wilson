/**
 * App Color Palette
 * Premium minimal theme - neutral base with accent colors
 */

export const COLORS = {
  // Primary neutral palette (premium dark)
  primary: {
    50: '#FAFAFA',   // Near white
    100: '#F4F4F5',  // Light gray
    200: '#E4E4E7',  // Soft gray
    300: '#D4D4D8',  // Medium light gray
    400: '#A1A1AA',  // Medium gray
    500: '#71717A',  // Base gray
    600: '#52525B',  // Dark gray
    700: '#3F3F46',  // Darker gray
    800: '#27272A',  // Very dark gray
    900: '#18181B',  // Near black
  },

  // Accent color - used sparingly for emphasis
  accent: {
    primary: '#22C55E',   // Green - main accent
    blue: '#3B82F6',
    yellow: '#FBBF24',
    orange: '#F97316',
    red: '#EF4444',
    purple: '#8B5CF6',
    cyan: '#06B6D4',
  },

  // Semantic colors
  semantic: {
    success: '#22C55E',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
  },

  // Background colors for premium feel
  background: {
    dark: '#0C0C0E',      // Deep black
    darkElevated: '#141416', // Slightly elevated
    darkCard: '#1A1A1D',  // Card background
    light: '#FAFAFA',
    lightElevated: '#FFFFFF',
    lightCard: '#FFFFFF',
  },
} as const;

// Legacy mappings for backward compatibility
export const TAILWIND_GREEN = {
  'bg-purple-50': 'bg-zinc-50',
  'bg-purple-100': 'bg-zinc-100',
  'bg-purple-500': 'bg-zinc-500',
  'bg-purple-600': 'bg-zinc-600',
  'bg-purple-800': 'bg-zinc-800',
  'text-purple-50': 'text-zinc-50',
  'text-purple-100': 'text-zinc-100',
  'text-purple-500': 'text-zinc-500',
  'text-purple-600': 'text-zinc-600',
  'text-purple-800': 'text-zinc-800',
  'border-purple-500': 'border-zinc-500',
  'border-purple-600': 'border-zinc-600',
} as const;

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
    : { r: 34, g: 197, b: 94 }; // Fallback to green
}

/**
 * Convert RGB to hex color
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const hex = Math.round(Math.max(0, Math.min(255, n))).toString(16);
    return hex.length === 1 ? `0${  hex}` : hex;
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
 * Glassmorphism / Frosted Glass Utilities
 *
 * Premium minimal glass effects - subtle, elegant, understated
 */
export const GLASS = {
  // Dark mode glass backgrounds - more refined, less opacity
  dark: {
    background: 'rgba(12, 12, 14, 0.75)',
    backgroundLight: 'rgba(20, 20, 22, 0.6)',
    backgroundMedium: 'rgba(12, 12, 14, 0.85)',
    backgroundHeavy: 'rgba(12, 12, 14, 0.92)',
    border: 'rgba(255, 255, 255, 0.08)',
    borderLight: 'rgba(255, 255, 255, 0.05)',
    borderMedium: 'rgba(255, 255, 255, 0.12)',
    text: '#FAFAFA',
    textSecondary: 'rgba(250, 250, 250, 0.7)',
    textMuted: 'rgba(250, 250, 250, 0.5)',
    icon: '#FAFAFA',
    iconSecondary: 'rgba(250, 250, 250, 0.6)',
    accent: '#22C55E',
  },
  // Light mode glass backgrounds - cleaner, more minimal
  light: {
    background: 'rgba(255, 255, 255, 0.85)',
    backgroundLight: 'rgba(255, 255, 255, 0.7)',
    backgroundMedium: 'rgba(255, 255, 255, 0.9)',
    backgroundHeavy: 'rgba(255, 255, 255, 0.95)',
    border: 'rgba(0, 0, 0, 0.06)',
    borderLight: 'rgba(0, 0, 0, 0.04)',
    borderMedium: 'rgba(0, 0, 0, 0.08)',
    text: '#18181B',
    textSecondary: 'rgba(24, 24, 27, 0.7)',
    textMuted: 'rgba(24, 24, 27, 0.5)',
    icon: '#27272A',
    iconSecondary: 'rgba(39, 39, 46, 0.6)',
    accent: '#16A34A',
  },
  // Blur intensities - reduced for performance and subtlety
  blur: {
    subtle: 12,
    light: 20,
    medium: 32,
    heavy: 48,
  },
  // Shadow configurations - softer, more subtle
  shadow: {
    soft: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 8,
      elevation: 2,
    },
    medium: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
      elevation: 4,
    },
    strong: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.1,
      shadowRadius: 20,
      elevation: 8,
    },
  },
} as const;

/**
 * Get glass styles based on theme
 */
export function getGlassStyles(isDark: boolean) {
  return isDark ? GLASS.dark : GLASS.light;
}

/**
 * Get gradient colors for glass cards based on accent color
 */
export function getGlassGradient(accentColor: string, isDark: boolean): [string, string, string] {
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
export function getGlassBorderGradient(accentColor: string, isDark: boolean): [string, string, string] {
  const { r, g, b } = hexToRgb(accentColor);
  const baseOpacity = isDark ? 0.4 : 0.3;

  return [
    `rgba(${r}, ${g}, ${b}, ${baseOpacity})`,
    `rgba(${r}, ${g}, ${b}, ${baseOpacity * 0.6})`,
    `rgba(${r}, ${g}, ${b}, ${baseOpacity * 0.3})`,
  ];
}