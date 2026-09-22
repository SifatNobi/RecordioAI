import React from 'react';
import { View, ViewProps, ViewStyle, StyleSheet, ImageSourcePropType } from 'react-native';
import { Theme } from '@/constants/theme';
import { Typography } from './Typography';

interface AvatarProps extends ViewProps {
  source?: ImageSourcePropType;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  shape?: 'circle' | 'square';
  status?: 'online' | 'offline' | 'busy' | 'away';
}

const sizeValues: Record<AvatarProps['size'], number> = { xs: 24, sm: 32, md: 40, lg: 56, xl: 72 };
const fontSizeValues: Record<AvatarProps['size'], number> = { xs: Theme.typography.fontSize.xs, sm: Theme.typography.fontSize.sm, md: Theme.typography.fontSize.base, lg: Theme.typography.fontSize.xl, xl: Theme.typography.fontSize['2xl'] };
const statusSizeValues: Record<AvatarProps['size'], number> = { xs: 8, sm: 10, md: 12, lg: 14, xl: 16 };

export const Avatar = React.forwardRef<View, AvatarProps>(
  ({ source, name, size = 'md', shape = 'circle', status, style, ...props }, ref) => {
    const diameter = sizeValues[size];
    const fontSize = fontSizeValues[size];
    const statusSize = statusSizeValues[size];
    const borderRadius = shape === 'circle' ? Theme.borderRadius.full : Theme.borderRadius.base;

    const initials = name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?';

    const bgColors = [Theme.colors.primaryBlue, Theme.colors.brightBlue, Theme.colors.cyanAccent, Theme.colors.success, Theme.colors.warning];
    const colorIndex = name ? name.charCodeAt(0) % bgColors.length : 0;
    const bgColor = bgColors[colorIndex];

    return (
      <View ref={ref} style={[styles.container, { width: diameter, height: diameter }, style]} {...props}>
        <View style={[styles.placeholder, { backgroundColor: bgColor, borderRadius, width: diameter, height: diameter }]}>
          <Typography variant="body" weight="semiBold" color="textOnPrimary" style={{ fontSize }}>{initials}</Typography>
        </View>
        {status && <View style={[styles.statusBadge, { width: statusSize, height: statusSize, borderRadius: statusSize / 2, backgroundColor: status === 'online' ? Theme.colors.success : status === 'busy' ? Theme.colors.error : status === 'away' ? Theme.colors.warning : Theme.colors.textMuted, bottom: size === 'xs' ? -2 : size === 'sm' ? -2 : -3, right: size === 'xs' ? -2 : size === 'sm' ? -2 : -3 }]} />}
      </View>
    );
  }
);
Avatar.displayName = 'Avatar';

const styles = StyleSheet.create({
  container: { position: 'relative', justifyContent: 'center', alignItems: 'center' },
  placeholder: { justifyContent: 'center', alignItems: 'center' },
  statusBadge: { position: 'absolute', borderWidth: 2, borderColor: Theme.colors.backgroundPrimary },
});