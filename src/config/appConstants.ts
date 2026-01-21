/**
 * Application Constants
 *
 * Centralized configuration and constants for the application.
 * Contains all hardcoded values that should be configurable.
 *
 * @version 1.0.0
 * @author PaynaAI Team
 */

export const AUTH = {
  MIN_PASSWORD_LENGTH: 8,
  MAX_PASSWORD_LENGTH: 128,
  MIN_USERNAME_LENGTH: 3,
  MAX_USERNAME_LENGTH: 30,
  MIN_AGE: 13,
  MAX_AGE: 120,
  SESSION_TIMEOUT_MINUTES: 30,
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION_MINUTES: 15,
} as const;

export const API = {
  STRIPE_API_VERSION: '2025-02-24.acacia',
  OPENAI_API_VERSION: '2024-11-20',
  GROK_API_VERSION: '2024-11-20',
  ANTHROPIC_API_VERSION: '2023-06-01',
  TIMEOUT_MS: 30000,
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
} as const;

export const VALIDATION = {
  EMAIL_MAX_LENGTH: 254,
  TEXT_MAX_LENGTH: 1000,
  LONG_TEXT_MAX_LENGTH: 10000,
  SEARCH_QUERY_MAX_LENGTH: 200,
  URL_MAX_LENGTH: 2048,
  PHONE_MAX_LENGTH: 20,
  FILE_MAX_SIZE_MB: 10,
  ALLOWED_FILE_TYPES: ['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx', 'txt'],
  ALLOWED_IMAGE_TYPES: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
  ALLOWED_DOCUMENT_TYPES: ['pdf', 'doc', 'docx', 'txt', 'rtf'],
} as const;

export const UI = {
  ANIMATION_DURATION_MS: 300,
  DEBOUNCE_DELAY_MS: 500,
  TOAST_DURATION_MS: 3000,
  LOADING_TIMEOUT_MS: 10000,
  PULL_TO_REFRESH_THRESHOLD: 80,
  INFINITE_SCROLL_THRESHOLD: 0.1,
  MODAL_ANIMATION_DURATION_MS: 250,
} as const;

export const SECURITY = {
  CSRF_TOKEN_LENGTH: 32,
  RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: 100,
  RATE_LIMIT_AUTH_MAX_REQUESTS: 5,
  RATE_LIMIT_AUTH_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  MAX_LOGIN_ATTEMPTS_PER_IP: 10,
  IP_BLOCK_DURATION_MS: 60 * 60 * 1000, // 1 hour
  SESSION_ID_LENGTH: 64,
  ENCRYPTION_KEY_LENGTH: 32,
} as const;

export const STORAGE = {
  ASYNC_STORAGE_PREFIX: '@PaynaAI:',
  SECURE_STORAGE_PREFIX: 'PaynaAI_',
  CACHE_EXPIRY_MS: 24 * 60 * 60 * 1000, // 24 hours
  MAX_CACHE_SIZE_MB: 50,
  CLEANUP_INTERVAL_MS: 60 * 60 * 1000, // 1 hour
} as const;

export const NETWORK = {
  CONNECTION_TIMEOUT_MS: 30000,
  READ_TIMEOUT_MS: 60000,
  MAX_CONCURRENT_REQUESTS: 5,
  RETRY_DELAY_MS: 1000,
  MAX_RETRY_ATTEMPTS: 3,
  OFFLINE_RETRY_DELAY_MS: 5000,
} as const;

export const AI = {
  MAX_PROMPT_LENGTH: 4000,
  MAX_RESPONSE_LENGTH: 2000,
  MAX_CONVERSATION_HISTORY: 50,
  DEFAULT_TEMPERATURE: 0.7,
  MAX_TOKENS: 1000,
  REQUEST_TIMEOUT_MS: 60000,
  MAX_CONCURRENT_REQUESTS: 3,
} as const;

export const PAYMENT = {
  STRIPE_PUBLISHABLE_KEY_PREFIX: 'pk_',
  STRIPE_SECRET_KEY_PREFIX: 'sk_',
  CURRENCY: 'usd',
  MIN_AMOUNT_CENTS: 50, // $0.50
  MAX_AMOUNT_CENTS: 100000, // $1000
  REFUND_WINDOW_DAYS: 30,
  CHARGEBACK_WINDOW_DAYS: 120,
} as const;

export const NOTIFICATIONS = {
  MAX_TITLE_LENGTH: 100,
  MAX_BODY_LENGTH: 500,
  MAX_BADGE_COUNT: 99,
  DEFAULT_SOUND: 'default',
  VIBRATION_PATTERN: [0, 250, 250, 250],
  AUTO_DISMISS_DELAY_MS: 5000,
} as const;

export const ANALYTICS = {
  MAX_EVENT_NAME_LENGTH: 40,
  MAX_PROPERTY_NAME_LENGTH: 24,
  MAX_PROPERTY_VALUE_LENGTH: 36,
  BATCH_SIZE: 20,
  FLUSH_INTERVAL_MS: 30000,
  MAX_QUEUE_SIZE: 1000,
} as const;

export const PERFORMANCE = {
  IMAGE_COMPRESSION_QUALITY: 0.8,
  THUMBNAIL_SIZE: 200,
  MAX_IMAGE_DIMENSION: 2048,
  LAZY_LOAD_THRESHOLD: 100,
  PRELOAD_DISTANCE: 200,
  MEMORY_WARNING_THRESHOLD_MB: 100,
} as const;

export const ACCESSIBILITY = {
  MIN_TOUCH_TARGET_SIZE: 44,
  MIN_CONTRAST_RATIO: 4.5,
  MAX_FONT_SCALE: 2.0,
  MIN_FONT_SIZE: 14,
  FOCUS_TIMEOUT_MS: 1000,
  SCREEN_READER_DELAY_MS: 100,
} as const;

export const ENVIRONMENT = {
  DEVELOPMENT: 'development',
  STAGING: 'staging',
  PRODUCTION: 'production',
  TESTING: 'testing',
} as const;

export const ERROR_CODES = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND_ERROR: 'NOT_FOUND_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
  PAYMENT_ERROR: 'PAYMENT_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export const LOG_LEVELS = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  CRITICAL: 'critical',
} as const;

export const FEATURE_FLAGS = {
  ENABLE_ANALYTICS: true,
  ENABLE_CRASH_REPORTING: true,
  ENABLE_PERFORMANCE_MONITORING: true,
  ENABLE_OFFLINE_MODE: true,
  ENABLE_PUSH_NOTIFICATIONS: true,
  ENABLE_BIOMETRIC_AUTH: false,
  ENABLE_DARK_MODE: true,
  ENABLE_ACCESSIBILITY_FEATURES: true,
} as const;

export const THEME = {
  COLORS: {
    PRIMARY: '#007AFF',
    SECONDARY: '#5856D6',
    SUCCESS: '#34C759',
    WARNING: '#FF9500',
    ERROR: '#FF3B30',
    INFO: '#5AC8FA',
    BACKGROUND: '#FFFFFF',
    SURFACE: '#F2F2F7',
    TEXT_PRIMARY: '#000000',
    TEXT_SECONDARY: '#8E8E93',
    BORDER: '#C6C6C8',
    SHADOW: '#000000',
  },
  SPACING: {
    XS: 4,
    SM: 8,
    MD: 16,
    LG: 24,
    XL: 32,
    XXL: 48,
  },
  BORDER_RADIUS: {
    SM: 4,
    MD: 8,
    LG: 12,
    XL: 16,
    ROUND: 50,
  },
  FONT_SIZES: {
    XS: 12,
    SM: 14,
    MD: 16,
    LG: 18,
    XL: 20,
    XXL: 24,
    XXXL: 32,
  },
  FONT_WEIGHTS: {
    LIGHT: '300',
    REGULAR: '400',
    MEDIUM: '500',
    SEMIBOLD: '600',
    BOLD: '700',
  },
} as const;

export const ROUTES = {
  AUTH: {
    SIGN_IN: 'SignIn',
    SIGN_UP: 'SignUp',
    FORGOT_PASSWORD: 'ForgotPassword',
    RESET_PASSWORD: 'ResetPassword',
  },
  MAIN: {
    HOME: 'Home',
    PROFILE: 'Profile',
    SETTINGS: 'Settings',
    BILLING: 'Billing',
  },
  CHAT: {
    AI_CHAT: 'AIChat',
    INBOX_CHAT: 'InboxChat',
    HISTORY: 'History',
  },
  ONBOARDING: {
    WELCOME: 'Welcome',
    PERMISSIONS: 'Permissions',
    COMPLETE: 'Complete',
  },
} as const;

export const PERMISSIONS = {
  CAMERA: 'camera',
  PHOTO_LIBRARY: 'photoLibrary',
  LOCATION: 'location',
  NOTIFICATIONS: 'notifications',
  MICROPHONE: 'microphone',
  CONTACTS: 'contacts',
  CALENDAR: 'calendar',
  REMINDERS: 'reminders',
} as const;

export const PLATFORMS = {
  IOS: 'ios',
  ANDROID: 'android',
  WEB: 'web',
  DESKTOP: 'desktop',
} as const;

export const DEVICE_TYPES = {
  PHONE: 'phone',
  TABLET: 'tablet',
  DESKTOP: 'desktop',
  TV: 'tv',
  WATCH: 'watch',
} as const;

export const ORIENTATION = {
  PORTRAIT: 'portrait',
  LANDSCAPE: 'landscape',
} as const;

export const CONNECTION_TYPES = {
  WIFI: 'wifi',
  CELLULAR: 'cellular',
  ETHERNET: 'ethernet',
  BLUETOOTH: 'bluetooth',
  VPN: 'vpn',
  NONE: 'none',
  UNKNOWN: 'unknown',
} as const;

export const BATTERY_STATES = {
  UNKNOWN: 'unknown',
  UNPLUGGED: 'unplugged',
  CHARGING: 'charging',
  FULL: 'full',
} as const;

export const MEMORY_WARNINGS = {
  NONE: 'none',
  LOW: 'low',
  CRITICAL: 'critical',
} as const;

export const APP_STATES = {
  ACTIVE: 'active',
  BACKGROUND: 'background',
  INACTIVE: 'inactive',
} as const;

export const UPDATE_TYPES = {
  MANDATORY: 'mandatory',
  OPTIONAL: 'optional',
  NONE: 'none',
} as const;

export const CACHE_STRATEGIES = {
  CACHE_FIRST: 'cacheFirst',
  NETWORK_FIRST: 'networkFirst',
  CACHE_ONLY: 'cacheOnly',
  NETWORK_ONLY: 'networkOnly',
  STALE_WHILE_REVALIDATE: 'staleWhileRevalidate',
} as const;

export const SYNC_STATUS = {
  SYNCED: 'synced',
  SYNCING: 'syncing',
  FAILED: 'failed',
  PENDING: 'pending',
  OFFLINE: 'offline',
} as const;

export const FILE_TYPES = {
  IMAGE: 'image',
  VIDEO: 'video',
  AUDIO: 'audio',
  DOCUMENT: 'document',
  ARCHIVE: 'archive',
  OTHER: 'other',
} as const;

export const COMPRESSION_LEVELS = {
  NONE: 0,
  LOW: 0.3,
  MEDIUM: 0.5,
  HIGH: 0.7,
  MAXIMUM: 0.9,
} as const;

export const QUALITY_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  ULTRA: 'ultra',
} as const;

export const RESOLUTION_PRESETS = {
  THUMBNAIL: { width: 150, height: 150 },
  SMALL: { width: 300, height: 300 },
  MEDIUM: { width: 600, height: 600 },
  LARGE: { width: 1200, height: 1200 },
  ORIGINAL: { width: 0, height: 0 },
} as const;

export const ANIMATION_TYPES = {
  FADE: 'fade',
  SLIDE: 'slide',
  SCALE: 'scale',
  ROTATE: 'rotate',
  BOUNCE: 'bounce',
  ELASTIC: 'elastic',
  SPRING: 'spring',
} as const;

export const GESTURE_TYPES = {
  TAP: 'tap',
  LONG_PRESS: 'longPress',
  PAN: 'pan',
  PINCH: 'pinch',
  ROTATION: 'rotation',
  SWIPE: 'swipe',
} as const;

export const HAPTIC_TYPES = {
  LIGHT: 'light',
  MEDIUM: 'medium',
  HEAVY: 'heavy',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error',
  SELECTION: 'selection',
  IMPACT: 'impact',
} as const;

export const SOUND_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
  NOTIFICATION: 'notification',
  BUTTON_CLICK: 'buttonClick',
  KEYBOARD_TAP: 'keyboardTap',
  CAMERA_SHUTTER: 'cameraShutter',
} as const;

export const VIBRATION_PATTERNS = {
  SHORT: [0, 100],
  MEDIUM: [0, 200],
  LONG: [0, 500],
  DOUBLE: [0, 100, 100, 100],
  TRIPLE: [0, 100, 100, 100, 100, 100],
  SUCCESS: [0, 100, 50, 100],
  ERROR: [0, 200, 100, 200],
  WARNING: [0, 150, 50, 150],
} as const;
