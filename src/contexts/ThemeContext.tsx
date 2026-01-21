import React, { createContext, useContext, useEffect } from 'react';
import { Appearance } from 'react-native';
import useThemeStore, { ThemeMode, ActiveTheme } from '../state/themeStore';

interface ThemeContextType {
  themeMode: ThemeMode;
  activeTheme: ActiveTheme;
  isSystemTheme: boolean;
  setThemeMode: (mode: ThemeMode) => void;
  isDark: boolean;
  isLight: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const themeMode = useThemeStore(s => s.themeMode);
  const activeTheme = useThemeStore(s => s.activeTheme);
  const isSystemTheme = useThemeStore(s => s.isSystemTheme);
  const setThemeMode = useThemeStore(s => s.setThemeMode);

  useEffect(() => {
    // Initialize theme on mount only
    const currentThemeMode = useThemeStore.getState().themeMode;
    const resolvedTheme = currentThemeMode === 'system'
      ? (Appearance.getColorScheme() === 'dark' ? 'dark' : 'light')
      : currentThemeMode;

    useThemeStore.setState({
      activeTheme: resolvedTheme,
      isSystemTheme: currentThemeMode === 'system',
    });

    // Listen for system theme changes if using system mode
    if (currentThemeMode === 'system') {
      const subscription = Appearance.addChangeListener(({ colorScheme }) => {
        const newActiveTheme = colorScheme === 'dark' ? 'dark' : 'light';
        useThemeStore.setState({ activeTheme: newActiveTheme });
      });

      return () => {
        subscription?.remove();
      };
    }
  }, [themeMode]); // React to theme mode changes

  const value: ThemeContextType = {
    themeMode,
    activeTheme,
    isSystemTheme,
    setThemeMode,
    isDark: activeTheme === 'dark',
    isLight: activeTheme === 'light',
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeContext;