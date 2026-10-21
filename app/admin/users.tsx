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

import { useAuth, signOut } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

type UserRole = "student" | "teacher" | "admin";

type UserProfile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: UserRole;
};

const C = {
  primary: "#617A46",
  background: "#F5F6EB",
  card: "#FFFFFF",
  surface: "#D9E3C4",
  border: "#E1E7D4",
  text: "#52683B",
  secondary: "#77816D",
  danger: "#B54747",
  teacherBadge: "#DCECE1",
  adminBadge: "#E6EAD8",
};

// The database stores "admin"; only the display label says "Administrator".
// Older versions wrote "administrator", which the login screen rejected.
const ROLES: UserRole[] = ["student", "teacher", "admin"];

function roleLabel(role: UserRole) {
  return role === "admin" ? "Administrator" : role.charAt(0).toUpperCase() + role.slice(1);
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
        console.error("Create teacher function error:", error.message);
        throw new Error(
          "Could not create the teacher account. Confirm that the Edge Function is deployed, then check its logs.",
        );
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
        <ActivityIndicator size="large" color={C.primary} />
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
            tintColor={C.primary}
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
                style={styles.iconButton}
                accessibilityRole="button"
                accessibilityLabel="Sign out"
              >
                <Ionicons name="log-out-outline" size={22} color={C.primary} />
              </Pressable>
            </View>

            <View style={styles.summaryCard}>
              <View style={styles.summaryIcon}>
                <Ionicons name="people-outline" size={26} color={C.primary} />
              </View>
              <View>
                <Text style={styles.summaryNumber}>{users.length}</Text>
                <Text style={styles.summaryLabel}>Registered users</Text>
              </View>
            </View>

            <Pressable
              style={styles.addButton}
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
                  placeholderTextColor="#909989"
                  autoCapitalize="words"
                  editable={!creating}
                />

                <Text style={styles.label}>Email Address</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="teacher@example.com"
                  placeholderTextColor="#909989"
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
                  placeholderTextColor="#909989"
                  secureTextEntry
                  autoCapitalize="none"
                  editable={!creating}
                />

                <Pressable
                  style={[
                    styles.submitButton,
                    creating && styles.disabledButton,
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
              <Ionicons name="search-outline" size={20} color={C.secondary} />
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="Search name, email, or role"
                placeholderTextColor="#909989"
                autoCapitalize="none"
              />
              {search.length > 0 && (
                <Pressable onPress={() => setSearch("")}>
                  <Ionicons name="close-circle" size={19} color={C.secondary} />
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

              <View
                style={[
                  styles.roleBadge,
                  item.role === "admin" && styles.adminBadge,
                  item.role === "teacher" && styles.teacherBadge,
                ]}
              >
                <Text style={styles.roleText}>{roleLabel(item.role)}</Text>
              </View>
            </View>

            <Pressable
              style={styles.roleButton}
              onPress={() => handleChangeRole(item)}
              accessibilityRole="button"
              accessibilityLabel={`Change role for ${item.full_name || item.email || "user"}`}
            >
              <Ionicons
                name="ellipsis-horizontal"
                size={22}
                color={C.primary}
              />
            </Pressable>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={36} color={C.secondary} />
            <Text style={styles.emptyTitle}>No users found</Text>
            <Text style={styles.emptySubtitle}>
              Try another search or refresh the list.
            </Text>
          </View>
        }
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.background,
  },
  listContent: {
    padding: 20,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.background,
  },
  loadingText: {
    marginTop: 12,
    color: C.text,
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
    color: C.primary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginBottom: 5,
  },
  title: {
    color: C.text,
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    color: C.secondary,
    fontSize: 13,
    marginTop: 5,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 18,
    backgroundColor: C.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 14,
  },
  summaryIcon: {
    width: 52,
    height: 52,
    borderRadius: 17,
    backgroundColor: C.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryNumber: {
    color: C.text,
    fontSize: 25,
    fontWeight: "800",
  },
  summaryLabel: {
    color: C.secondary,
    fontSize: 12,
    marginTop: 2,
  },
  addButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 9,
    backgroundColor: C.primary,
    paddingVertical: 15,
    borderRadius: 16,
    marginBottom: 16,
  },
  addButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  formCard: {
    backgroundColor: C.card,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 24,
  },
  formTitle: {
    color: C.text,
    fontSize: 19,
    fontWeight: "800",
  },
  formSubtitle: {
    color: C.secondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
    marginBottom: 12,
  },
  label: {
    color: C.text,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 7,
    marginTop: 12,
  },
  input: {
    minHeight: 49,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 13,
    backgroundColor: "#FCFDF8",
    color: C.text,
    paddingHorizontal: 13,
    fontSize: 14,
  },
  submitButton: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    borderRadius: 14,
    backgroundColor: C.primary,
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
    color: C.text,
    fontSize: 19,
    fontWeight: "800",
    marginBottom: 12,
  },
  searchBox: {
    minHeight: 49,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 13,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 15,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    minHeight: 45,
    color: C.text,
    fontSize: 13,
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    padding: 13,
    marginBottom: 10,
  },
  avatar: {
    width: 45,
    height: 45,
    borderRadius: 16,
    backgroundColor: C.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: C.primary,
    fontSize: 19,
    fontWeight: "800",
  },
  userInfo: {
    flex: 1,
    minWidth: 0,
    marginLeft: 12,
  },
  userName: {
    color: C.text,
    fontSize: 14,
    fontWeight: "700",
  },
  userEmail: {
    color: C.secondary,
    fontSize: 11,
    marginTop: 4,
  },
  roleBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#EDF0E7",
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
    marginTop: 7,
  },
  adminBadge: {
    backgroundColor: C.adminBadge,
  },
  teacherBadge: {
    backgroundColor: C.teacherBadge,
  },
  roleText: {
    color: C.text,
    fontSize: 10,
    fontWeight: "700",
  },
  roleButton: {
    width: 36,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 5,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 35,
  },
  emptyTitle: {
    color: C.text,
    fontSize: 16,
    fontWeight: "700",
    marginTop: 12,
  },
  emptySubtitle: {
    color: C.secondary,
    fontSize: 12,
    textAlign: "center",
    marginTop: 5,
  },
});
