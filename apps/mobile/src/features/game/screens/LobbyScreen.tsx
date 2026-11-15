import type { GameSettings, RoomSnapshot } from '@doodle/shared';
import { useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../../components/Button';
import { selectionFeedback } from '../../../lib/haptics';
import { colors } from '../../../theme/colors';
import { gameActions, useGameStore } from '../store/game.store';

interface LobbyScreenProps {
  room: RoomSnapshot;
}

const ROUNDS = [1, 2, 3, 5];
const DRAW_TIMES = [30, 60, 80, 120];

export function LobbyScreen({ room }: LobbyScreenProps) {
  const myId = useGameStore((state) => state.userId);
  const error = useGameStore((state) => state.error);
  const leaderboard = useGameStore((state) => state.leaderboard);
  const [starting, setStarting] = useState(false);

  const isHost = room.hostId === myId;
  const connected = room.players.filter((player) => player.isConnected).length;
  const canStart = isHost && connected >= 2;

  const start = async () => {
    setStarting(true);
    await gameActions.startGame();
    setStarting(false);
  };

  const share = () => {
    Share.share({ message: `Join my Doodle game! Room code: ${room.code}` }).catch(() => undefined);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topRow}>
          <Button label="Leave" variant="ghost" onPress={gameActions.leaveRoom} />
          {leaderboard ? <Text style={styles.endedBadge}>Game over</Text> : null}
        </View>

        <Pressable onPress={share} accessibilityRole="button" accessibilityLabel="Share room code">
          <View style={styles.codeCard}>
            <Text style={styles.codeLabel}>Room code · tap to share</Text>
            <Text style={styles.code}>{room.code}</Text>
          </View>
        </Pressable>

        <Section title={`Players (${room.players.length}/${room.settings.maxPlayers})`}>
          {room.players.map((player) => {
            const score = leaderboard?.find((entry) => entry.userId === player.userId);
            return (
              <View
                key={player.userId}
                style={[styles.player, !player.isConnected && styles.offline]}
              >
                <Text style={styles.playerName}>
                  {score ? `#${score.rank} ` : ''}
                  {player.displayName}
                  {player.userId === myId ? ' (you)' : ''}
                  {player.userId === room.hostId ? ' 👑' : ''}
                </Text>
                {score ? <Text style={styles.playerScore}>{score.score}</Text> : null}
                {isHost && player.userId !== myId ? (
                  <Pressable
                    onPress={() => void gameActions.kick(player.userId)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Kick ${player.displayName}`}
                  >
                    <Text style={styles.kick}>Kick</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </Section>

        <Section title="Settings">
          <SettingRow
            label="Rounds"
            options={ROUNDS}
            value={room.settings.rounds}
            editable={isHost}
            onChange={(rounds) => void gameActions.updateSettings({ rounds })}
          />
          <SettingRow
            label="Draw time"
            options={DRAW_TIMES}
            value={room.settings.drawTimeS}
            editable={isHost}
            format={(seconds) => `${seconds}s`}
            onChange={(drawTimeS) => void gameActions.updateSettings({ drawTimeS })}
          />
        </Section>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {isHost ? (
          <Button
            label={leaderboard ? 'Play again' : 'Start game'}
            onPress={() => void start()}
            disabled={!canStart}
            loading={starting}
          />
        ) : (
          <Text style={styles.waiting}>Waiting for the host to start…</Text>
        )}
        {isHost && connected < 2 ? (
          <Text style={styles.hint}>Share the code. You need at least 2 players.</Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

interface SettingRowProps<K extends keyof GameSettings> {
  label: string;
  options: GameSettings[K][];
  value: GameSettings[K];
  editable: boolean;
  format?: (value: GameSettings[K]) => string;
  onChange: (value: GameSettings[K]) => void;
}

function SettingRow<K extends 'rounds' | 'drawTimeS'>({
  label,
  options,
  value,
  editable,
  format = String,
  onChange,
}: SettingRowProps<K>) {
  return (
    <View style={styles.setting}>
      <Text style={styles.settingLabel}>{label}</Text>
      <View style={styles.segments}>
        {options.map((option) => {
          const selected = option === value;
          return (
            <Pressable
              key={option}
              disabled={!editable}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, disabled: !editable }}
              onPress={() => {
                selectionFeedback();
                onChange(option);
              }}
              style={[styles.segment, selected && styles.segmentSelected]}
            >
              <Text style={[styles.segmentLabel, selected && styles.segmentLabelSelected]}>
                {format(option)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 520, alignSelf: 'center', padding: 20, gap: 18 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  endedBadge: { fontWeight: '800', color: colors.accent },
  codeCard: {
    alignItems: 'center',
    gap: 4,
    padding: 18,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    shadowColor: colors.ink,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  codeLabel: { fontSize: 12, fontWeight: '800', color: colors.muted, textTransform: 'uppercase' },
  code: { fontSize: 44, fontWeight: '900', letterSpacing: 8, color: colors.ink },
  section: { gap: 8 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.muted,
    textTransform: 'uppercase',
  },
  card: {
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
  },
  player: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  offline: { opacity: 0.45 },
  playerName: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.ink },
  playerScore: { fontSize: 16, fontWeight: '900', color: colors.accent },
  kick: { color: colors.muted, fontWeight: '700' },
  setting: { paddingVertical: 12, gap: 8 },
  settingLabel: { fontSize: 15, fontWeight: '700', color: colors.ink },
  segments: { flexDirection: 'row', gap: 6 },
  segment: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
  },
  segmentSelected: { borderColor: colors.ink, backgroundColor: colors.accent },
  segmentLabel: { fontWeight: '700', color: colors.ink },
  segmentLabelSelected: { color: colors.surface },
  error: { color: colors.accent, fontWeight: '700', textAlign: 'center' },
  waiting: { textAlign: 'center', fontWeight: '700', color: colors.muted, paddingVertical: 14 },
  hint: { textAlign: 'center', color: colors.muted },
});
