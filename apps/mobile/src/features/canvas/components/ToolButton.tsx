import { Pressable, StyleSheet, Text } from 'react-native';
import { selectionFeedback } from '../../../lib/haptics';
import { colors } from '../../../theme/colors';

interface ToolButtonProps {
  label: string;
  accessibilityLabel?: string;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
}

export function ToolButton({
  label,
  accessibilityLabel,
  active = false,
  disabled = false,
  onPress,
}: ToolButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled}
      hitSlop={4}
      onPress={() => {
        selectionFeedback();
        onPress();
      }}
      style={({ pressed }) => [
        styles.button,
        active && styles.active,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={[styles.label, active && styles.activeLabel, disabled && styles.disabledLabel]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    shadowColor: colors.ink,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  active: { backgroundColor: colors.accent },
  pressed: {
    transform: [{ translateX: 1 }, { translateY: 1 }],
    shadowOffset: { width: 1, height: 1 },
  },
  disabled: { borderColor: colors.disabled, shadowOpacity: 0, elevation: 0 },
  label: { fontSize: 14, fontWeight: '700', color: colors.ink },
  activeLabel: { color: colors.surface },
  disabledLabel: { color: colors.disabled },
});
