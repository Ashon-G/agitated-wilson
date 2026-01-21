import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ActiveTheme = 'light' | 'dark';

interface ThemeStore {
  themeMode: ThemeMode;
  activeTheme: ActiveTheme;
  isSystemTheme: boolean;

  // Actions
  setThemeMode: (mode: ThemeMode) => void;
  getActiveTheme: () => ActiveTheme;
  initializeTheme: () => void;
}

// Function to determine active theme based on mode and system preference
const resolveActiveTheme = (mode: ThemeMode): ActiveTheme => {
  if (mode === 'system') {
    return Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
  }
  return mode;
};

const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      themeMode: 'system' as ThemeMode,
      activeTheme: 'light' as ActiveTheme,
      isSystemTheme: true,

      setThemeMode: (mode: ThemeMode) => {
        const activeTheme = resolveActiveTheme(mode);
        const isSystemTheme = mode === 'system';

        set({
          themeMode: mode,
          activeTheme,
          isSystemTheme,
        });
      },

      getActiveTheme: () => {
        const { themeMode } = get();
        return resolveActiveTheme(themeMode);
      },

      initializeTheme: () => {
        const { themeMode } = get();
        const activeTheme = resolveActiveTheme(themeMode);

        set({
          activeTheme,
          isSystemTheme: themeMode === 'system',
        });

        // Listen for system theme changes if using system mode
        if (themeMode === 'system') {
          const subscription = Appearance.addChangeListener(({ colorScheme }) => {
            const newActiveTheme = colorScheme === 'dark' ? 'dark' : 'light';
            set({ activeTheme: newActiveTheme });
          });

          // Return cleanup function (though we don't use it in this simple implementation)
          return () => subscription?.remove();
        }
      },
    }),
    {
      name: 'theme-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        themeMode: state.themeMode,
      }),
    },
  ),
);

export default useThemeStore;