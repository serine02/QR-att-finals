import { Stack } from "expo-router";

export default function RootLayout() {
  return (
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
  );
}
