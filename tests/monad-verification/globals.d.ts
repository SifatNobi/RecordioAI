// Minimal ambient declaration so the app sources can be compiled in isolation
// from React Native's global types. Only the surface actually used is declared.
declare const process: {
  env: Record<string, string | undefined>;
};
