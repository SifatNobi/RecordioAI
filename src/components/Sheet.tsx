import React from 'react';
import { View, ViewProps, ViewStyle, StyleSheet, Animated, TouchableWithoutFeedback, PanResponder, Keyboard } from 'react-native';
import { Theme } from '@/constants/theme';
import { Card } from './Card';
import { Separator } from './Separator';
import { Typography } from './Typography';

interface SheetProps extends ViewProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'full';
  snapPoints?: number[];
  backdropOpacity?: number;
  handleDrag?: boolean;
  title?: string;
  subtitle?: string;
  hideHandle?: boolean;
}

function readAnimatedValue(value: Animated.Value): number {
  return (value as unknown as { __getValue(): number }).__getValue();
}

const sizeValues: Record<NonNullable<SheetProps['size']>, number> = { sm: 0.35, md: 0.5, lg: 0.75, full: 0.95 };

export const Sheet = React.forwardRef<View, SheetProps>(
  (
    { visible, onClose, children, size = 'md', snapPoints, backdropOpacity = 0.5, handleDrag = true, title, subtitle, hideHandle = false, style, ...props },
    ref
  ) => {
    const translateY = React.useRef(new Animated.Value(1)).current;
    const backdropOpacityAnim = React.useRef(new Animated.Value(0)).current;
    const maxHeight = sizeValues[size];

    const panResponder = React.useRef(
      PanResponder.create({
        onStartShouldSetPanResponder: () => handleDrag,
        onMoveShouldSetPanResponder: () => handleDrag,
        onPanResponderGrant: () => {
          translateY.setOffset(readAnimatedValue(translateY));
          translateY.setValue(0);
        },
        onPanResponderMove: (_, gesture) => {
          translateY.setValue(gesture.dy);
        },
        onPanResponderRelease: (_, gesture) => {
          translateY.flattenOffset();
          const velocity = gesture.vy;
          const currentY = readAnimatedValue(translateY);
          let targetY = 0;
          const screenHeight = 800;
          const currentPercent = (currentY / screenHeight) * 100;
          if (velocity > 0.5 || currentPercent > 30) targetY = 1;
          else targetY = 0;
          Animated.timing(translateY, { toValue: targetY, duration: 250, useNativeDriver: true }).start(({ finished }) => {
            if (finished && targetY === 1) onClose();
          });
        },
      })
    ).current;

    React.useEffect(() => {
      if (visible) {
        Keyboard.dismiss();
        Animated.parallel([
          Animated.timing(backdropOpacityAnim, { toValue: backdropOpacity, duration: 200, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]).start();
      } else {
        Animated.parallel([
          Animated.timing(backdropOpacityAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: 1, duration: 250, useNativeDriver: true }),
        ]).start();
      }
    }, [visible]);

    if (!visible && readAnimatedValue(translateY) === 1) return null;

    const containerStyle: ViewStyle = {
      ...styles.container,
      transform: [{ translateY: translateY.interpolate({ inputRange: [0, 1], outputRange: [0, maxHeight * 100] }) }],
    };

    return (
      <>
        <TouchableWithoutFeedback onPress={onClose} accessible={false}>
          <Animated.View style={[styles.backdrop, { opacity: backdropOpacityAnim }]} />
        </TouchableWithoutFeedback>
        <Animated.View style={containerStyle} {...panResponder.panHandlers}>
          <View style={styles.sheetWrapper} {...props}>
            {!hideHandle && (
              <View style={styles.handleContainer}>
                <View style={styles.handle} />
              </View>
            )}
            {(title || subtitle) && (
              <View style={styles.header}>
                <View>
                  {title && <Typography variant="h4" weight="semiBold" color="textPrimary">{title}</Typography>}
                  {subtitle && <Typography variant="body" color="textSecondary" style={styles.subtitle}>{subtitle}</Typography>}
                </View>
              </View>
            )}
            {(title || subtitle) && <Separator />}
            <View style={styles.content}>{children}</View>
          </View>
        </Animated.View>
      </>
    );
  }
);
Sheet.displayName = 'Sheet';

const styles = StyleSheet.create({
  container: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 1000 },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: Theme.colors.backgroundPrimary, zIndex: 999 },
  sheetWrapper: { backgroundColor: Theme.colors.backgroundPrimary, borderTopLeftRadius: Theme.borderRadius['2xl'], borderTopRightRadius: Theme.borderRadius['2xl'], overflow: 'hidden', maxHeight: '95%' },
  handleContainer: { paddingVertical: Theme.spacing[2], alignItems: 'center' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Theme.colors.border },
  header: { padding: Theme.spacing[5], paddingBottom: Theme.spacing[3] },
  subtitle: { marginTop: Theme.spacing[1] },
  content: { padding: Theme.spacing[5], paddingBottom: Theme.spacing[8], maxHeight: '70%' },
});