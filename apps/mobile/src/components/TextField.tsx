import { StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';
import { colors } from '../theme/colors';

interface TextFieldProps extends TextInputProps {
  label?: string;
}

export function TextField({ label, style, ...props }: TextFieldProps) {
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.disabled}
        accessibilityLabel={label}
        {...props}
        style={[styles.input, style]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontSize: 13, fontWeight: '800', color: colors.muted, textTransform: 'uppercase' },
  input: {
    minHeight: 50,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    fontSize: 17,
    fontWeight: '600',
    color: colors.ink,
  },
});
