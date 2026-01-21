import { useMemo } from 'react';
import useWorkspaceStore from '../state/workspaceStore';
import { hexToRgb, rgbToHex, hexToRgba, mixColors, getContrastColor } from '../utils/colors';

/**
 * Hook that provides dynamic workspace color theming
 * Returns the current workspace's color and helper functions for creating color variations
 */
export function useWorkspaceColor() {
  // Use a selector to only subscribe to the color, not the entire workspace object
  const baseColor = useWorkspaceStore(s => s.currentWorkspace?.color) || '#22C55E';

  return useMemo(() => {
    /**
     * Get workspace color with opacity
     * @param alpha - Opacity value between 0 and 1
     */
    const colorWithOpacity = (alpha: number): string => {
      return hexToRgba(baseColor, alpha);
    };

    /**
     * Get lighter shade of workspace color
     * @param amount - Amount to lighten (0-1, where 0.1 = 10% lighter)
     */
    const getLighterShade = (amount: number): string => {
      return mixColors(baseColor, '#FFFFFF', amount);
    };

    /**
     * Get darker shade of workspace color
     * @param amount - Amount to darken (0-1, where 0.1 = 10% darker)
     */
    const getDarkerShade = (amount: number): string => {
      return mixColors(baseColor, '#000000', amount);
    };

    /**
     * Get text color that contrasts well with workspace color
     * Returns white or black based on luminance
     */
    const getContrastText = (): string => {
      return getContrastColor(baseColor);
    };

    /**
     * Get gradient colors for workspace color
     * Returns [lighter, base, darker] for smooth gradients
     */
    const gradientColors: [string, string, string] = [
      getLighterShade(0.3),
      baseColor,
      getDarkerShade(0.2),
    ];

    return {
      color: baseColor,
      colorWithOpacity,
      getLighterShade,
      getDarkerShade,
      getContrastText,
      gradientColors,
    };
  }, [baseColor]);
}
