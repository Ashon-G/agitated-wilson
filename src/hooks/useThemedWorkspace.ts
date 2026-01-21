import { useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useWorkspaceColor } from './useWorkspaceColor';
import { getGlassStyles, GLASS } from '../utils/colors';

/**
 * Combined hook for theme + workspace color
 * Reduces boilerplate by combining two commonly-used hooks
 *
 * Usage:
 * const { isDark, color, glass, colorWithOpacity } = useThemedWorkspace();
 */
export function useThemedWorkspace() {
  const { isDark, isLight, activeTheme, themeMode, setThemeMode } = useTheme();
  const workspaceColor = useWorkspaceColor();

  return useMemo(
    () => ({
      // Theme properties
      isDark,
      isLight,
      activeTheme,
      themeMode,
      setThemeMode,

      // Glass styles for current theme
      glass: getGlassStyles(isDark),
      blur: GLASS.blur,
      shadow: GLASS.shadow,

      // Workspace color properties
      color: workspaceColor.color,
      colorWithOpacity: workspaceColor.colorWithOpacity,
      getLighterShade: workspaceColor.getLighterShade,
      getDarkerShade: workspaceColor.getDarkerShade,
      getContrastText: workspaceColor.getContrastText,
      gradientColors: workspaceColor.gradientColors,

      // Convenience getters for common glass backgrounds
      glassBackground: isDark ? GLASS.dark.background : GLASS.light.background,
      glassBorder: isDark ? GLASS.dark.border : GLASS.light.border,
      textColor: isDark ? GLASS.dark.text : GLASS.light.text,
      textSecondary: isDark ? GLASS.dark.textSecondary : GLASS.light.textSecondary,
      textMuted: isDark ? GLASS.dark.textMuted : GLASS.light.textMuted,
    }),
    [isDark, isLight, activeTheme, themeMode, setThemeMode, workspaceColor],
  );
}
