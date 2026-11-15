import { NativeModules } from 'react-native';

const GAME_SERVER_PORT = 4001;

/**
 * In development the JS bundle is served by Metro on the dev machine, which also runs the game
 * server, so the bundle URL's host is the right host. EXPO_PUBLIC_GAME_SERVER_URL overrides it.
 */
export function defaultServerUrl(): string {
  const env = process.env as Record<string, string | undefined>;
  const configured = env.EXPO_PUBLIC_GAME_SERVER_URL;
  if (configured) return configured;

  const modules = NativeModules as { SourceCode?: { scriptURL?: unknown } };
  const scriptUrl = modules.SourceCode?.scriptURL;
  const host =
    typeof scriptUrl === 'string' ? scriptUrl.match(/^\w+:\/\/([^/:]+)/)?.[1] : undefined;
  return `http://${host ?? 'localhost'}:${GAME_SERVER_PORT}`;
}
