import React from 'react';
import { Text, TextProps, TextStyle, StyleSheet } from 'react-native';
import { Theme } from '@/constants/theme';

interface TypographyProps extends TextProps {
  variant?: 'h1' | 'h2' | 'h3' | 'h4' | 'body' | 'bodyLarge' | 'caption' | 'overline' | 'mono';
  weight?: 'normal' | 'medium' | 'semiBold' | 'bold';
  color?: keyof typeof Theme.colors;
}

const variantStyles: Record<TypographyProps['variant'], TextStyle> = {
  h1: {
    fontSize: Theme.typography.fontSize['6xl'],
    lineHeight: Theme.typography.fontSize['6xl'] * Theme.typography.lineHeight.tight,
    fontWeight: Theme.typography.fontWeight.bold,
    letterSpacing: Theme.typography.letterSpacing.tight,
  },
  h2: {
    fontSize: Theme.typography.fontSize['5xl'],
    lineHeight: Theme.typography.fontSize['5xl'] * Theme.typography.lineHeight.tight,
    fontWeight: Theme.typography.fontWeight.bold,
    letterSpacing: Theme.typography.letterSpacing.tight,
  },
  h3: {
    fontSize: Theme.typography.fontSize['4xl'],
    lineHeight: Theme.typography.fontSize['4xl'] * Theme.typography.lineHeight.tight,
    fontWeight: Theme.typography.fontWeight.semiBold,
    letterSpacing: Theme.typography.letterSpacing.tight,
  },
  h4: {
    fontSize: Theme.typography.fontSize['3xl'],
    lineHeight: Theme.typography.fontSize['3xl'] * Theme.typography.lineHeight.normal,
    fontWeight: Theme.typography.fontWeight.semiBold,
  },
  body: {
    fontSize: Theme.typography.fontSize.base,
    lineHeight: Theme.typography.fontSize.base * Theme.typography.lineHeight.normal,
    fontWeight: Theme.typography.fontWeight.normal,
  },
  bodyLarge: {
    fontSize: Theme.typography.fontSize.lg,
    lineHeight: Theme.typography.fontSize.lg * Theme.typography.lineHeight.normal,
    fontWeight: Theme.typography.fontWeight.normal,
  },
  caption: {
    fontSize: Theme.typography.fontSize.sm,
    lineHeight: Theme.typography.fontSize.sm * Theme.typography.lineHeight.normal,
    fontWeight: Theme.typography.fontWeight.normal,
  },
  overline: {
    fontSize: Theme.typography.fontSize.xs,
    lineHeight: Theme.typography.fontSize.xs * Theme.typography.lineHeight.normal,
    fontWeight: Theme.typography.fontWeight.medium,
    letterSpacing: Theme.typography.letterSpacing.wide,
    textTransform: 'uppercase',
  },
  mono: {
    fontSize: Theme.typography.fontSize.sm,
    lineHeight: Theme.typography.fontSize.sm * Theme.typography.lineHeight.normal,
    fontFamily: Theme.typography.fontFamily.mono,
  },
};

const weightStyles: Record<NonNullable<TypographyProps['weight']>, TextStyle> = {
  normal: { fontWeight: Theme.typography.fontWeight.normal },
  medium: { fontWeight: Theme.typography.fontWeight.medium },
  semiBold: { fontWeight: Theme.typography.fontWeight.semiBold },
  bold: { fontWeight: Theme.typography.fontWeight.bold },
};

export const Typography = React.forwardRef<Text, TypographyProps>(
  (
    {
      variant = 'body',
      weight,
      color = 'textPrimary',
      className,
      style,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <Text
        ref={ref}
        style={[
          variantStyles[variant],
          weight && weightStyles[weight],
          { color: Theme.colors[color] },
          style,
        ]}
        {...props}
      >
        {children}
      </Text>
    );
  }
);

Typography.displayName = 'Typography';

export const H1 = (props: Omit<TypographyProps, 'variant'>) => (
  <Typography variant="h1" {...props} />
);
export const H2 = (props: Omit<TypographyProps, 'variant'>) => (
  <Typography variant="h2" {...props} />
);
export const H3 = (props: Omit<TypographyProps, 'variant'>) => (
  <Typography variant="h3" {...props} />
);
export const H4 = (props: Omit<TypographyProps, 'variant'>) => (
  <Typography variant="h4" {...props} />
);
export const Body = (props: Omit<TypographyProps, 'variant'>) => (
  <Typography variant="body" {...props} />
);
export const BodyLarge = (props: Omit<TypographyProps, 'variant'>) => (
  <Typography variant="bodyLarge" {...props} />
);
export const Caption = (props: Omit<TypographyProps, 'variant'>) => (
  <Typography variant="caption" {...props} />
);
export const Overline = (props: Omit<TypographyProps, 'variant'>) => (
  <Typography variant="overline" {...props} />
);
export const Mono = (props: Omit<TypographyProps, 'variant'>) => (
  <Typography variant="mono" {...props} />
);