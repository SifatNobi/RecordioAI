import React from 'react';
import {
  TouchableOpacity,
  TouchableOpacityProps,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
} from 'react-native';
import { Theme } from '@/constants/theme';
import { Typography } from './Typography';

interface ButtonProps extends TouchableOpacityProps {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children: React.ReactNode;
}

const variantStyles: Record<NonNullable<ButtonProps['variant']>, ViewStyle> = {
  primary: { backgroundColor: Theme.colors.buttonPrimary },
  secondary: { backgroundColor: Theme.colors.buttonSecondary, borderWidth: 1, borderColor: Theme.colors.border },
  danger: { backgroundColor: Theme.colors.buttonDanger },
  ghost: { backgroundColor: 'transparent' },
  outline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: Theme.colors.primaryBlue },
};

const variantTextColors: Record<NonNullable<ButtonProps['variant']>, keyof typeof Theme.colors> = {
  primary: 'textOnPrimary',
  secondary: 'textPrimary',
  danger: 'textOnPrimary',
  ghost: 'primaryBlue',
  outline: 'primaryBlue',
};

const variantPressedStyles: Record<NonNullable<ButtonProps['variant']>, ViewStyle> = {
  primary: { backgroundColor: Theme.colors.buttonPrimaryPressed },
  secondary: { backgroundColor: Theme.colors.buttonSecondaryPressed },
  danger: { backgroundColor: Theme.colors.buttonDangerPressed },
  ghost: { backgroundColor: 'rgba(0, 102, 255, 0.1)' },
  outline: { backgroundColor: 'rgba(0, 102, 255, 0.1)' },
};

const sizeStyles: Record<NonNullable<ButtonProps['size']>, ViewStyle> = {
  sm: { paddingHorizontal: Theme.spacing[3], paddingVertical: Theme.spacing[2], borderRadius: Theme.borderRadius.base },
  md: { paddingHorizontal: Theme.spacing[5], paddingVertical: Theme.spacing[3], borderRadius: Theme.borderRadius.lg },
  lg: { paddingHorizontal: Theme.spacing[6], paddingVertical: Theme.spacing[4], borderRadius: Theme.borderRadius.lg },
};

const sizeTextStyles: Record<NonNullable<ButtonProps['size']>, TextStyle> = {
  sm: { fontSize: Theme.typography.fontSize.sm },
  md: { fontSize: Theme.typography.fontSize.base },
  lg: { fontSize: Theme.typography.fontSize.lg },
};

export const Button = React.forwardRef<React.ElementRef<typeof TouchableOpacity>, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      fullWidth = false,
      loading = false,
      leftIcon,
      rightIcon,
      children,
      style,
      disabled,
      onPress,
      activeOpacity = 0.8,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;
    const pressedStyle = variantPressedStyles[variant];

    return (
      <TouchableOpacity
        ref={ref}
        style={[
          styles.container,
          variantStyles[variant],
          sizeStyles[size],
          fullWidth && styles.fullWidth,
          isDisabled && styles.disabled,
          style,
        ]}
        disabled={isDisabled}
        onPress={onPress}
        activeOpacity={isDisabled ? 1 : activeOpacity}
        {...props}
      >
        {loading ? (
          <ActivityIndicator
            color={variant === 'primary' || variant === 'danger' ? Theme.colors.textOnPrimary : Theme.colors.primaryBlue}
            size="small"
            style={styles.spinner}
          />
        ) : (
          <>
            {leftIcon && <React.Fragment>{leftIcon}</React.Fragment>}
            <Typography
              variant="body"
              weight="semiBold"
              color={variantTextColors[variant]}
              style={[
                sizeTextStyles[size],
                styles.buttonText,
                { color: Theme.colors[variantTextColors[variant]] },
              ]}
            >
              {children}
            </Typography>
            {rightIcon && <React.Fragment>{rightIcon}</React.Fragment>}
          </>
        )}
      </TouchableOpacity>
    );
  }
);

Button.displayName = 'Button';

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Theme.spacing[2] },
  fullWidth: { width: '100%' },
  disabled: { opacity: 0.5 },
  buttonText: { textAlign: 'center' },
  spinner: { marginHorizontal: Theme.spacing[1] },
});