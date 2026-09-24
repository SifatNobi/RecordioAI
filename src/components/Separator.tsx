import React from 'react';
import { View, ViewProps, ViewStyle, StyleSheet } from 'react-native';
import { Theme } from '@/constants/theme';

interface SeparatorProps extends ViewProps {
  orientation?: 'horizontal' | 'vertical';
  variant?: 'default' | 'subtle' | 'strong';
}

const orientationStyles: Record<NonNullable<SeparatorProps['orientation']>, ViewStyle> = { horizontal: { width: '100%', height: StyleSheet.hairlineWidth }, vertical: { width: StyleSheet.hairlineWidth, height: '100%' } };
const variantStyles: Record<NonNullable<SeparatorProps['variant']>, ViewStyle> = { default: { backgroundColor: Theme.colors.border }, subtle: { backgroundColor: Theme.colors.border, opacity: 0.5 }, strong: { backgroundColor: Theme.colors.border, opacity: 1 } };

export const Separator = React.forwardRef<View, SeparatorProps>(({ orientation = 'horizontal', variant = 'default', style, ...props }, ref) => (
  <View ref={ref} style={[styles.container, orientationStyles[orientation], variantStyles[variant], style]} {...props} />
));
Separator.displayName = 'Separator';

const styles = StyleSheet.create({ container: {} });