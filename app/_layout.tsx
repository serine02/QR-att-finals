import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';

import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';

const AUTH_SCREENS = ['login', 'register', 'forgot-password', 'reset-password'];

export default function RootLayout() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Send signed-out users to the login screen from anywhere in the app.
  useEffect(() => {
    if (loading) return;

    const onAuthScreen = AUTH_SCREENS.includes(segments[0] as string);

    if (!user && !onAuthScreen) {
      router.replace('/login');
    }
  }, [loading, user, segments, router]);

  // Hold rendering until the stored session is known, so a signed-in user
  // never flashes the login screen on launch.
  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading QR Attendance...</Text>
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      {/* Authentication screens */}
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="reset-password" />

      {/* Student and Teacher screens */}
      <Stack.Screen name="(tabs)" />

      {/* Administrator dashboard */}
      <Stack.Screen name="admin" />
    </Stack>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
});
