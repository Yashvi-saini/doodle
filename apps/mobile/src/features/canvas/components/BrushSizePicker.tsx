import { Pressable, StyleSheet, View } from 'react-native';
import { selectionFeedback } from '../../../lib/haptics';
import { colors } from '../../../theme/colors';
import { BRUSH_SIZES } from '../constants';
import { useCanvasStore } from '../store/canvas.store';

const MAX_DOT = 30;
const largest = BRUSH_SIZES[BRUSH_SIZES.length - 1]!.value;

export function BrushSizePicker() {
  const brushSize = useCanvasStore((state) => state.brushSize);
  const color = useCanvasStore((state) => state.color);
  const tool = useCanvasStore((state) => state.tool);
  const setBrushSize = useCanvasStore((state) => state.setBrushSize);

  const isEraser = tool === 'eraser';

  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel="Brush size">
      {BRUSH_SIZES.map((size) => {
        const selected = size.value === brushSize;
        const dot = Math.max(6, (size.value / largest) * MAX_DOT);
        return (
          <Pressable
            key={size.id}
            accessibilityRole="radio"
            accessibilityLabel={size.name}
            accessibilityState={{ checked: selected }}
            onPress={() => {
              selectionFeedback();
              setBrushSize(size.value);
            }}
            style={[styles.option, selected && styles.optionSelected]}
          >
            <View
              style={[
                styles.dot,
                { width: dot, height: dot },
                isEraser ? styles.eraserDot : { backgroundColor: color },
              ]}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  option: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionSelected: { borderColor: colors.ink },
  dot: { borderRadius: 999, borderWidth: 1.5, borderColor: colors.ink },
  eraserDot: { backgroundColor: colors.surface, borderStyle: 'dashed' },
});
