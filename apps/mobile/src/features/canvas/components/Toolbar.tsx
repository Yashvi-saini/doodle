import { StyleSheet, View } from 'react-native';
import { canRedo, canUndo, visibleStrokes } from '../lib/history';
import { useCanvasStore } from '../store/canvas.store';
import { ToolButton } from './ToolButton';

export function Toolbar() {
  const tool = useCanvasStore((state) => state.tool);
  const history = useCanvasStore((state) => state.history);
  const setTool = useCanvasStore((state) => state.setTool);
  const undo = useCanvasStore((state) => state.undo);
  const redo = useCanvasStore((state) => state.redo);
  const clear = useCanvasStore((state) => state.clear);

  return (
    <View style={styles.row}>
      <ToolButton label="Brush" active={tool === 'brush'} onPress={() => setTool('brush')} />
      <ToolButton label="Eraser" active={tool === 'eraser'} onPress={() => setTool('eraser')} />
      <ToolButton label="Undo" disabled={!canUndo(history)} onPress={undo} />
      <ToolButton label="Redo" disabled={!canRedo(history)} onPress={redo} />
      <ToolButton
        label="Clear"
        accessibilityLabel="Clear canvas"
        disabled={visibleStrokes(history).length === 0}
        onPress={clear}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
});
