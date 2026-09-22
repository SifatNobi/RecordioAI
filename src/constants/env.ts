export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://api.recordioai.com/v1';

export const REVENUECAT_ANDROID_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY || '';

export const ENVIRONMENT = process.env.EXPO_PUBLIC_ENVIRONMENT || 'development';

export const IS_DEV = ENVIRONMENT === 'development';

export const APP_CONFIG = {
  name: 'RecordioAI',
  version: '1.0.0',
  bundleId: 'com.recordioai.app',
  supportEmail: 'support@recordioai.com',
  privacyUrl: 'https://recordioai.com/privacy',
  termsUrl: 'https://recordioai.com/terms',
} as const;