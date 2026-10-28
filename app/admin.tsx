import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { useAuth, signOut } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { COLORS } from "@/constants/colors";
import { UI } from "@/constants/ui";

type DashboardStats = {
  users: number;
  students: number;
  teachers: number;
  events: number;
  attendance: number;
};

type MenuItem = {
  title: string;
  description: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  route:
    | "/admin/users"
    | "/admin/events"
    | "/admin/attendance"
    | "/admin/reports";
};

const MENU_ITEMS: MenuItem[] = [
  {
    title: "Manage Users",
    description: "View users and manage their roles.",
    icon: "people-outline",
    route: "/admin/users",
  },
  {
    title: "Manage Events",
    description: "Create, update, and manage events.",
    icon: "calendar-outline",
    route: "/admin/events",
  },
  {
    title: "Attendance Records",
    description: "Review and correct attendance entries.",
    icon: "clipboard-outline",
    route: "/admin/attendance",
  },
  {
    title: "Reports",
    description: "Review overall attendance statistics.",
    icon: "bar-chart-outline",
    route: "/admin/reports",
  },
];

export default function AdminScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [stats, setStats] = useState<DashboardStats>({
    users: 0,
    students: 0,
    teachers: 0,
    events: 0,
    attendance: 0,
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    if (!user) return;

    try {
      setError(null);

      // Verify the user's role before loading administrator data.
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (profile?.role !== "admin") {
        router.replace("/(tabs)");
        return;
      }

      // Load counts from the existing Supabase tables.
      const [
        usersResult,
        studentsResult,
        teachersResult,
        eventsResult,
        attendanceResult,
      ] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),

        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "student"),

        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "teacher"),

        supabase.from("events").select("id", { count: "exact", head: true }),

        supabase
          .from("attendance")
          .select("id", { count: "exact", head: true }),
      ]);

      const queryError =
        usersResult.error ||
        studentsResult.error ||
        teachersResult.error ||
        eventsResult.error ||
        attendanceResult.error;

      if (queryError) throw queryError;

      setStats({
        users: usersResult.count ?? 0,
        students: studentsResult.count ?? 0,
        teachers: teachersResult.count ?? 0,
        events: eventsResult.count ?? 0,
        attendance: attendanceResult.count ?? 0,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load the administrator dashboard.",
      );
    }
  }, [user, router]);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.replace("/login");
      setLoading(false);
      return;
    }

    let active = true;

    const initialize = async () => {
      await loadDashboard();

      if (active) setLoading(false);
    };

    initialize();

    return () => {
      active = false;
    };
  }, [user, authLoading, loadDashboard, router]);

  // Refresh the statistics when the administrator returns to this screen.
  useFocusEffect(
    useCallback(() => {
      if (!authLoading && user && !loading) {
        loadDashboard();
      }
    }, [authLoading, user, loading, loadDashboard]),
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboard();
    setRefreshing(false);
  };

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          try {
            await signOut();
            router.replace("/login");
          } catch {
            Alert.alert("Sign Out Failed", "Please try again.");
          }
        },
      },
    ]);
  };

  if (authLoading || loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>
          Loading administrator dashboard...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>QR ATTENDANCE SYSTEM</Text>
            <Text style={styles.title}>Admin Dashboard</Text>
            <Text style={styles.subtitle}>
              Manage your attendance system in one place.
            </Text>
          </View>

          <View style={styles.adminIcon}>
            <Ionicons
              name="shield-checkmark-outline"
              size={30}
              color={COLORS.primary}
            />
          </View>
        </View>

        {/* Administrator account */}
        <View style={styles.accountCard}>
          <View style={styles.avatar}>
            <Ionicons name="person-outline" size={24} color={COLORS.primary} />
          </View>

          <View style={styles.accountInfo}>
            <Text style={styles.accountName}>Administrator</Text>
            <Text style={styles.accountEmail} numberOfLines={1}>
              {user?.email ?? "Signed-in account"}
            </Text>
          </View>

          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>ADMIN</Text>
          </View>
        </View>

        {/* Statistics */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>System Overview</Text>
          <Text style={styles.sectionCaption}>Live database counts</Text>
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <Ionicons
              name="alert-circle-outline"
              size={24}
              color={COLORS.danger}
            />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={handleRefresh} style={styles.retryButton}>
              <Text style={styles.retryText}>Try Again</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.statsGrid}>
              <StatCard
                title="Total Users"
                value={stats.users}
                icon="people-outline"
                onPress={() => router.push("/admin/users")}
              />
              <StatCard
                title="Total Events"
                value={stats.events}
                icon="calendar-outline"
                onPress={() => router.push("/admin/events")}
              />
              <StatCard
                title="Attendance Records"
                value={stats.attendance}
                icon="clipboard-outline"
                onPress={() => router.push("/admin/attendance")}
              />
              <StatCard
                title="Students"
                value={stats.students}
                icon="school-outline"
                onPress={() => router.push("/admin/users")}
              />
              <StatCard
                title="Teachers"
                value={stats.teachers}
                icon="person-outline"
                onPress={() => router.push("/admin/users")}
              />
            </View>
          </>
        )}

        {/* Sign out */}
        <Pressable
          style={({ pressed }) => [
            styles.signOutButton,
            pressed && styles.menuCardPressed,
          ]}
          onPress={handleSignOut}
        >
          <Ionicons name="log-out-outline" size={21} color={COLORS.danger} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>

        <Text style={styles.footer}>
          QR Attendance System {"\u2022"} Administrator Panel
        </Text>
      </ScrollView>
    </View>
  );
}

function StatCard({
  title,
  value,
  icon,
  onPress,
}: {
  title: string;
  value: number;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}: ${value}. Open management.`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.statCard,
        pressed && styles.statCardPressed,
      ]}
    >
      <View style={styles.statIcon}>
        <Ionicons name={icon} size={22} color={COLORS.primary} />
      </View>

      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle} numberOfLines={2}>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 36,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
    gap: 12,
  },
  headerText: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.3,
    color: COLORS.primary,
    marginBottom: 7,
  },
  title: {
    fontSize: 27,
    fontWeight: "800",
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 6,
    lineHeight: 19,
  },
  adminIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  accountCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: COLORS.card,
    borderRadius: UI.radius.large,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 28,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  accountInfo: {
    flex: 1,
  },
  accountName: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  accountEmail: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  roleBadge: {
    backgroundColor: COLORS.background,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  roleText: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  sectionHeader: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: COLORS.textPrimary,
  },
  sectionCaption: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 5,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 28,
  },
  statCard: {
    width: "48%",
    backgroundColor: COLORS.card,
    borderRadius: UI.radius.large,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 17,
    minHeight: 155,
    justifyContent: "space-between",
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  statCardPressed: {
    opacity: 0.75,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  statValue: {
    fontSize: 27,
    fontWeight: "800",
    color: COLORS.textPrimary,
  },
  statTitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  menuList: {
    gap: 12,
    marginBottom: 28,
  },
  menuCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: UI.radius.large,
    padding: 15,
    gap: 12,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  menuCardPressed: {
    opacity: 0.7,
  },
  menuIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
  },
  menuText: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  menuDescription: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginTop: 4,
  },
  errorCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    gap: 10,
    marginBottom: 28,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 13,
    lineHeight: 19,
  },
  retryButton: {
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: COLORS.background,
  },
  retryText: {
    color: COLORS.primary,
    fontWeight: "700",
    fontSize: 13,
  },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  signOutText: {
    color: COLORS.danger,
    fontSize: 14,
    fontWeight: "700",
  },
  footer: {
    textAlign: "center",
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 24,
  },
});
