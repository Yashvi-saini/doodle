import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../../theme/colors';
import { BrushSizePicker } from '../components/BrushSizePicker';
import { ColorPalette } from '../components/ColorPalette';
import { DrawingCanvas } from '../components/DrawingCanvas';
import { Toolbar } from '../components/Toolbar';

export function CanvasScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">
            Doodle
          </Text>
          <Text style={styles.subtitle}>Solo sketchpad</Text>
        </View>

        <DrawingCanvas />

        <View style={styles.controls}>
          <Toolbar />
          <BrushSizePicker />
          <ColorPalette />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 16,
  },
  header: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  title: { fontSize: 30, fontWeight: '900', color: colors.ink, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, fontWeight: '600', color: colors.muted },
  controls: { gap: 14 },
});
