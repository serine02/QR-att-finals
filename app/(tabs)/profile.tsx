import { useState, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  Alert,
  TextInput,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";

import AppButton from "@/components/AppButton";
import Badge from "@/components/Badge";
import { COLORS } from "@/constants/colors";
import { UI } from "@/constants/ui";
import { useAuth, signOut } from "@/lib/auth";
import { getProfile, updateProfile, type Profile } from "@/lib/profiles";

export default function ProfileScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [draftName, setDraftName] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load the latest profile from Supabase.
  const loadProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setDraftName("");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const latestProfile = await getProfile(user.id);

      setProfile(latestProfile);
      setDraftName(latestProfile?.full_name ?? "");

      if (!latestProfile) {
        console.warn("No profile was returned for the signed-in user.");
      }
    } catch (error: unknown) {
      console.error("Failed to load profile:", error);

      const message =
        error instanceof Error
          ? error.message
          : "Unable to load your latest profile.";

      Alert.alert("Profile Error", message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  // Reload the profile whenever the screen becomes active.
  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile]),
  );

  // Manually refresh the profile.
  const handleRefresh = async () => {
    if (refreshing) return;

    setRefreshing(true);
    await loadProfile();
  };

  // Save the updated full name.
  const handleSaveName = async () => {
    if (!user) {
      Alert.alert("Error", "No signed-in user was found.");
      return;
    }

    const trimmedName = draftName.trim();

    if (!trimmedName) {
      Alert.alert("Invalid Name", "Please enter your name.");
      return;
    }

    if (trimmedName.length > 100) {
      Alert.alert("Invalid Name", "Your name must not exceed 100 characters.");
      return;
    }

    setSaving(true);

    try {
      const { error } = await updateProfile(user.id, {
        full_name: trimmedName,
      });

      if (error) {
        Alert.alert("Update Failed", error);
        return;
      }

      setProfile((previous) =>
        previous ? { ...previous, full_name: trimmedName } : previous,
      );

      setDraftName(trimmedName);
      setEditing(false);

      Alert.alert("Success", "Your name has been updated successfully.");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to update your name.";

      Alert.alert("Error", message);
    } finally {
      setSaving(false);
    }
  };

  // Cancel editing and restore the saved name.
  const handleCancelEdit = () => {
    setDraftName(profile?.full_name ?? "");
    setEditing(false);
  };

  // Check the sign-out result before navigating away.
  const performSignOut = async () => {
    if (loading || saving) return;
    setLoading(true);

    try {
      const { error } = await signOut();
      if (error) {
        Alert.alert("Sign Out Failed", error.message);
        return;
      }
      router.replace("/login");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to sign out.";
      Alert.alert("Sign Out Failed", message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    if (loading || saving) return;
    Alert.alert(
      "Sign Out?",
      "Are you sure you want to sign out of your account?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: () => void performSignOut(),
        },
      ],
    );
  };

  // Determine the displayed account role.
  const normalizedRole = profile?.role?.trim().toLowerCase();

  const roleLabel =
    normalizedRole === "administrator" || normalizedRole === "admin"
      ? "Administrator"
      : normalizedRole === "teacher"
        ? "Teacher"
        : normalizedRole === "student"
          ? "Student"
          : profile?.role || "Unknown Role";

  const roleTone =
    normalizedRole === "administrator" || normalizedRole === "admin"
      ? "info"
      : normalizedRole === "teacher"
        ? "unscheduled"
        : "confirmed";

  // Initial loading screen.
  if (loading && !profile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.primary}
          />
        }
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.title}>My Profile</Text>
            <Text style={styles.subtitle}>
              View and manage your account information.
            </Text>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleRefresh}
            disabled={refreshing}
          >
            <Text style={styles.secondaryButtonText}>
              {refreshing ? "Loading..." : "Refresh"}
            </Text>
          </Pressable>
        </View>

        {profile ? (
          <View style={styles.infoCard}>
            {/* Profile Avatar */}
            <View style={styles.avatarRow}>
              <View style={styles.profileIcon}>
                <Text style={styles.profileIconText}>
                  {(profile.full_name || profile.email || "U")
                    .trim()
                    .charAt(0)
                    .toUpperCase()}
                </Text>
              </View>

              <View style={styles.avatarInfo}>
                <Text style={styles.avatarName} numberOfLines={2}>
                  {profile.full_name || "No name added"}
                </Text>

                <Badge label={roleLabel} tone={roleTone} />
              </View>
            </View>

            {/* Full Name */}
            <View style={styles.section}>
              <Text style={styles.label}>Full Name</Text>

              {editing ? (
                <>
                  <TextInput
                    style={styles.input}
                    value={draftName}
                    onChangeText={setDraftName}
                    placeholder="Enter your name"
                    placeholderTextColor={COLORS.textSecondary}
                    autoCapitalize="words"
                    autoCorrect={false}
                    editable={!saving}
                    maxLength={100}
                    returnKeyType="done"
                    onSubmitEditing={handleSaveName}
                  />

                  <View style={styles.editActions}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.primaryButton,
                        saving && styles.buttonDisabled,
                        pressed && styles.buttonPressed,
                      ]}
                      onPress={handleSaveName}
                      disabled={saving}
                    >
                      {saving ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.primaryButtonText}>
                          Save Changes
                        </Text>
                      )}
                    </Pressable>

                    <Pressable
                      style={({ pressed }) => [
                        styles.secondaryButton,
                        styles.growButton,
                        pressed && styles.buttonPressed,
                      ]}
                      onPress={handleCancelEdit}
                      disabled={saving}
                    >
                      <Text style={styles.secondaryButtonTextNeutral}>
                        Cancel
                      </Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <View style={styles.nameRow}>
                  <Text style={styles.value}>
                    {profile.full_name || "No name added"}
                  </Text>

                  <Pressable
                    onPress={() => {
                      setDraftName(profile.full_name ?? "");
                      setEditing(true);
                    }}
                    style={({ pressed }) => [
                      styles.secondaryButton,
                      pressed && styles.buttonPressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Edit full name"
                  >
                    <Text style={styles.secondaryButtonText}>Edit</Text>
                  </Pressable>
                </View>
              )}
            </View>

            <View style={styles.divider} />

            {/* Email Address */}
            <View style={styles.section}>
              <Text style={styles.label}>Email Address</Text>
              <Text style={styles.value}>
                {profile.email || user?.email || "No email available"}
              </Text>
            </View>

            <View style={styles.divider} />

            {/* Account Role */}
            <View style={styles.section}>
              <Text style={styles.label}>Account Role</Text>
              <Text style={styles.value}>{roleLabel}</Text>
            </View>

            <View style={styles.divider} />

            {/* User ID */}
            <View style={styles.section}>
              <Text style={styles.label}>User ID</Text>
              <Text selectable style={styles.valueSmall}>
                {profile.id}
              </Text>
            </View>

            <Text style={styles.refreshHint}>
              Pull down to refresh your profile and check for updated account
              information.
            </Text>
          </View>
        ) : (
          /* Profile Unavailable */
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Profile unavailable</Text>

            <Text style={styles.emptyText}>
              Your profile could not be loaded. Check your connection and try
              again.
            </Text>

            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                styles.growButton,
                refreshing && styles.buttonDisabled,
                pressed && styles.buttonPressed,
              ]}
              onPress={handleRefresh}
              disabled={refreshing}
            >
              <Text style={styles.primaryButtonText}>
                {refreshing ? "Loading..." : "Retry"}
              </Text>
            </Pressable>
          </View>
        )}

        {/* Sign Out */}
        <View style={styles.signOutContainer}>
          <AppButton
            title="Sign Out"
            icon="log-out-outline"
            onPress={handleSignOut}
            disabled={loading || saving}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingHorizontal: UI.space.xl,
    paddingTop: UI.space.xl,
    paddingBottom: 40,
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: UI.typography.body,
    color: COLORS.textSecondary,
    marginTop: UI.space.md,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: UI.space.xl,
    gap: UI.space.md,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: UI.typography.caption + 1,
    color: COLORS.textSecondary,
    marginTop: 6,
    lineHeight: 19,
  },
  infoCard: {
    backgroundColor: COLORS.card,
    borderRadius: UI.radius.large,
    padding: 20,
    marginBottom: UI.space.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: UI.space.md,
    marginBottom: UI.space.lg,
    paddingBottom: UI.space.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  profileIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
  },
  profileIconText: {
    color: COLORS.primary,
    fontSize: 28,
    fontWeight: "800",
  },
  avatarInfo: {
    flex: 1,
    gap: UI.space.sm,
  },
  avatarName: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  section: {
    marginTop: UI.space.lg,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginTop: UI.space.lg,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.textSecondary,
    marginBottom: UI.space.sm,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  value: {
    fontSize: 15,
    color: COLORS.textPrimary,
    fontWeight: "500",
    flexShrink: 1,
  },
  valueSmall: {
    fontSize: UI.typography.caption,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  nameRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: UI.space.md,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: UI.radius.medium - 2,
    paddingHorizontal: UI.space.md,
    paddingVertical: 11,
    minHeight: 46,
    fontSize: UI.typography.body,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.card,
  },
  editActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: UI.space.sm,
    marginTop: UI.space.md,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: UI.radius.small,
    paddingHorizontal: UI.space.lg,
    paddingVertical: UI.space.md,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButton: {
    backgroundColor: COLORS.surface,
    borderRadius: UI.radius.small,
    paddingHorizontal: 13,
    paddingVertical: 10,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: COLORS.primary,
    fontSize: UI.typography.caption + 1,
    fontWeight: "700",
  },
  secondaryButtonTextNeutral: {
    color: COLORS.textSecondary,
    fontSize: UI.typography.caption + 1,
    fontWeight: "700",
  },
  primaryButtonText: {
    color: COLORS.textOnPrimary,
    fontSize: UI.typography.caption + 1,
    fontWeight: "700",
  },
  growButton: {
    flexGrow: 1,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  refreshHint: {
    color: COLORS.textSecondary,
    fontSize: 11,
    lineHeight: 17,
    marginTop: UI.space.xl,
  },
  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: UI.radius.large,
    padding: 22,
    alignItems: "flex-start",
    marginBottom: UI.space.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyTitle: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: "700",
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: UI.typography.caption + 1,
    lineHeight: 19,
    marginTop: UI.space.sm,
    marginBottom: UI.space.lg,
  },
  signOutContainer: {
    marginTop: UI.space.xs,
  },
});
