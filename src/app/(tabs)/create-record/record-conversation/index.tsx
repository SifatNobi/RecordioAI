import React from 'react';
import { RecordingScreen } from '@/components/recording/RecordingScreen';

export default function RecordConversationScreen() {
  return (
    <RecordingScreen
      title="Record Conversation"
      tagline="Capture a live conversation with the device microphone. Conversations are transcribed and analyzed by AI."
      recordingType="conversation"
    />
  );
}