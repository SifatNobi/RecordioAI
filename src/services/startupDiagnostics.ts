export type StartupStage =
  | 'native-launch'
  | 'js-entry'
  | 'native-polyfills'
  | 'router-loaded'
  | 'root-layout-evaluated'
  | 'providers-mounted'
  | 'navigation-mounted'
  | 'first-screen-rendered'
  | 'splash-dismissed'
  | 'startup-failed';

let lastStage: StartupStage = 'native-launch';

export function recordStartupStage(stage: StartupStage, error?: unknown): void {
  lastStage = stage;
  if (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[startup:${stage}] ${message}`);
    return;
  }
  console.log(`[startup:${stage}]`);
}

export function getLastStartupStage(): StartupStage {
  return lastStage;
}
