import { Stack, usePathname } from "expo-router";
import { StyleSheet, View } from "react-native";

import AdminBottomNav from "@/components/AdminBottomNav";

export default function RootLayout() {
  const pathname = usePathname();

  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");

  return (
    <View style={styles.container}>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "fade",
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="(tabs)" />

        <Stack.Screen name="admin" />
        <Stack.Screen name="admin/users" />
        <Stack.Screen name="admin/events" />
        <Stack.Screen name="admin/attendance" />
        <Stack.Screen name="admin/reports" />
      </Stack>

      {isAdminRoute && <AdminBottomNav />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
