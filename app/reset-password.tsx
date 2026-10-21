import { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';

import AppButton from '@/components/AppButton';
import Header from '@/components/Header';
import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

// Pull the PKCE auth code (?code=...) out of the emailed reset link.
function extractCode(url: string): string | null {
  try {
    const code = new URL(url).searchParams.get('code');
    if (code) return code;
  } catch {
    // Fall through to expo-linking's parser below.
  }

  const parsed = Linking.parse(url);
  const query = parsed.queryParams?.code;

  return typeof query === 'string' && query ? query : null;
}

export default function ResetPasswordScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  // The reset link carries a one-time code. Exchange it for a session so the
  // password can be updated. Runs on cold start and when the app is already
  // open when the link is tapped.
  useEffect(() => {
    let cancelled = false;

    const establish = async (url: string | null) => {
      if (!url) return;

      const code = extractCode(url);
      if (!code) return;

      const { error: exchangeError } =
        await supabase.auth.exchangeCodeForSession(code);

      if (!cancelled && exchangeError) {
        setError(
          'This reset link has expired or belongs to another device. Request a new link from the Sign In screen.',
        );
      }
    };

    Linking.getInitialURL().then(establish);

    const subscription = Linking.addEventListener('url', ({ url }) => {
      establish(url);
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  const handleUpdate = async () => {
    setError(null);

    if (!password) {
      setError('Enter a new password.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSaving(true);

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      setSaving(false);
      setError(updateError.message);
      return;
    }

    // Password changed: sign out and let the user log in fresh.
    await supabase.auth.signOut();
    setSaving(false);
    setDone(true);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.headerContainer}>
              <Header title="QR Attendance" />
            </View>

            <Text style={styles.title}>Choose a New Password</Text>

            {done ? (
              <View style={styles.successContainer}>
                <Text style={styles.successTitle}>Password updated!</Text>
                <Text style={styles.successText}>
                  Your password has been changed. Sign in with your new
                  password.
                </Text>
              </View>
            ) : authLoading ? (
              <ActivityIndicator
                size="large"
                color={COLORS.primary}
                style={styles.loader}
              />
            ) : user ? (
              <>
                <Text style={styles.subtitle}>
                  Set a new password for {user.email ?? 'your account'}.
                </Text>

                <View style={styles.form}>
                  <Text style={styles.label}>New Password</Text>

                  <TextInput
                    style={styles.input}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="At least 6 characters"
                    placeholderTextColor={COLORS.textSecondary}
                    secureTextEntry
                    autoCapitalize="none"
                    editable={!saving}
                  />

                  <Text style={styles.label}>Confirm Password</Text>

                  <TextInput
                    style={styles.input}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Re-enter your new password"
                    placeholderTextColor={COLORS.textSecondary}
                    secureTextEntry
                    autoCapitalize="none"
                    editable={!saving}
                  />

                  {error && <Text style={styles.error}>{error}</Text>}

                  {saving ? (
                    <ActivityIndicator
                      size="large"
                      color={COLORS.primary}
                      style={styles.loader}
                    />
                  ) : (
                    <AppButton
                      theme="primary"
                      title="Update Password"
                      icon="key-outline"
                      onPress={handleUpdate}
                    />
                  )}
                </View>
              </>
            ) : (
              <View style={styles.infoContainer}>
                {error && <Text style={styles.error}>{error}</Text>}

                <Text style={styles.infoText}>
                  Open the password reset link from your email on this device,
                  then choose a new password here. Links only work on the device
                  that requested them.
                </Text>
              </View>
            )}

            {done ? (
              <AppButton
                theme="primary"
                title="Go to Sign In"
                icon="log-in-outline"
                onPress={() => router.replace('/login')}
              />
            ) : (
              <Link href="/login" style={styles.link}>
                Back to Sign In
              </Link>
            )}
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  headerContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  form: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  error: {
    fontSize: 14,
    color: '#C62828',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  loader: {
    marginVertical: 16,
  },
  link: {
    fontSize: 14,
    color: COLORS.primary,
    textAlign: 'center',
    fontWeight: '600',
  },
  infoContainer: {
    marginBottom: 24,
    padding: 20,
    backgroundColor: COLORS.card,
    borderRadius: 14,
  },
  infoText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  successContainer: {
    alignItems: 'center',
    marginBottom: 24,
    padding: 20,
    backgroundColor: COLORS.card,
    borderRadius: 14,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  successText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
