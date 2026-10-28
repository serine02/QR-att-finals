import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, Text, View } from "react-native";

import { COLORS } from "@/constants/colors";

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
};

export default function EmptyState({ icon, title, message }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={30} color={COLORS.primary} />
      </View>

      <Text style={styles.title}>{title}</Text>

      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
  },

  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },

  title: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textPrimary,
    textAlign: "center",
  },

  message: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 19,
    marginTop: 8,
  },
});
