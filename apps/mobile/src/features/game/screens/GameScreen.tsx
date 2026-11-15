import type { RoomSnapshot } from '@doodle/shared';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../../components/Button';
import { colors } from '../../../theme/colors';
import { BrushSizePicker } from '../../canvas/components/BrushSizePicker';
import { ColorPalette } from '../../canvas/components/ColorPalette';
import { ToolButton } from '../../canvas/components/ToolButton';
import { useCanvasStore } from '../../canvas/store/canvas.store';
import { ChatPanel } from '../components/ChatPanel';
import { GameCanvas } from '../components/GameCanvas';
import { PlayerStrip } from '../components/PlayerStrip';
import { useCountdown } from '../hooks/useCountdown';
import { gameActions, playerName, useGameStore } from '../store/game.store';

interface GameScreenProps {
  room: RoomSnapshot;
}

export function GameScreen({ room }: GameScreenProps) {
  const myId = useGameStore((state) => state.userId);
  const word = useGameStore((state) => state.word);
  const wordChoices = useGameStore((state) => state.wordChoices);
  const turnResult = useGameStore((state) => state.turnResult);
  const totalRounds = useGameStore((state) => state.totalRounds);
  const connection = useGameStore((state) => state.connection);
  const seconds = useCountdown(room.turnEndsAt);

  const isDrawer = room.drawerId === myId;
  const me = room.players.find((player) => player.userId === myId);
  const isDrawing = room.phase === 'drawing';
  const canDraw = isDrawer && isDrawing;

  const overlay = (() => {
    if (room.phase === 'choosing') {
      if (isDrawer && wordChoices) {
        return (
          <View style={styles.choices}>
            <Text style={styles.overlayTitle}>Pick a word</Text>
            {wordChoices.map((choice, index) => (
              <Button
                key={choice}
                label={choice}
                variant="secondary"
                onPress={() => void gameActions.chooseWord(index)}
              />
            ))}
          </View>
        );
      }
      return (
        <Text style={styles.overlayTitle}>
          {isDrawer ? 'Picking a word…' : `${playerName(room.drawerId)} is choosing a word…`}
        </Text>
      );
    }
    if (room.phase === 'turn_end' && turnResult) {
      const reason = {
        time_up: "Time's up!",
        all_guessed: 'Everyone got it!',
        drawer_left: 'The drawer left',
      }[turnResult.reason];
      return (
        <View style={styles.result}>
          <Text style={styles.overlayTitle}>{reason}</Text>
          <Text style={styles.resultWord}>The word was “{turnResult.word}”</Text>
          {turnResult.scores.map((score) => (
            <Text key={score.userId} style={styles.resultScore}>
              {playerName(score.userId)} +{score.points}
            </Text>
          ))}
        </View>
      );
    }
    return null;
  })();

  const headline = isDrawing ? (isDrawer ? `Draw: ${word ?? '…'}` : (room.hint ?? '')) : '';

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.round}>
              Round {room.round}/{totalRounds || room.settings.rounds}
            </Text>
            <Text style={[styles.timer, seconds !== null && seconds <= 10 && styles.timerLow]}>
              {seconds !== null ? `${seconds}s` : ''}
            </Text>
            <Button label="Leave" variant="ghost" onPress={gameActions.leaveRoom} />
          </View>

          <PlayerStrip />

          <Text
            style={[styles.headline, !isDrawer && isDrawing && styles.hint]}
            accessibilityLiveRegion="polite"
          >
            {headline}
          </Text>

          <GameCanvas canDraw={canDraw} overlay={overlay} />

          {connection === 'reconnecting' ? (
            <Text style={styles.reconnecting}>Reconnecting…</Text>
          ) : null}

          {canDraw ? (
            <DrawerTools />
          ) : (
            <ChatPanel
              placeholder={
                isDrawer
                  ? 'Chat with players who guessed'
                  : me?.hasGuessed
                    ? 'You got it! Chat with the drawer'
                    : 'Type your guess…'
              }
              disabled={room.phase === 'game_end'}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function DrawerTools() {
  const tool = useCanvasStore((state) => state.tool);
  const setTool = useCanvasStore((state) => state.setTool);
  const strokes = useGameStore((state) => state.room?.strokes.length ?? 0);

  return (
    <View style={styles.tools}>
      <View style={styles.toolRow}>
        <ToolButton label="Brush" active={tool === 'brush'} onPress={() => setTool('brush')} />
        <ToolButton label="Eraser" active={tool === 'eraser'} onPress={() => setTool('eraser')} />
        <ToolButton label="Undo" disabled={strokes === 0} onPress={gameActions.undo} />
        <ToolButton label="Clear" disabled={strokes === 0} onPress={gameActions.clear} />
      </View>
      <BrushSizePicker />
      <ColorPalette />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 10,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  round: { fontSize: 15, fontWeight: '800', color: colors.muted },
  timer: { fontSize: 24, fontWeight: '900', color: colors.ink, minWidth: 60, textAlign: 'center' },
  timerLow: { color: colors.accent },
  headline: {
    minHeight: 30,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '900',
    color: colors.ink,
  },
  hint: { letterSpacing: 4, fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }) },
  choices: { width: '100%', maxWidth: 320, gap: 10 },
  overlayTitle: { fontSize: 22, fontWeight: '900', color: colors.ink, textAlign: 'center' },
  result: { alignItems: 'center', gap: 6 },
  resultWord: { fontSize: 18, fontWeight: '700', color: colors.ink },
  resultScore: { fontSize: 15, fontWeight: '700', color: '#2E7D32' },
  reconnecting: { textAlign: 'center', color: colors.accent, fontWeight: '800' },
  tools: { gap: 12 },
  toolRow: { flexDirection: 'row', gap: 8 },
});
