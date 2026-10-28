import { View, StyleSheet, Text } from "react-native";
import { Link, Stack } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { COLORS } from "@/constants/colors";
import { UI } from "@/constants/ui";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Oops! Not Found" }} />
      <View style={styles.container}>
        <View style={styles.iconCircle}>
          <Ionicons
            name="help-circle-outline"
            size={30}
            color={COLORS.primary}
          />
        </View>

        <Text style={styles.title}>Page not found</Text>

        <Text style={styles.message}>
          The screen you are looking for does not exist.
        </Text>

        <Link href="/" style={styles.button} asChild>
          <Text style={styles.buttonText}>Go back to Home screen</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
    padding: UI.space.xl,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: UI.space.lg,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.textPrimary,
    textAlign: "center",
  },
  message: {
    fontSize: UI.typography.body,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 21,
    marginTop: UI.space.sm,
    marginBottom: UI.space.xl,
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: UI.radius.large,
    paddingHorizontal: UI.space.xl,
    paddingVertical: UI.space.md,
    minHeight: 52,
    justifyContent: "center",
  },
  buttonText: {
    color: COLORS.textOnPrimary,
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
});
