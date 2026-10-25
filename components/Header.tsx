import { Image, StyleSheet, Text, View } from "react-native";

import { COLORS } from "@/constants/colors";
import { UI } from "@/constants/ui";

type Props = {
  title: string;
};

export default function Header({ title }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.logoCircle}>
        <Image
          source={require("@/assets/images/icon.png")}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingVertical: 18,
  },

  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: UI.radius.large,
    backgroundColor: COLORS.surface,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
    overflow: "hidden",
  },

  logo: {
    width: 60,
    height: 60,
  },

  title: {
    fontSize: UI.typography.page,
    fontWeight: "700",
    color: COLORS.textPrimary,
    textAlign: "center",
  },
});
