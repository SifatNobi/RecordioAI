export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL || 'https://recordioai.onrender.com/v1';

export const ENVIRONMENT = process.env.EXPO_PUBLIC_ENVIRONMENT || 'development';

export const IS_DEV = ENVIRONMENT === 'development';

export const MONAD_TESTNET_CHAIN_ID = 10143;
export const MONAD_TESTNET_RPC_URL =
  process.env.EXPO_PUBLIC_MONAD_TESTNET_RPC_URL || 'https://testnet-rpc.monad.xyz';
export const MONAD_EXPLORER_URL =
  process.env.EXPO_PUBLIC_MONAD_EXPLORER_URL || 'https://testnet.monadexplorer.com';
export const WALLETCONNECT_PROJECT_ID =
  process.env.EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID ||
  'b889ec40fdf5db096d981559f7ccbdb2';

export const APP_CONFIG = {
  name: 'RecordioAI',
  version: '1.2.14',
  bundleId: 'com.recordioai.app',
  supportEmail: 'support@recordioai.com',
  privacyUrl: 'https://recordioai.com/privacy',
  termsUrl: 'https://recordioai.com/terms',
} as const;