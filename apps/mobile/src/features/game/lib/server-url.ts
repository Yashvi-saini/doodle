import { NativeModules } from 'react-native';

/** The public game server that release builds (the shared APK) always talk to. */
const PRODUCTION_SERVER_URL = 'https://doodle-game-server-jgsh.onrender.com';

const DEV_SERVER_PORT = 4001;

/**
 * Development builds use the game server on the dev machine. Metro serves the JS bundle from
 * that same machine, so the bundle URL's host is the right address; `localhost` would point at
 * the phone itself.
 */
function devServerUrl(): string {
  const modules = NativeModules as { SourceCode?: { scriptURL?: unknown } };
  const scriptUrl = modules.SourceCode?.scriptURL;
  const host =
    typeof scriptUrl === 'string' ? scriptUrl.match(/^\w+:\/\/([^/:]+)/)?.[1] : undefined;
  return `http://${host ?? 'localhost'}:${DEV_SERVER_PORT}`;
}

/**
 * Release builds can point at another server with EXPO_PUBLIC_GAME_SERVER_URL at build time.
 * Expo inlines EXPO_PUBLIC_* only for this exact `process.env.NAME` form; reading it through a
 * variable or destructuring leaves it undefined in release builds.
 */
function releaseServerUrl(): string {
  const configured = process.env.EXPO_PUBLIC_GAME_SERVER_URL as string | undefined;
  return configured || PRODUCTION_SERVER_URL;
}

export const SERVER_URL = __DEV__ ? devServerUrl() : releaseServerUrl();
