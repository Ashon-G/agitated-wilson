/**
 * Performance Configuration
 *
 * Centralized performance settings to reduce heat and improve speed.
 * Adjust these values based on device capabilities.
 */

export const PERFORMANCE_CONFIG = {
  // 3D Agent Settings
  agent3D: {
    // Reduce WebView rendering quality for better performance
    pixelRatio: 1.5, // Lower = better performance (default is device pixel ratio ~3)
    shadowQuality: 'low', // 'off' | 'low' | 'medium' | 'high'
    antialiasing: false, // Disable for better performance
    useSimplifiedModel: false, // Future: Use lower poly models
  },

  // Animation Settings
  animations: {
    // Reduce reanimated worklet calls
    enableComplexAnimations: true, // Disable genie animations on low-end devices
    reducedMotion: false, // Respect system preference
    maxConcurrentAnimations: 3, // Limit simultaneous animations

    // Spring animation settings (less intensive)
    springConfig: {
      damping: 20,
      stiffness: 120, // Lower = smoother but slower
      mass: 1,
    },
  },

  // Dashboard Settings
  dashboard: {
    // Throttle card updates
    updateThrottleMs: 500, // Minimum time between re-renders
    maxVisibleCards: 4, // Limit cards to reduce render load
    enableBlurEffects: true, // Blur effects are expensive
    cardAnimationStaggerMs: 50, // Delay between card animations
  },

  // WebView Settings
  webView: {
    // Reduce WebView overhead
    androidLayerType: 'software', // 'none' | 'software' | 'hardware'
    cacheEnabled: true,
    allowsInlineMediaPlayback: true,
  },

  // Update Frequencies
  updates: {
    // Reduce polling/refresh rates
    inboxPollIntervalMs: 30000, // 30 seconds (was likely more frequent)
    questCheckIntervalMs: 60000, // 1 minute
    profileRefreshIntervalMs: 300000, // 5 minutes
  },

  // Memory Management
  memory: {
    // Cleanup intervals
    imageCleanupIntervalMs: 60000, // Clear unused images every minute
    cacheMaxAge: 3600000, // 1 hour max cache age
    maxCacheSize: 50 * 1024 * 1024, // 50MB cache limit
  },

  // Platform-specific overrides
  platform: {
    ios: {
      // iOS-specific performance tweaks
      useNativeDriver: true, // Always use native driver on iOS
      optimizeMemoryUsage: true,
    },
    android: {
      // Android-specific performance tweaks
      useNativeDriver: true,
      enableRenderOptimizations: true,
    },
    web: {
      // Web has different constraints
      pixelRatio: 2, // Lower for web
    },
  },
};

/**
 * Performance Mode Presets
 */
export const PERFORMANCE_MODES = {
  // Maximum quality, may cause heat on older devices
  high: {
    ...PERFORMANCE_CONFIG,
    agent3D: {
      pixelRatio: 2,
      shadowQuality: 'medium',
      antialiasing: true,
      useSimplifiedModel: false,
    },
    animations: {
      ...PERFORMANCE_CONFIG.animations,
      enableComplexAnimations: true,
    },
    dashboard: {
      ...PERFORMANCE_CONFIG.dashboard,
      enableBlurEffects: true,
    },
  },

  // Balanced performance and quality
  balanced: PERFORMANCE_CONFIG,

  // Maximum performance, minimal heat
  performance: {
    ...PERFORMANCE_CONFIG,
    agent3D: {
      pixelRatio: 1,
      shadowQuality: 'off',
      antialiasing: false,
      useSimplifiedModel: true,
    },
    animations: {
      ...PERFORMANCE_CONFIG.animations,
      enableComplexAnimations: false,
      maxConcurrentAnimations: 2,
    },
    dashboard: {
      ...PERFORMANCE_CONFIG.dashboard,
      updateThrottleMs: 1000,
      maxVisibleCards: 3,
      enableBlurEffects: false,
      cardAnimationStaggerMs: 100,
    },
    updates: {
      inboxPollIntervalMs: 60000, // 1 minute
      questCheckIntervalMs: 120000, // 2 minutes
      profileRefreshIntervalMs: 600000, // 10 minutes
    },
  },
};

/**
 * Get current performance mode from storage or default to balanced
 */
export const getPerformanceMode = (): keyof typeof PERFORMANCE_MODES => {
  // TODO: Load from MMKV storage
  return 'balanced';
};

/**
 * Apply performance mode
 */
export const applyPerformanceMode = (mode: keyof typeof PERFORMANCE_MODES) => {
  // TODO: Save to MMKV storage
  console.log(`[Performance] Applying ${mode} mode`);
  return PERFORMANCE_MODES[mode];
};
