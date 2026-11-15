import { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import logo from '../../../../assets/logo.png';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../../components/Button';
import { TextField } from '../../../components/TextField';
import { colors } from '../../../theme/colors';
import { gameActions, useGameStore } from '../store/game.store';

interface HomeScreenProps {
  onSolo: () => void;
}

export function HomeScreen({ onSolo }: HomeScreenProps) {
  const name = useGameStore((state) => state.name);
  const error = useGameStore((state) => state.error);
  const waking = useGameStore((state) => state.waking);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);

  const ready = name.trim().length > 0;
  const run = async (which: 'create' | 'join') => {
    setBusy(which);
    if (which === 'create') await gameActions.createRoom();
    else await gameActions.joinRoom(code);
    setBusy(null);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <Image source={logo} style={styles.logo} accessibilityIgnoresInvertColors />
            <Text style={styles.title} accessibilityRole="header">
              Doodle
            </Text>
            <Text style={styles.tagline}>Draw it. Guess it. Win it.</Text>
          </View>

          <TextField
            label="Your name"
            value={name}
            onChangeText={gameActions.setName}
            placeholder="e.g. Yashvi"
            maxLength={20}
            autoCapitalize="words"
            autoCorrect={false}
          />

          <Button
            label="Create a room"
            onPress={() => void run('create')}
            disabled={!ready || busy !== null}
            loading={busy === 'create'}
          />

          <View style={styles.joinRow}>
            <View style={styles.flex}>
              <TextField
                label="Room code"
                value={code}
                onChangeText={(value) => setCode(value.toUpperCase())}
                placeholder="ABC123"
                maxLength={6}
                autoCapitalize="characters"
                autoCorrect={false}
                style={styles.codeInput}
              />
            </View>
            <Button
              label="Join"
              variant="secondary"
              style={styles.joinButton}
              onPress={() => void run('join')}
              disabled={!ready || code.trim().length !== 6 || busy !== null}
              loading={busy === 'join'}
            />
          </View>

          {waking && busy ? (
            <Text style={styles.waking} accessibilityLiveRegion="polite">
              Waking up the game server. The first game can take up to a minute to start…
            </Text>
          ) : null}

          {error ? (
            <Text style={styles.error} accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}

          <Button label="Practice solo" variant="ghost" onPress={onSolo} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    padding: 20,
    paddingTop: 40,
    gap: 18,
  },
  hero: { alignItems: 'center', gap: 6, marginBottom: 12 },
  logo: { width: 120, height: 120 },
  title: { fontSize: 56, fontWeight: '900', color: colors.ink, letterSpacing: -2 },
  tagline: { fontSize: 17, fontWeight: '600', color: colors.muted },
  joinRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-end' },
  joinButton: { minWidth: 96 },
  codeInput: { letterSpacing: 4, fontWeight: '800' },
  error: { color: colors.accent, fontWeight: '700', textAlign: 'center' },
  waking: { color: colors.muted, fontWeight: '600', textAlign: 'center' },
});
