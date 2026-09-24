import React from 'react';
import { View, ViewProps, ViewStyle, StyleSheet, TouchableOpacity, TouchableOpacityProps } from 'react-native';
import { Theme } from '@/constants/theme';

interface CardProps extends ViewProps {
  variant?: 'default' | 'elevated' | 'outlined';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  onPress?: () => void;
}

const variantStyles: Record<NonNullable<CardProps['variant']>, ViewStyle> = {
  default: { backgroundColor: Theme.colors.surface },
  elevated: { backgroundColor: Theme.colors.surfaceElevated, ...Theme.shadows.base },
  outlined: { backgroundColor: Theme.colors.surface, borderWidth: 1, borderColor: Theme.colors.border },
};

const paddingStyles: Record<NonNullable<CardProps['padding']>, ViewStyle> = {
  none: { padding: 0 },
  sm: { padding: Theme.spacing[3] },
  md: { padding: Theme.spacing[4] },
  lg: { padding: Theme.spacing[6] },
};

const Card = React.forwardRef<View, CardProps>(
  ({ variant = 'default', padding = 'md', onPress, style, children, ...props }, ref) => {
    if (onPress) {
      return (
        <TouchableOpacity
          ref={ref as React.RefObject<View>}
          style={[styles.container, variantStyles[variant], paddingStyles[padding], style]}
          onPress={onPress}
          activeOpacity={0.9}
          {...(props as TouchableOpacityProps)}
        >
          {children}
        </TouchableOpacity>
      );
    }
    return (
      <View ref={ref} style={[styles.container, variantStyles[variant], paddingStyles[padding], style]} {...props}>
        {children}
      </View>
    );
  }
);
Card.displayName = 'Card';

const styles = StyleSheet.create({ container: { borderRadius: Theme.borderRadius.xl } });

interface CardSectionProps extends ViewProps {}

export const CardHeader = React.forwardRef<View, CardSectionProps>(
  ({ style, children, ...props }, ref) => <View ref={ref} style={[cardStyles.header, style]} {...props}>{children}</View>
);
CardHeader.displayName = 'CardHeader';

export const CardContent = React.forwardRef<View, CardSectionProps>(
  ({ style, children, ...props }, ref) => <View ref={ref} style={[cardStyles.content, style]} {...props}>{children}</View>
);
CardContent.displayName = 'CardContent';

export const CardFooter = React.forwardRef<View, CardSectionProps>(
  ({ style, children, ...props }, ref) => <View ref={ref} style={[cardStyles.footer, style]} {...props}>{children}</View>
);
CardFooter.displayName = 'CardFooter';

const cardStyles = StyleSheet.create({
  header: { borderBottomWidth: 1, borderBottomColor: Theme.colors.border, paddingBottom: Theme.spacing[3], marginBottom: Theme.spacing[3] },
  content: {},
  footer: { borderTopWidth: 1, borderTopColor: Theme.colors.border, paddingTop: Theme.spacing[3], marginTop: Theme.spacing[3], flexDirection: 'row', justifyContent: 'flex-end', gap: Theme.spacing[2] },
});

export { Card };