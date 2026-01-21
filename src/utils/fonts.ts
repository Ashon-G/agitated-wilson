/**
 * Font utilities for the app
 * Using system fonts for better compatibility
 */

// Font styles for heading hierarchy using system fonts
export const fontStyles = {
  // H1 - Main page titles, hero text
  titleLarge: {
    fontSize: 32,
    fontWeight: '700' as const,
  },
  // H2 - Major section headers, modal titles
  titleMedium: {
    fontSize: 24,
    fontWeight: '700' as const,
  },
  // H3 - Subsection headers, card section titles
  titleSmall: {
    fontSize: 20,
    fontWeight: '600' as const,
  },
  // H4 - Minor headers, list titles, card titles
  heading: {
    fontSize: 18,
    fontWeight: '600' as const,
  },
  // Subheading - Supporting text
  subheading: {
    fontSize: 16,
    fontWeight: '500' as const,
  },
  // Body text
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
  },
  bodySmall: {
    fontSize: 14,
    fontWeight: '400' as const,
  },
  caption: {
    fontSize: 12,
    fontWeight: '400' as const,
  },
} as const;
