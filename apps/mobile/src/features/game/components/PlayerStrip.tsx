import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../../theme/colors';
import { useGameStore } from '../store/game.store';

/** Compact, horizontally scrolling scoreboard shown during a game. */
export function PlayerStrip() {
  const room = useGameStore((state) => state.room);
  const myId = useGameStore((state) => state.userId);
  if (!room) return null;

  const players = [...room.players].sort((a, b) => b.score - a.score);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {players.map((player) => {
        const isDrawer = player.userId === room.drawerId;
        return (
          <View
            key={player.userId}
            style={[
              styles.chip,
              player.hasGuessed && styles.guessed,
              isDrawer && styles.drawer,
              !player.isConnected && styles.offline,
            ]}
            accessibilityLabel={`${player.displayName}, ${player.score} points${
              isDrawer ? ', drawing' : player.hasGuessed ? ', guessed' : ''
            }`}
          >
            <Text style={styles.name} numberOfLines={1}>
              {isDrawer ? '✏️ ' : player.hasGuessed ? '✅ ' : ''}
              {player.displayName}
              {player.userId === myId ? ' (you)' : ''}
            </Text>
            <Text style={styles.score}>{player.score}</Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingVertical: 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
  },
  guessed: { backgroundColor: '#D7F5DD' },
  drawer: { backgroundColor: '#FFE3B8' },
  offline: { opacity: 0.45 },
  name: { maxWidth: 120, fontSize: 14, fontWeight: '700', color: colors.ink },
  score: { fontSize: 14, fontWeight: '900', color: colors.accent },
});
