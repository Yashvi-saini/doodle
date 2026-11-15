import { NativeModules } from 'react-native';

const GAME_SERVER_PORT = 4001;

/**
 * In development the JS bundle is served by Metro on the dev machine, which also runs the game
 * server, so the bundle URL's host is the right host. EXPO_PUBLIC_GAME_SERVER_URL overrides it.
 */
export function defaultServerUrl(): string {
  // Expo inlines EXPO_PUBLIC_* at build time only for this exact `process.env.NAME` form.
  // Reading it through a variable or destructuring leaves it undefined in release builds.
  const configured = process.env.EXPO_PUBLIC_GAME_SERVER_URL as string | undefined;
  if (configured) return configured;

  const modules = NativeModules as { SourceCode?: { scriptURL?: unknown } };
  const scriptUrl = modules.SourceCode?.scriptURL;
  const host =
    typeof scriptUrl === 'string' ? scriptUrl.match(/^\w+:\/\/([^/:]+)/)?.[1] : undefined;
  return `http://${host ?? 'localhost'}:${GAME_SERVER_PORT}`;
}
