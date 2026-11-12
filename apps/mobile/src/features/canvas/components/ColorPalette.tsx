import { Pressable, StyleSheet, View } from 'react-native';
import { selectionFeedback } from '../../../lib/haptics';
import { colors } from '../../../theme/colors';
import { PALETTE } from '../constants';
import { useCanvasStore } from '../store/canvas.store';

export function ColorPalette() {
  const color = useCanvasStore((state) => state.color);
  const tool = useCanvasStore((state) => state.tool);
  const setColor = useCanvasStore((state) => state.setColor);

  return (
    <View style={styles.grid} accessibilityRole="radiogroup" accessibilityLabel="Brush colour">
      {PALETTE.map((swatch) => {
        const selected = tool === 'brush' && swatch.value === color;
        return (
          <Pressable
            key={swatch.value}
            accessibilityRole="radio"
            accessibilityLabel={swatch.name}
            accessibilityState={{ checked: selected }}
            hitSlop={2}
            onPress={() => {
              selectionFeedback();
              setColor(swatch.value);
            }}
            style={[styles.ring, selected && styles.ringSelected]}
          >
            <View style={[styles.swatch, { backgroundColor: swatch.value }]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
  },
  ring: {
    width: '15.5%',
    aspectRatio: 1,
    padding: 3,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  ringSelected: { borderColor: colors.ink },
  swatch: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.ink,
  },
});
