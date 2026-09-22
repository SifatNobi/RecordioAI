import React from 'react';
import { Modal as RNModal, ModalProps, View, ViewProps, ViewStyle, StyleSheet, TouchableWithoutFeedback, Animated } from 'react-native';
import { Theme } from '@/constants/theme';
import { Card } from './Card';
import { Separator } from './Separator';
import { Typography } from './Typography';
import { Button } from './Button';

interface ModalContentProps extends ViewProps {
  title?: string; subtitle?: string; hideClose?: boolean; onClose?: () => void;
  children: React.ReactNode; footer?: React.ReactNode;
}

export const ModalContent = React.forwardRef<View, ModalContentProps>(
  ({ title, subtitle, hideClose = false, onClose, children, footer, style, ...props }, ref) => (
    <Card variant="elevated" padding="none" style={styles.content}>
      {(title || !hideClose) && <View style={styles.header}><View style={styles.headerLeft}>{title && <Typography variant="h4" weight="semiBold" color="textPrimary">{title}</Typography>}{subtitle && <Typography variant="body" color="textSecondary" style={styles.subtitle}>{subtitle}</Typography>}</View>{!hideClose && <Button variant="ghost" size="sm" onPress={onClose} style={styles.closeButton}>✕</Button>}</View>}
      <View style={styles.body}>{children}</View>
      {footer && <View style={styles.footer}><Separator />{footer}</View>}
    </Card>
  )
);
ModalContent.displayName = 'ModalContent';

interface BaseModalProps extends Omit<ModalProps, 'visible' | 'animationType' | 'transparent'> {
  visible: boolean; onClose: () => void; children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'full'; position?: 'center' | 'bottom'; backdropOpacity?: number;
}

const sizeStyles: Record<BaseModalProps['size'], ViewStyle> = { sm: { width: '85%', maxWidth: 360 }, md: { width: '90%', maxWidth: 420 }, lg: { width: '95%', maxWidth: 520 }, full: { width: '100%', maxWidth: '100%' } };

export const BaseModal = React.forwardRef<View, BaseModalProps>(
  ({ visible, onClose, children, size = 'md', position = 'center', backdropOpacity = 0.7, style, ...props }, ref) => {
    const fadeAnim = React.useRef(new Animated.Value(0));
    const slideAnim = React.useRef(new Animated.Value(position === 'bottom' ? 100 : 0));

    React.useEffect(() => {
      if (visible) {
        Animated.parallel([
          Animated.timing(fadeAnim.current, { toValue: 1, duration: 200, useNativeDriver: true }),
          Animated.timing(slideAnim.current, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]).start();
      } else {
        Animated.parallel([
          Animated.timing(fadeAnim.current, { toValue: 0, duration: 150, useNativeDriver: true }),
          Animated.timing(slideAnim.current, { toValue: position === 'bottom' ? 100 : 0, duration: 200, useNativeDriver: true }),
        ]).start();
      }
    }, [visible, position]);

    if (!visible && fadeAnim.current._value === 0) return null;

    const modalStyle: ViewStyle = { ...styles.modalContainer, ...sizeStyles[size], transform: [{ translateY: slideAnim.current }] };

    return (
      <RNModal ref={ref} visible={visible} transparent animationType="none" onRequestClose={onClose} {...props}>
        <TouchableWithoutFeedback onPress={onClose} accessible={false}>
          <Animated.View style={[styles.backdrop, { opacity: fadeAnim.current.interpolate({ inputRange: [0, 1], outputRange: [0, backdropOpacity] }) }]} />
        </TouchableWithoutFeedback>
        <Animated.View style={modalStyle}><View style={styles.modalWrapper}>{children}</View></Animated.View>
      </RNModal>
    );
  }
);
BaseModal.displayName = 'BaseModal';

export const Modal = ({ children, ...props }: BaseModalProps) => <BaseModal {...props}><ModalContent>{children}</ModalContent></BaseModal>;

const styles = StyleSheet.create({ modalContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', padding: Theme.spacing[4] }, modalWrapper: { width: '100%' }, backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: Theme.colors.backgroundPrimary }, content: { width: '100%', maxHeight: '85%' }, header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', padding: Theme.spacing[5], borderBottomWidth: 1, borderBottomColor: Theme.colors.border }, headerLeft: { flex: 1 }, subtitle: { marginTop: Theme.spacing[1] }, closeButton: { padding: Theme.spacing[1] }, body: { padding: Theme.spacing[5], maxHeight: '60%' }, footer: { padding: Theme.spacing[4], borderTopWidth: 1, borderTopColor: Theme.colors.border } });