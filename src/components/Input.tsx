import React from 'react';
import { TextInput, TextInputProps, View, ViewStyle, TextStyle, StyleSheet, StyleProp } from 'react-native';
import { Theme } from '@/constants/theme';
import { Typography } from './Typography';

interface InputProps extends Omit<TextInputProps, 'style' | 'disabled'> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}

export const Input = React.forwardRef<TextInput, InputProps>(
  ({ label, error, helperText, leftIcon, rightIcon, containerStyle, inputStyle, style, disabled, ...props }, ref) => {
    const hasError = Boolean(error);
    const borderColor = hasError ? Theme.colors.error : disabled ? Theme.colors.border : Theme.colors.border;

    return (
      <View style={[styles.container, containerStyle, style]}>
        {label && <Typography variant="caption" weight="medium" color={hasError ? 'error' : 'textSecondary'} style={styles.label}>{label}</Typography>}
        <View style={[styles.inputWrapper, { borderColor }]}>
          {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
          <TextInput ref={ref} style={[styles.input, { color: Theme.colors.textPrimary, paddingLeft: leftIcon ? 0 : undefined, paddingRight: rightIcon ? 0 : undefined }, inputStyle]} editable={!disabled} placeholderTextColor={Theme.colors.textMuted} {...props} />
          {rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
        </View>
        {(error || helperText) && <Typography variant="caption" color={error ? 'error' : 'textMuted'} style={styles.helperText}>{error || helperText}</Typography>}
      </View>
    );
  }
);
Input.displayName = 'Input';

const styles = StyleSheet.create({
  container: { gap: Theme.spacing[1], width: '100%' },
  label: { marginLeft: Theme.spacing[1] },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: Theme.colors.backgroundSecondary, borderWidth: 1, borderRadius: Theme.borderRadius.base, borderColor: Theme.colors.border, minHeight: 48 },
  input: { flex: 1, fontSize: Theme.typography.fontSize.base, lineHeight: Theme.typography.fontSize.base * Theme.typography.lineHeight.normal, paddingHorizontal: Theme.spacing[4], paddingVertical: Theme.spacing[3] },
  iconLeft: { paddingLeft: Theme.spacing[3] },
  iconRight: { paddingRight: Theme.spacing[3] },
  helperText: { marginLeft: Theme.spacing[1] },
});