import React from 'react';
import { View, ViewProps, ViewStyle, StyleSheet, ActivityIndicator } from 'react-native';
import { Theme } from '@/constants/theme';
import { Typography } from './Typography';

interface LoadingStateProps extends ViewProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  overlay?: boolean;
}

const sizeValues: Record<LoadingStateProps['size'], number> = { sm: 20, md: 28, lg: 36 };

export const LoadingState = React.forwardRef<View, LoadingStateProps>(({ size = 'md', label, overlay = false, style, ...props }, ref) => (
  <View ref={ref} style={[overlay ? styles.overlayContainer : styles.container, style]} {...props}>
    <ActivityIndicator size={size === 'sm' ? 'small' : 'large'} color={Theme.colors.primaryBlue} style={styles.spinner} />
    {label && <Typography variant="body" color="textSecondary" style={styles.label}>{label}</Typography>}
  </View>
));
LoadingState.displayName = 'LoadingState';

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Theme.spacing[3] },
  overlayContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 100 },
  spinner: {},
  label: { textAlign: 'center' },
});