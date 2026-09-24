import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card } from '@/components/Card';
import { Body, Caption } from '@/components/Typography';
import { Theme } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { RecordingScreen } from '@/components/recording/RecordingScreen';

export default function PhoneCallScreen() {
  return (
    <RecordingScreen
      title="Phone Call"
      tagline="Record an active phone call. The audio is transcribed and analyzed by AI."
      recordingType="phone_call"
      banner={
        <View style={styles.bannerGroup}>
          <Card variant="outlined" padding="md" style={styles.capabilityCard}>
            <View style={styles.capabilityRow}>
              <Ionicons name="warning" size={20} color={Theme.colors.warning} />
              <Body color="textSecondary" style={styles.capabilityText}>
                Android records calls through the device microphone only. The other party&apos;s audio may be quiet, depending on speaker mode.
              </Body>
            </View>
          </Card>
          <Card variant="outlined" padding="md" style={styles.consentCard}>
            <View style={styles.capabilityRow}>
              <Ionicons name="shield-checkmark" size={20} color={Theme.colors.cyanAccent} />
              <Caption color="textMuted" style={styles.capabilityText}>
                Make sure all parties consent to being recorded before you start.
              </Caption>
            </View>
          </Card>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  bannerGroup: {
    gap: Theme.spacing[3],
    marginBottom: Theme.spacing[4],
  },
  capabilityCard: {},
  consentCard: {},
  capabilityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Theme.spacing[2],
  },
  capabilityText: {
    flex: 1,
    lineHeight: 20,
  },
});