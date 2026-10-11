import * as SecureStore from 'expo-secure-store';
import { APP_CONFIG } from '@/constants/env';
import { api } from '@/services/api';

const DEVICE_ID_KEY = 'recordioai.device_id';
const SESSION_TOKEN_KEY = 'recordioai.device_session_token';

interface DeviceSessionResponse {
  session_token: string;
  device_id: string;
  expires_at: string;
}

function createDeviceId(): string {
  const random = Math.random().toString(36).slice(2);
  return `android-${Date.now().toString(36)}-${random}-${Math.random().toString(36).slice(2)}`;
}

async function getDeviceId(): Promise<string> {
  const saved = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (saved) return saved;
  const deviceId = createDeviceId();
  await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
  return deviceId;
}

export async function getDeviceSessionToken(): Promise<string> {
  const savedToken = await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
  if (savedToken) return savedToken;

  const response = await api.post<DeviceSessionResponse>('/auth/device', {
    device_id: await getDeviceId(),
    app_version: APP_CONFIG.version,
  });
  await SecureStore.setItemAsync(SESSION_TOKEN_KEY, response.session_token);
  return response.session_token;
}

export async function clearDeviceSessionToken(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
}
