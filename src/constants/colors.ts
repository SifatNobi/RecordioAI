export const Colors = {
  // Primary backgrounds
  backgroundPrimary: '#000000',
  backgroundSecondary: '#050505',
  surface: '#0A0A0A',
  surfaceElevated: '#101010',
  border: '#171717',

  // Brand colors
  primaryBlue: '#0066FF',
  brightBlue: '#0088FF',
  cyanAccent: '#3FE7FF',

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#AFC5FF',
  textMuted: '#6B7A99',
  textOnPrimary: '#FFFFFF',

  // Status
  success: '#00D26A',
  warning: '#F5B700',
  error: '#FF4D5A',

  // Transparent overlays
  overlay: 'rgba(0, 0, 0, 0.7)',
  overlayLight: 'rgba(0, 0, 0, 0.5)',

  // Button states
  buttonPrimary: '#0066FF',
  buttonPrimaryPressed: '#0052CC',
  buttonSecondary: '#1A1A1A',
  buttonSecondaryPressed: '#2A2A2A',
  buttonDanger: '#FF4D5A',
  buttonDangerPressed: '#CC3D48',
} as const;

export type ColorKey = keyof typeof Colors;