export const Colors = {
  // Primary backgrounds (dark theme is the only supported appearance)
  backgroundPrimary: '#080B12',
  backgroundSecondary: '#0B0F17',
  surface: '#111827',
  surfaceElevated: '#171E2B',
  border: '#293548',

  // Brand colors
  primaryBlue: '#1685FF',
  brightBlue: '#4DA6FF',
  cyanAccent: '#3FE7FF',

  // Text
  textPrimary: '#F9FAFB',
  textSecondary: '#CBD5E1',
  textMuted: '#94A3B8',
  textOnPrimary: '#FFFFFF',

  // Status
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',

  // Transparent overlays
  overlay: 'rgba(0, 0, 0, 0.7)',
  overlayLight: 'rgba(0, 0, 0, 0.5)',

  // Button states
  buttonPrimary: '#1685FF',
  buttonPrimaryPressed: '#0D6FE0',
  buttonSecondary: '#171E2B',
  buttonSecondaryPressed: '#232E42',
  buttonDanger: '#EF4444',
  buttonDangerPressed: '#C73535',
} as const;

export type ColorKey = keyof typeof Colors;
