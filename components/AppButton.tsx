import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { COLORS } from "@/constants/colors";
import { UI } from "@/constants/ui";

type Props = {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  theme?: "primary";
  disabled?: boolean;
  onPress: () => void;
};

export default function AppButton({
  title,
  icon,
  theme,
  disabled = false,
  onPress,
}: Props) {
  const primary = theme === "primary";

  return (
    <View style={styles.wrapper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.button,
          primary ? styles.primary : styles.secondary,
          pressed && styles.pressed,
          disabled && styles.disabled,
        ]}
      >
        <Ionicons
          name={icon}
          size={20}
          color={primary ? COLORS.textOnPrimary : COLORS.primary}
          style={styles.icon}
        />

        <Text style={[styles.label, primary && styles.primaryLabel]}>
          {title}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    marginBottom: 12,
  },

  button: {
    minHeight: 52,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: UI.radius.large,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },

  primary: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },

  secondary: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
  },

  pressed: {
    opacity: 0.78,
  },

  disabled: {
    opacity: 0.5,
  },

  icon: {
    marginRight: 10,
  },

  label: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.textPrimary,
    textAlign: "center",
  },

  primaryLabel: {
    color: COLORS.textOnPrimary,
  },
});
