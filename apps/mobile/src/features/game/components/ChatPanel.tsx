import type { ChatMessage } from '@doodle/shared';
import { useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../../../theme/colors';
import { gameActions, playerName, useGameStore } from '../store/game.store';

interface ChatPanelProps {
  placeholder: string;
  disabled?: boolean;
}

export function ChatPanel({ placeholder, disabled = false }: ChatPanelProps) {
  const messages = useGameStore((state) => state.messages);
  const myId = useGameStore((state) => state.userId);
  // Re-render when players change so names resolve.
  useGameStore((state) => state.room?.players);
  const [text, setText] = useState('');
  const list = useRef<FlatList<ChatMessage>>(null);

  const send = () => {
    if (!text.trim()) return;
    gameActions.sendChat(text);
    setText('');
  };

  return (
    <View style={styles.panel}>
      <FlatList
        ref={list}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={messages}
        keyExtractor={(message) => message.id}
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => <Message message={item} isMine={item.userId === myId} />}
        ListEmptyComponent={<Text style={styles.empty}>Guesses and chat show up here.</Text>}
      />
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          onSubmitEditing={send}
          placeholder={placeholder}
          placeholderTextColor={colors.disabled}
          editable={!disabled}
          maxLength={100}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="send"
          submitBehavior="submit"
          accessibilityLabel={placeholder}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send"
          disabled={disabled || !text.trim()}
          onPress={send}
          style={[styles.send, (disabled || !text.trim()) && styles.sendDisabled]}
        >
          <Text style={styles.sendLabel}>Send</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Message({ message, isMine }: { message: ChatMessage; isMine: boolean }) {
  if (message.kind !== 'chat') {
    const isClose = message.kind === 'close_guess';
    return (
      <Text style={[styles.system, isClose && styles.close]} accessibilityLiveRegion="polite">
        {message.text}
      </Text>
    );
  }
  return (
    <Text style={styles.message}>
      <Text style={[styles.author, isMine && styles.mine]}>
        {isMine ? 'You' : playerName(message.userId)}:{' '}
      </Text>
      {message.text}
    </Text>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    minHeight: 120,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  list: { flex: 1 },
  listContent: { padding: 10, gap: 4 },
  empty: { color: colors.muted, fontSize: 14, textAlign: 'center', marginTop: 8 },
  message: { fontSize: 15, color: colors.ink, lineHeight: 20 },
  author: { fontWeight: '800' },
  mine: { color: colors.accent },
  system: { fontSize: 14, fontWeight: '700', color: '#2E7D32', lineHeight: 20 },
  close: { color: '#E65100' },
  inputRow: {
    flexDirection: 'row',
    borderTopWidth: 2,
    borderTopColor: colors.ink,
  },
  input: { flex: 1, minHeight: 46, paddingHorizontal: 12, fontSize: 16, color: colors.ink },
  send: {
    paddingHorizontal: 16,
    justifyContent: 'center',
    backgroundColor: colors.accent,
    borderLeftWidth: 2,
    borderLeftColor: colors.ink,
  },
  sendDisabled: { backgroundColor: colors.disabled },
  sendLabel: { color: colors.surface, fontWeight: '800', fontSize: 15 },
});
