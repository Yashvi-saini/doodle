import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CanvasScreen } from './features/canvas';
import { GameScreen } from './features/game/screens/GameScreen';
import { HomeScreen } from './features/game/screens/HomeScreen';
import { LobbyScreen } from './features/game/screens/LobbyScreen';
import { useGameStore } from './features/game/store/game.store';
import { queryClient } from './lib/query-client';
import { colors } from './theme/colors';

function Router() {
  const room = useGameStore((state) => state.room);
  const [solo, setSolo] = useState(false);

  if (solo) return <CanvasScreen onBack={() => setSolo(false)} />;
  if (!room) return <HomeScreen onSolo={() => setSolo(true)} />;
  if (room.phase === 'lobby' || room.phase === 'game_end') return <LobbyScreen room={room} />;
  return <GameScreen room={room} />;
}

export function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="dark" />
          <Router />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
});
