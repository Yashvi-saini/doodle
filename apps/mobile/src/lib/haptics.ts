import * as Haptics from 'expo-haptics';

export function selectionFeedback(): void {
  Haptics.selectionAsync().catch(() => undefined);
}
