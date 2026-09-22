import React from 'react';
import { View, ViewProps, ViewStyle, StyleSheet } from 'react-native';
import { Theme } from '@/constants/theme';
import { Typography } from './Typography';
import { Button } from './Button';

interface EmptyStateProps extends ViewProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'outline' };
  secondaryAction?: { label: string; onPress: () => void };
}

export const EmptyState = React.forwardRef<View, EmptyStateProps>(({ icon, title, description, action, secondaryAction, style, ...props }, ref) => (
  <View ref={ref} style={[styles.container, style]} {...props}>
    {icon && <View style={styles.iconWrapper}>{icon}</View>}
    <Typography variant="h3" weight="semiBold" color="textPrimary" style={styles.title}>{title}</Typography>
    {description && <Typography variant="body" color="textSecondary" style={styles.description}>{description}</Typography>}
    {(action || secondaryAction) && (
      <View style={styles.actions}>
        {action && <Button variant={action.variant || 'primary'} size="md" onPress={action.onPress} style={styles.actionButton}>{action.label}</Button>}
        {secondaryAction && <Button variant="ghost" size="md" onPress={secondaryAction.onPress} style={styles.secondaryActionButton}>{secondaryAction.label}</Button>}
      </View>
    )}
  </View>
));
EmptyState.displayName = 'EmptyState';

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Theme.spacing[6], gap: Theme.spacing[4] },
  iconWrapper: { width: 80, height: 80, borderRadius: 40, backgroundColor: Theme.colors.surfaceElevated, justifyContent: 'center', alignItems: 'center', marginBottom: Theme.spacing[2] },
  title: { textAlign: 'center' },
  description: { textAlign: 'center', maxWidth: 280 },
  actions: { flexDirection: 'row', gap: Theme.spacing[3], marginTop: Theme.spacing[2], flexWrap: 'wrap', justifyContent: 'center' },
  actionButton: { minWidth: 140 },
  secondaryActionButton: { minWidth: 140 },
});