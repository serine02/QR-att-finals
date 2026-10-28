import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import Badge from "@/components/Badge";
import EmptyState from "@/components/EmptyState";
import { COLORS } from "@/constants/colors";
import { UI } from "@/constants/ui";
import { useAuth, signOut } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

type UserRole = "student" | "teacher" | "admin";

type UserProfile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: UserRole;
};

// The database stores "admin"; only the display label says "Administrator".
// Older versions wrote "administrator", which the login screen rejected.
const ROLES: UserRole[] = ["student", "teacher", "admin"];

function roleLabel(role: UserRole) {
  return role === "admin"
    ? "Administrator"
    : role.charAt(0).toUpperCase() + role.slice(1);
}

function roleTone(role: UserRole): "info" | "unscheduled" | "confirmed" {
  if (role === "admin") return "info";
  if (role === "teacher") return "unscheduled";
  return "confirmed";
}

export default function AdminUsersScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState("");
  const [pageLoading, setPageLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);

  const loadUsers = useCallback(async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, full_name, role")
      .order("full_name", { ascending: true });

    if (error) {
      console.error("Load users error:", error.message);
      throw error;
    }

    setUsers((data ?? []) as UserProfile[]);
  }, []);

  const initialize = useCallback(async () => {
    if (!user?.id) {
      router.replace("/login");
      setPageLoading(false);
      return;
    }

    setPageLoading(true);

    try {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (profile?.role !== "admin") {
        router.replace("/(tabs)");
        return;
      }

      await loadUsers();
    } catch (error) {
      console.error("Admin users initialization error:", error);
      Alert.alert(
        "Error",
        "Unable to load users. Check your connection and database permissions.",
      );
    } finally {
      setPageLoading(false);
    }
  }, [user?.id, router, loadUsers]);

  useFocusEffect(
    useCallback(() => {
      if (!authLoading) {
        void initialize();
      }
    }, [authLoading, initialize]),
  );

  const onRefresh = async () => {
    setRefreshing(true);

    try {
      await loadUsers();
    } catch {
      Alert.alert("Error", "Could not refresh the user list.");
    } finally {
      setRefreshing(false);
    }
  };

  const handleCreateTeacher = async () => {
    const name = fullName.trim();
    const teacherEmail = email.trim().toLowerCase();

    if (!name || !teacherEmail || !password) {
      Alert.alert("Missing Information", "Please complete all fields.");
      return;
    }

    if (password.length < 8) {
      Alert.alert(
        "Invalid Password",
        "The password must contain at least 8 characters.",
      );
      return;
    }

    setCreating(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        "admin-create-teacher",
        {
          body: {
            full_name: name,
            email: teacherEmail,
            password,
          },
        },
      );

      if (error) {
        // Supabase FunctionsHttpError exposes the failed HTTP response.
        // Show its status and server message without exposing credentials.
        let details = error.message;
        const response = (error as typeof error & { context?: Response })
          .context;

        if (response && typeof response.status === "number") {
          details += `\nHTTP Status: ${response.status}`;
          try {
            const body: unknown = await response.clone().json();
            if (body && typeof body === "object") {
              const payload = body as Record<string, unknown>;
              const serverMessage = payload.error ?? payload.message;
              if (typeof serverMessage === "string") {
                details += `\nServer Error: ${serverMessage}`;
              }
            }
          } catch {
            // Not all function errors have JSON responses.
          }
        }

        console.error("Create teacher function error:", details);
        throw new Error(details);
      }

      if (data?.error) {
        throw new Error(String(data.error));
      }

      if (!data?.user?.id) {
        throw new Error(
          "The server did not confirm that the account was created.",
        );
      }

      setFullName("");
      setEmail("");
      setPassword("");
      setShowForm(false);

      await loadUsers();

      Alert.alert(
        "Teacher Created",
        `The account was created successfully.\n\nName: ${name}\nEmail: ${teacherEmail}\nRole: Teacher`,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "An unexpected error occurred.";

      Alert.alert("Could Not Create Teacher", message);
    } finally {
      setCreating(false);
    }
  };

  const updateUserRole = async (userId: string, role: UserRole) => {
    if (userId === user?.id && role !== "admin") {
      Alert.alert(
        "Not Allowed",
        "You cannot remove your own administrator role here.",
      );
      return;
    }

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          role,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (error) throw error;

      await loadUsers();
      Alert.alert("Success", `User role changed to ${roleLabel(role)}.`);
    } catch (error) {
      console.error("Update user role error:", error);
      Alert.alert(
        "Update Failed",
        "Unable to change the role. Check your profiles table RLS policies.",
      );
    }
  };

  const handleChangeRole = (item: UserProfile) => {
    Alert.alert(
      "Change User Role",
      `Choose a role for ${item.full_name || item.email || "this user"}.`,
      [
        { text: "Cancel", style: "cancel" },
        ...ROLES.filter((role) => role !== item.role).map((role) => ({
          text: roleLabel(role),
          onPress: () => {
            void updateUserRole(item.id, role);
          },
        })),
      ],
    );
  };

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          const result = await signOut();

          if (result.error) {
            Alert.alert("Error", "Unable to sign out.");
            return;
          }

          router.replace("/login");
        },
      },
    ]);
  };

  const filteredUsers = users.filter((item) => {
    const query = search.trim().toLowerCase();

    return (
      !query ||
      (item.full_name ?? "").toLowerCase().includes(query) ||
      (item.email ?? "").toLowerCase().includes(query) ||
      item.role.toLowerCase().includes(query) ||
      roleLabel(item.role).toLowerCase().includes(query)
    );
  });

  if (authLoading || pageLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading users...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <FlatList
        data={filteredUsers}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={COLORS.primary}
          />
        }
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <View style={styles.headerText}>
                <Text style={styles.eyebrow}>ADMINISTRATION</Text>
                <Text style={styles.title}>Manage Users</Text>
                <Text style={styles.subtitle}>
                  Manage student and teacher accounts.
                </Text>
              </View>

              <Pressable
                onPress={handleSignOut}
                style={({ pressed }) => [
                  styles.iconButton,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Sign out"
              >
                <Ionicons
                  name="log-out-outline"
                  size={22}
                  color={COLORS.dangerText}
                />
              </Pressable>
            </View>

            <View style={styles.summaryCard}>
              <View style={styles.summaryIcon}>
                <Ionicons
                  name="people-outline"
                  size={26}
                  color={COLORS.primary}
                />
              </View>
              <View>
                <Text style={styles.summaryNumber}>{users.length}</Text>
                <Text style={styles.summaryLabel}>Registered users</Text>
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.addButton,
                pressed && styles.pressed,
              ]}
              onPress={() => setShowForm((current) => !current)}
              accessibilityRole="button"
            >
              <Ionicons
                name={showForm ? "close-circle-outline" : "person-add-outline"}
                size={21}
                color="#FFFFFF"
              />
              <Text style={styles.addButtonText}>
                {showForm ? "Cancel" : "Add Teacher"}
              </Text>
            </Pressable>

            {showForm && (
              <View style={styles.formCard}>
                <Text style={styles.formTitle}>Create Teacher Account</Text>
                <Text style={styles.formSubtitle}>
                  The new account will automatically receive the Teacher role.
                </Text>

                <Text style={styles.label}>Full Name</Text>
                <TextInput
                  style={styles.input}
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Enter full name"
                  placeholderTextColor={COLORS.textSecondary}
                  autoCapitalize="words"
                  editable={!creating}
                />

                <Text style={styles.label}>Email Address</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="teacher@example.com"
                  placeholderTextColor={COLORS.textSecondary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!creating}
                />

                <Text style={styles.label}>Temporary Password</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="At least 8 characters"
                  placeholderTextColor={COLORS.textSecondary}
                  secureTextEntry
                  autoCapitalize="none"
                  editable={!creating}
                />

                <Pressable
                  style={({ pressed }) => [
                    styles.submitButton,
                    creating && styles.disabledButton,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => void handleCreateTeacher()}
                  disabled={creating}
                  accessibilityRole="button"
                >
                  {creating ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons
                        name="checkmark-circle-outline"
                        size={20}
                        color="#FFFFFF"
                      />
                      <Text style={styles.submitText}>
                        Create Teacher Account
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            )}

            <Text style={styles.sectionTitle}>All Users</Text>

            <View style={styles.searchBox}>
              <Ionicons
                name="search-outline"
                size={20}
                color={COLORS.textSecondary}
              />
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="Search name, email, or role"
                placeholderTextColor={COLORS.textSecondary}
                autoCapitalize="none"
              />
              {search.length > 0 && (
                <Pressable onPress={() => setSearch("")}>
                  <Ionicons
                    name="close-circle"
                    size={19}
                    color={COLORS.textSecondary}
                  />
                </Pressable>
              )}
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.userCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(item.full_name || item.email || "?").charAt(0).toUpperCase()}
              </Text>
            </View>

            <View style={styles.userInfo}>
              <Text style={styles.userName} numberOfLines={1}>
                {item.full_name || "Unnamed User"}
              </Text>
              <Text style={styles.userEmail} numberOfLines={1}>
                {item.email || "No email"}
              </Text>

              <View style={styles.roleBadgeWrap}>
                <Badge
                  label={roleLabel(item.role)}
                  tone={roleTone(item.role)}
                />
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.roleButton,
                pressed && styles.pressed,
              ]}
              onPress={() => handleChangeRole(item)}
              accessibilityRole="button"
              accessibilityLabel={`Change role for ${item.full_name || item.email || "user"}`}
            >
              <Ionicons
                name="ellipsis-horizontal"
                size={22}
                color={COLORS.primary}
              />
            </Pressable>
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="people-outline"
            title="No users found"
            message="Try another search or refresh the list."
          />
        }
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  listContent: {
    padding: 20,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: 12,
    color: COLORS.textPrimary,
  },
  pressed: {
    opacity: 0.7,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  headerText: {
    flex: 1,
    paddingRight: 12,
  },
  eyebrow: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.3,
    marginBottom: 5,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 26,
    fontWeight: "800",
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 5,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: UI.radius.medium,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 18,
    backgroundColor: COLORS.card,
    borderRadius: UI.radius.large,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  summaryIcon: {
    width: 52,
    height: 52,
    borderRadius: UI.radius.medium,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryNumber: {
    color: COLORS.textPrimary,
    fontSize: 25,
    fontWeight: "800",
  },
  summaryLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  addButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 9,
    backgroundColor: COLORS.primary,
    minHeight: 52,
    paddingVertical: 15,
    borderRadius: UI.radius.large,
    marginBottom: 16,
  },
  addButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  formCard: {
    backgroundColor: COLORS.card,
    borderRadius: UI.radius.large,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 24,
  },
  formTitle: {
    color: COLORS.textPrimary,
    fontSize: 19,
    fontWeight: "700",
  },
  formSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
    marginBottom: 12,
  },
  label: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 7,
    marginTop: 12,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: UI.radius.medium - 2,
    backgroundColor: COLORS.card,
    color: COLORS.textPrimary,
    paddingHorizontal: 13,
    fontSize: 14,
  },
  submitButton: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    borderRadius: UI.radius.medium,
    backgroundColor: COLORS.primary,
    marginTop: 22,
  },
  disabledButton: {
    opacity: 0.65,
  },
  submitText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  sectionTitle: {
    color: COLORS.textPrimary,
    fontSize: 19,
    fontWeight: "700",
    marginBottom: 12,
  },
  searchBox: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 13,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: UI.radius.medium,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    minHeight: 44,
    color: COLORS.textPrimary,
    fontSize: 13,
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderRadius: UI.radius.large,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 13,
    marginBottom: 10,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  avatar: {
    width: 45,
    height: 45,
    borderRadius: UI.radius.medium,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: COLORS.primary,
    fontSize: 19,
    fontWeight: "800",
  },
  userInfo: {
    flex: 1,
    minWidth: 0,
    marginLeft: 12,
  },
  userName: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  userEmail: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 4,
  },
  roleBadgeWrap: {
    alignSelf: "flex-start",
    marginTop: 7,
  },
  roleButton: {
    width: 36,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 5,
  },
});
