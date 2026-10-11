import 'react-native-get-random-values';
import React from 'react';
import { Text, View } from 'react-native';
import { registerRootComponent } from 'expo';
import * as SplashScreen from 'expo-splash-screen';
import { recordStartupStage } from '@/services/startupDiagnostics';

recordStartupStage('js-entry');
recordStartupStage('native-polyfills');

interface StartupErrorBoundaryState {
  error: Error | null;
}

class StartupErrorBoundary extends React.Component<
  React.PropsWithChildren,
  StartupErrorBoundaryState
> {
  state: StartupErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): StartupErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error): void {
    recordStartupStage('startup-failed', error);
    console.error(`[startup] render failure: ${error.message}`, error.stack);
    void SplashScreen.hideAsync().catch(() => {});
  }

  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, backgroundColor: '#000000', justifyContent: 'center', padding: 24 }}>
          <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '600', marginBottom: 12 }}>
            RecordioAI could not start
          </Text>
          <Text style={{ color: '#b8b8b8', fontSize: 14 }}>
            {this.state.error.message || 'Restart the app and try again.'}
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

let RouterApp: React.ComponentType;
try {
  RouterApp = require('expo-router/build/qualified-entry').App;
  recordStartupStage('router-loaded');
} catch (error) {
  recordStartupStage('startup-failed', error);
  const startupError = error instanceof Error ? error : new Error(String(error));
  RouterApp = () => {
    void SplashScreen.hideAsync().catch(() => {});
    return (
      <View style={{ flex: 1, backgroundColor: '#000000', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '600', marginBottom: 12 }}>
          RecordioAI could not load
        </Text>
        <Text style={{ color: '#b8b8b8', fontSize: 14 }}>{startupError.message}</Text>
      </View>
    );
  };
}

registerRootComponent(() => (
  <StartupErrorBoundary>
    <RouterApp />
  </StartupErrorBoundary>
));
