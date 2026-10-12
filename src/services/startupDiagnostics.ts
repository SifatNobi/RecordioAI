export type StartupStage =
  | 'native-launch'
  | 'js-entry'
  | 'native-polyfills'
  | 'router-loaded'
  | 'root-layout-evaluated'
  | 'providers-mounted'
  | 'hydration-complete'
  | 'provenance-recovery-started'
  | 'navigation-mounted'
  | 'first-screen-rendered'
  | 'splash-dismissed'
  | 'startup-failed';

let lastStage: StartupStage = 'native-launch';
const stages: { stage: StartupStage; timestamp: number; error?: string }[] = [];

export function recordStartupStage(stage: StartupStage, error?: unknown): void {
  lastStage = stage;
  const timestamp = Date.now();
  
  if (error) {
    const message = error instanceof Error ? error.message : String(error);
    stages.push({ stage, timestamp, error: message });
    console.error(`[startup:${stage}] ${message}`);
    return;
  }
  
  stages.push({ stage, timestamp });
  console.log(`[startup:${stage}]`);
}

export function getLastStartupStage(): StartupStage {
  return lastStage;
}

export function getStartupDiagnostics(): { stage: StartupStage; timestamp: number; error?: string }[] {
  return [...stages];
}
