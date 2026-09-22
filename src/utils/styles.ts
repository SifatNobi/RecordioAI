import React from 'react';
import { StyleSheet, TextStyle, ViewStyle } from 'react-native';
import { Theme } from '@/constants/theme';

type StyleProps = {
  style?: ViewStyle | TextStyle | (ViewStyle | TextStyle)[];
  className?: string;
};

export function createStyles<T extends Record<string, ViewStyle | TextStyle>>(
  styles: T
): T {
  return StyleSheet.create(styles);
}

export function useTheme() {
  return Theme;
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function getColor(colorKey: keyof typeof Theme.colors): string {
  return Theme.colors[colorKey];
}

export function getSpacing(spacingKey: keyof typeof Theme.spacing): number {
  return Theme.spacing[spacingKey];
}

export function getFontSize(sizeKey: keyof typeof Theme.typography.fontSize): number {
  return Theme.typography.fontSize[sizeKey];
}

export function getBorderRadius(radiusKey: keyof typeof Theme.borderRadius): number {
  return Theme.borderRadius[radiusKey];
}

export function getShadow(shadowKey: keyof typeof Theme.shadows): ViewStyle {
  return Theme.shadows[shadowKey];
}