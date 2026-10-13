import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { Theme } from '@/constants/theme';
import { H1, H2, H3, Body, Caption } from '@/components/Typography';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { useEntitlementStore } from '@/store/entitlementStore';
import { Ionicons } from '@expo/vector-icons';
import { SubscriptionPlan } from '@/types';

export default function SubscriptionScreen() {
  const { plans, currentPlanId } = useEntitlementStore();

  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const currentPlan = plans.find((p) => p.id === currentPlanId);

  const handlePlanSelect = (plan: SubscriptionPlan) => {
    if (plan.isEnterprise) {
      Alert.alert('Enterprise', 'Contact sales for custom pricing', [{ text: 'OK' }]);
      return;
    }

    if (plan.id === 'trial') {
      return;
    }

    setSelectedPlan(plan);
  };

  const renderPlansSection = () => {
    return (
      <View style={styles.plansGrid}>
        {plans
          .filter((p) => !p.isEnterprise)
          .map((plan) => {
            const isCurrent = plan.id === currentPlanId;
            const isSelected = selectedPlan?.id === plan.id;

            return (
              <PlanCard
                key={plan.id}
                plan={plan}
                isCurrent={isCurrent}
                isSelected={isSelected}
                displayPrice={undefined}
                onPress={() => handlePlanSelect(plan)}
              />
            );
          })}
      </View>
    );
  };

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <H1 weight="bold" color="textPrimary">Subscription</H1>
        <Body color="textSecondary" style={styles.tagline}>
          Choose the plan that fits your needs
        </Body>
      </View>

      {currentPlan && (
        <Card variant="elevated" padding="lg" style={styles.currentPlanCard}>
          <View style={styles.currentPlanHeader}>
            <View style={styles.currentPlanIcon}>
              <Ionicons name="shield-checkmark" size={28} color={Theme.colors.success} />
            </View>
            <View style={styles.currentPlanInfo}>
              <H2 weight="semiBold" color="textPrimary">Current Plan</H2>
              <H3 weight="bold" color="textPrimary">{currentPlan.name}</H3>
              <Body color="textSecondary">
                {currentPlan.price === 0
                  ? 'Free'
                  : `$${currentPlan.price.toFixed(2)}/month`}
              </Body>
            </View>
          </View>
          <Button variant="outline" fullWidth onPress={() => setSelectedPlan(currentPlan)}>
            Manage Plan
          </Button>
        </Card>
      )}

      <View style={styles.section}>
        <H2 weight="semiBold" color="textPrimary" style={styles.sectionTitle}>
          Available Plans
        </H2>
        {renderPlansSection()}
      </View>

      <View style={styles.section}>
        <Card variant="outlined" padding="lg" style={styles.enterpriseCard}>
          <View style={styles.enterpriseHeader}>
            <View style={styles.enterpriseIcon}>
              <Ionicons name="business" size={28} color={Theme.colors.cyanAccent} />
            </View>
            <View style={styles.enterpriseInfo}>
              <H3 weight="semiBold" color="textPrimary">Enterprise</H3>
              <Body color="textSecondary">Custom deployment and compliance</Body>
            </View>
          </View>
          <Body color="textSecondary" style={styles.enterpriseDesc}>
            For organizations requiring custom contracts, on-premise deployment, dedicated infrastructure, or specialized compliance frameworks.
          </Body>
          <Button variant="outline" fullWidth style={styles.enterpriseButton}>
            <Ionicons name="mail" size={18} style={{ marginRight: 8 }} />
            Contact Sales
          </Button>
        </Card>
      </View>

      <View style={styles.actions}>
        <Caption color="textMuted" style={styles.stateMessage}>
          In-app billing is not configured in this build. Select a plan to review its features.
        </Caption>
      </View>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

function PlanCard({
  plan,
  isCurrent,
  isSelected,
  displayPrice,
  onPress,
}: {
  plan: SubscriptionPlan;
  isCurrent: boolean;
  isSelected: boolean;
  displayPrice?: string;
  onPress: () => void;
}) {
  const isPopular = plan.isPopular;

  return (
    <Card
      variant={isCurrent ? 'elevated' : isSelected ? 'outlined' : 'default'}
      padding="lg"
      style={[
        styles.planCard,
        isCurrent && styles.planCardCurrent,
        isPopular && styles.planCardPopular,
      ]}
      onPress={onPress}
    >
      {isPopular && (
        <View style={styles.popularBanner}>
          <Caption color="textOnPrimary" weight="semiBold">MOST POPULAR</Caption>
        </View>
      )}
      <View style={styles.planCardHeader}>
        <H3 weight="semiBold" color="textPrimary">{plan.name}</H3>
        <Body color="textSecondary">{plan.description}</Body>
      </View>
      <View style={styles.planCardPrice}>
        <H1 weight="bold" color="textPrimary" style={styles.price}>
          {plan.price === 0
            ? 'Free'
            : displayPrice ?? `$${plan.price.toFixed(2)}`}
        </H1>
        {plan.price > 0 && (
          <Caption color="textMuted" style={styles.period}>
            /{plan.billingPeriod === 'monthly' ? 'month' : 'year'}
          </Caption>
        )}
      </View>
      <View style={styles.planCardFeatures}>
        {plan.features.map((feature, index) => (
          <View key={index} style={styles.featureRow}>
            <Ionicons
              name="checkmark"
              size={16}
              color={Theme.colors.success}
              style={styles.featureCheck}
            />
            <Caption color="textSecondary">{feature}</Caption>
          </View>
        ))}
      </View>
      <Button
        variant={isCurrent ? 'ghost' : isSelected ? 'primary' : 'outline'}
        fullWidth
        style={styles.planCardButton}
        onPress={onPress}
      >
        {isCurrent
          ? 'Current Plan'
          : isSelected
            ? 'Selected'
            : 'Select'}
      </Button>
    </Card>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: Theme.colors.backgroundPrimary,
  },
  content: {
    paddingHorizontal: Theme.spacing[5],
    paddingTop: Theme.spacing[4],
    paddingBottom: Theme.spacing[10],
  },
  header: {
    marginBottom: Theme.spacing[6],
  },
  tagline: {
    marginTop: Theme.spacing[1],
  },
  currentPlanCard: {
    marginBottom: Theme.spacing[6],
  },
  currentPlanHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing[3],
    marginBottom: Theme.spacing[3],
  },
  currentPlanIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 210, 106, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  currentPlanInfo: {},
  section: {
    marginBottom: Theme.spacing[6],
  },
  sectionTitle: {
    marginBottom: Theme.spacing[3],
  },
  stateBlock: {
    minHeight: 200,
  },
  stateMessage: {
    textAlign: 'center',
    marginBottom: Theme.spacing[2],
  },
  plansGrid: {
    gap: Theme.spacing[3],
  },
  planCard: {
    gap: Theme.spacing[3],
    flex: 1,
  },
  planCardCurrent: {
    borderWidth: 2,
    borderColor: Theme.colors.primaryBlue,
  },
  planCardPopular: {
    borderWidth: 2,
    borderColor: Theme.colors.warning,
  },
  popularBanner: {
    position: 'absolute',
    top: -12,
    left: Theme.spacing[4],
    paddingHorizontal: Theme.spacing[2],
    paddingVertical: Theme.spacing[0.5],
    borderRadius: Theme.borderRadius.full,
    backgroundColor: Theme.colors.warning,
  },
  planCardHeader: {
    gap: Theme.spacing[1],
  },
  planCardPrice: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Theme.spacing[1],
  },
  price: {},
  period: {
    marginBottom: Theme.spacing[1],
  },
  planCardFeatures: {
    gap: Theme.spacing[2],
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing[2],
  },
  featureCheck: {},
  planCardButton: {
    marginTop: Theme.spacing[2],
  },
  enterpriseCard: {
    marginBottom: Theme.spacing[6],
  },
  enterpriseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing[3],
    marginBottom: Theme.spacing[3],
  },
  enterpriseIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(63, 231, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  enterpriseInfo: {},
  enterpriseDesc: {
    marginBottom: Theme.spacing[3],
    lineHeight: 22,
  },
  enterpriseButton: {},
  actions: {
    marginTop: Theme.spacing[4],
  },
  restoreButton: {},
  bottomSpacer: {
    height: 40,
  },
});