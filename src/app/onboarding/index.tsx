import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Theme } from '@/constants/theme';
import { H1, H2, Body, Caption } from '@/components/Typography';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useOnboarding } from '@/hooks/useTheme';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface OnboardingStep {
  id: number;
  title: string;
  description: string;
  icon: IoniconName;
  primaryColor: string;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 0,
    title: 'Prove What Your AI Promised.',
    description: 'RecordioAI creates cryptographically verified receipts for every AI agent conversation. Never wonder what was said or agreed upon again.',
    icon: 'shield-checkmark',
    primaryColor: Theme.colors.primaryBlue,
  },
  {
    id: 1,
    title: 'Connect Your AI Agent.',
    description: 'Integrate with your AI voice agent platform. RecordioAI receives conversation data directly from supported providers — no manual recording required.',
    icon: 'hardware-chip',
    primaryColor: Theme.colors.brightBlue,
  },
  {
    id: 2,
    title: 'Every Conversation Gets a Receipt.',
    description: 'Each conversation generates a Conversation Receipt with transcript, extracted products, prices, fees, promises, and commitments — all cryptographically signed.',
    icon: 'document-text',
    primaryColor: Theme.colors.cyanAccent,
  },
  {
    id: 3,
    title: 'Resolve Disagreements with Evidence.',
    description: 'When discrepancies arise, the Resolve Centre lets you create evidence packages with full audit trails. Export verified records for compliance or dispute resolution.',
    icon: 'shield-checkmark',
    primaryColor: Theme.colors.success,
  },
];

export default function OnboardingScreen() {
  const { currentStep, nextStep, complete } = useOnboarding();
  const router = useRouter();

  const step = ONBOARDING_STEPS[currentStep];
  const isLastStep = currentStep === ONBOARDING_STEPS.length - 1;

  const handleContinue = () => {
    if (isLastStep) {
      complete();
      router.replace('/(tabs)');
    } else {
      nextStep();
    }
  };

  const handleSkip = () => {
    complete();
    router.replace('/(tabs)');
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.progressContainer}>
          {ONBOARDING_STEPS.map((s, index) => (
            <View key={s.id} style={styles.progressStep}>
              <View
                style={[
                  styles.progressDot,
                  index <= currentStep && styles.progressDotActive,
                ]}
              />
              {index < ONBOARDING_STEPS.length - 1 && (
                <View
                  style={[
                    styles.progressLine,
                    index < currentStep && styles.progressLineActive,
                  ]}
                />
              )}
            </View>
          ))}
        </View>

        <View style={styles.stepContainer}>
          <View style={styles.iconWrapper}>
            <Ionicons name={step.icon} size={64} color={step.primaryColor} />
          </View>

          <H1 weight="bold" color="textPrimary" style={styles.title}>
            {step.title}
          </H1>

          <Body color="textSecondary" style={styles.description}>
            {step.description}
          </Body>
        </View>

        <View style={styles.actions}>
          <Button
            variant="primary"
            fullWidth
            size="lg"
            onPress={handleContinue}
            style={styles.primaryAction}
          >
            {isLastStep ? 'Get Started' : 'Continue'}
            <Ionicons
              name={isLastStep ? 'checkmark' : 'chevron-forward'}
              size={20}
              style={{ marginLeft: 8 }}
            />
          </Button>

          {!isLastStep && (
            <Button
              variant="ghost"
              fullWidth
              size="md"
              onPress={handleSkip}
              style={styles.skipAction}
            >
              Skip
            </Button>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.backgroundPrimary,
  },
  content: {
    flex: 1,
    paddingHorizontal: Theme.spacing[6],
    paddingTop: Theme.spacing[8],
    paddingBottom: Theme.spacing[10],
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Theme.spacing[8],
  },
  progressStep: {
    flex: 1,
    alignItems: 'center',
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Theme.colors.border,
    backgroundColor: Theme.colors.backgroundPrimary,
  },
  progressDotActive: {
    backgroundColor: Theme.colors.primaryBlue,
    borderColor: Theme.colors.primaryBlue,
  },
  progressLine: {
    position: 'absolute',
    top: 5,
    left: '50%',
    right: '50%',
    height: 2,
    backgroundColor: Theme.colors.border,
  },
  progressLineActive: {
    backgroundColor: Theme.colors.primaryBlue,
  },
  stepContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Theme.spacing[8],
  },
  iconWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Theme.colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Theme.spacing[6],
  },
  title: {
    textAlign: 'center',
    marginBottom: Theme.spacing[4],
    maxWidth: 320,
  },
  description: {
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 24,
  },
  actions: {
    paddingTop: Theme.spacing[4],
    gap: Theme.spacing[3],
    width: '100%',
  },
  primaryAction: {},
  skipAction: {},
});