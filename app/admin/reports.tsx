import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import EmptyState from "@/components/EmptyState";
import { supabase } from "@/lib/supabase";
import { COLORS } from "@/constants/colors";
import { UI } from "@/constants/ui";

type Profile = {
  id: string;
  full_name: string | null;
  role: string | null;
};

type EventItem = {
  id: string;
  title: string;
  event_code: string | null;
  start_time: string | null;
  end_time: string | null;
};

type AttendanceItem = {
  id: string;
  event_id: string;
  student_id: string;
  scanned_at: string;
};

export default function AdminReportsScreen() {
  const router = useRouter();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [attendance, setAttendance] = useState<AttendanceItem[]>([]);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const loadReports = useCallback(async (showLoader = true) => {
    if (showLoader) {
      setLoading(true);
    }

    setErrorMessage("");

    try {
      const [profilesResult, eventsResult, attendanceResult] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("id, full_name, role")
            .order("full_name", { ascending: true }),

          supabase
            .from("events")
            .select("id, title, event_code, start_time, end_time")
            .order("start_time", { ascending: false }),

          supabase
            .from("attendance")
            .select("id, event_id, student_id, scanned_at")
            .order("scanned_at", { ascending: false }),
        ]);

      const firstError =
        profilesResult.error || eventsResult.error || attendanceResult.error;

      if (firstError) {
        throw firstError;
      }

      setProfiles((profilesResult.data ?? []) as Profile[]);
      setEvents((eventsResult.data ?? []) as EventItem[]);
      setAttendance((attendanceResult.data ?? []) as AttendanceItem[]);
    } catch (error: any) {
      console.error("Failed to load administrator reports:", error);

      setErrorMessage(
        error?.message ||
          "Unable to load reports. Please check your Supabase configuration.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadReports();
    }, [loadReports]),
  );

  const filteredAttendance = useMemo(() => {
    const validStart = startDate.trim();
    const validEnd = endDate.trim();

    return attendance.filter((record) => {
      const scannedDate = new Date(record.scanned_at);

      if (Number.isNaN(scannedDate.getTime())) {
        return false;
      }

      // Compare calendar dates using the device's local time.
      const year = scannedDate.getFullYear();
      const month = String(scannedDate.getMonth() + 1).padStart(2, "0");
      const day = String(scannedDate.getDate()).padStart(2, "0");
      const localDate = `${year}-${month}-${day}`;

      if (validStart && localDate < validStart) {
        return false;
      }

      if (validEnd && localDate > validEnd) {
        return false;
      }

      return true;
    });
  }, [attendance, startDate, endDate]);

  const studentCount = profiles.filter(
    (profile) => profile.role?.toLowerCase() === "student",
  ).length;

  const teacherCount = profiles.filter(
    (profile) => profile.role?.toLowerCase() === "teacher",
  ).length;

  const administratorCount = profiles.filter(
    (profile) => profile.role?.toLowerCase() === "admin",
  ).length;

  const getEventAttendance = (eventId: string) =>
    filteredAttendance.filter((record) => record.event_id === eventId);

  const getEventTitle = (eventId: string) =>
    events.find((event) => event.id === eventId)?.title ?? "Unknown event";

  const formatDateTime = (value: string | null) => {
    if (!value) {
      return "Not set";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Invalid date";
    }

    return date.toLocaleString();
  };

  const clearFilters = () => {
    setStartDate("");
    setEndDate("");
  };

  const applyRefresh = () => {
    setRefreshing(true);
    loadReports(false);
  };

  const validateFilters = () => {
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;

    if (
      (startDate && !datePattern.test(startDate)) ||
      (endDate && !datePattern.test(endDate))
    ) {
      Alert.alert(
        "Invalid date",
        "Enter dates in YYYY-MM-DD format, for example 2026-10-14.",
      );
      return;
    }

    if (startDate && Number.isNaN(Date.parse(`${startDate}T00:00:00`))) {
      Alert.alert("Invalid date", "Please enter a valid start date.");
      return;
    }

    if (endDate && Number.isNaN(Date.parse(`${endDate}T00:00:00`))) {
      Alert.alert("Invalid date", "Please enter a valid end date.");
      return;
    }

    if (startDate && endDate && startDate > endDate) {
      Alert.alert(
        "Invalid date range",
        "The start date must not be later than the end date.",
      );
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading reports...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
          ]}
          onPress={() => router.replace("/admin")}
          accessibilityRole="button"
          accessibilityLabel="Back to administrator dashboard"
        >
          <Ionicons name="arrow-back" size={23} color={COLORS.textPrimary} />
        </Pressable>

        <View style={styles.topBarText}>
          <Text style={styles.topBarTitle}>System Reports</Text>
          <Text style={styles.topBarSubtitle}>Review attendance statistics</Text>
        </View>

        <View style={styles.adminIcon}>
          <Ionicons name="bar-chart-outline" size={20} color={COLORS.primary} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={applyRefresh}
            tintColor={COLORS.primary}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>ADMINISTRATION</Text>
          <Text style={styles.title}>System Reports</Text>
          <Text style={styles.subtitle}>
            Review users, events, and recorded attendance.
          </Text>
        </View>

        {errorMessage ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Unable to load all reports</Text>
            <Text style={styles.errorText}>{errorMessage}</Text>

            <Pressable
              style={({ pressed }) => [
                styles.retryButton,
                pressed && styles.pressed,
              ]}
              onPress={() => loadReports()}
            >
              <Text style={styles.retryButtonText}>Try Again</Text>
            </Pressable>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Overview</Text>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total Users</Text>
            <Text style={styles.statValue}>{profiles.length}</Text>
            <Text style={styles.statHint}>All registered profiles</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total Events</Text>
            <Text style={styles.statValue}>{events.length}</Text>
            <Text style={styles.statHint}>Recorded events</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Attendance Records</Text>
            <Text style={styles.statValue}>{filteredAttendance.length}</Text>
            <Text style={styles.statHint}>Based on date filters</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Students</Text>
            <Text style={styles.statValue}>{studentCount}</Text>
            <Text style={styles.statHint}>Registered students</Text>
          </View>
        </View>

        <View style={styles.roleCard}>
          <Text style={styles.roleCardTitle}>Users by Role</Text>

          <View style={styles.roleRow}>
            <Text style={styles.roleLabel}>Students</Text>
            <Text style={styles.roleValue}>{studentCount}</Text>
          </View>

          <View style={styles.roleRow}>
            <Text style={styles.roleLabel}>Teachers</Text>
            <Text style={styles.roleValue}>{teacherCount}</Text>
          </View>

          <View style={styles.roleRow}>
            <Text style={styles.roleLabel}>Administrators</Text>
            <Text style={styles.roleValue}>{administratorCount}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Attendance Filters</Text>

        <View style={styles.filterCard}>
          <Text style={styles.inputLabel}>Start Date</Text>
          <TextInput
            style={styles.input}
            value={startDate}
            onChangeText={setStartDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={COLORS.textSecondary}
            autoCapitalize="none"
            keyboardType="numbers-and-punctuation"
            maxLength={10}
          />

          <Text style={styles.inputLabel}>End Date</Text>
          <TextInput
            style={styles.input}
            value={endDate}
            onChangeText={setEndDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={COLORS.textSecondary}
            autoCapitalize="none"
            keyboardType="numbers-and-punctuation"
            maxLength={10}
          />

          <View style={styles.filterActions}>
            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.pressed,
              ]}
              onPress={validateFilters}
            >
              <Text style={styles.primaryButtonText}>Check Date Range</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.pressed,
              ]}
              onPress={clearFilters}
            >
              <Text style={styles.secondaryButtonText}>Clear</Text>
            </Pressable>
          </View>

          <Text style={styles.filterHint}>
            Dates use YYYY-MM-DD format. Results update as you type.
          </Text>

          <Text style={styles.resultCount}>
            {filteredAttendance.length} matching attendance record(s)
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Attendance by Event</Text>

        {events.length === 0 ? (
          <EmptyState
            icon="calendar-clear-outline"
            title="No events available"
            message="Event summaries will appear here after events are created."
          />
        ) : (
          events.map((event) => {
            const records = getEventAttendance(event.id);

            return (
              <View key={event.id} style={styles.eventCard}>
                <View style={styles.eventHeader}>
                  <View style={styles.eventTitleContainer}>
                    <Text style={styles.eventTitle}>{event.title}</Text>
                    <Text style={styles.eventCode}>
                      Code: {event.event_code || "Not set"}
                    </Text>
                  </View>

                  <View style={styles.attendanceBadge}>
                    <Text style={styles.attendanceBadgeValue}>
                      {records.length}
                    </Text>
                    <Text style={styles.attendanceBadgeLabel}>Records</Text>
                  </View>
                </View>

                <View style={styles.eventDetails}>
                  <Text style={styles.detailLabel}>Start</Text>
                  <Text style={styles.detailValue}>
                    {formatDateTime(event.start_time)}
                  </Text>

                  <Text style={styles.detailLabel}>End</Text>
                  <Text style={styles.detailValue}>
                    {formatDateTime(event.end_time)}
                  </Text>
                </View>

                <View style={styles.eventDivider} />

                <Text style={styles.attendanceListTitle}>
                  Attendance Records
                </Text>

                {records.length === 0 ? (
                  <Text style={styles.noRecordsText}>
                    No records match the selected dates.
                  </Text>
                ) : (
                  records.slice(0, 5).map((record) => {
                    const profile = profiles.find(
                      (item) => item.id === record.student_id,
                    );

                    return (
                      <View key={record.id} style={styles.recordRow}>
                        <View style={styles.recordAvatar}>
                          <Text style={styles.recordAvatarText}>
                            {(profile?.full_name || "S")
                              .trim()
                              .charAt(0)
                              .toUpperCase()}
                          </Text>
                        </View>

                        <View style={styles.recordInfo}>
                          <Text style={styles.recordName}>
                            {profile?.full_name || "Unknown student"}
                          </Text>
                          <Text style={styles.recordDate}>
                            {formatDateTime(record.scanned_at)}
                          </Text>
                        </View>
                      </View>
                    );
                  })
                )}

                {records.length > 5 ? (
                  <Text style={styles.moreRecords}>
                    And {records.length - 5} more record(s)
                  </Text>
                ) : null}
              </View>
            );
          })
        )}

        <Text style={styles.sectionTitle}>Recent Attendance</Text>

        {filteredAttendance.length === 0 ? (
          <EmptyState
            icon="document-text-outline"
            title="No attendance records"
            message="Try changing the date range or check whether attendance has been recorded."
          />
        ) : (
          filteredAttendance.slice(0, 10).map((record) => {
            const profile = profiles.find(
              (item) => item.id === record.student_id,
            );

            return (
              <View key={record.id} style={styles.recentCard}>
                <View style={styles.recentIndicator} />

                <View style={styles.recentInfo}>
                  <Text style={styles.recordName}>
                    {profile?.full_name || "Unknown student"}
                  </Text>
                  <Text style={styles.recentEvent}>
                    {getEventTitle(record.event_id)}
                  </Text>
                  <Text style={styles.recordDate}>
                    {formatDateTime(record.scanned_at)}
                  </Text>
                </View>
              </View>
            );
          })
        )}

        <Pressable
          style={({ pressed }) => [
            styles.bottomButton,
            pressed && styles.pressed,
          ]}
          onPress={() => loadReports()}
        >
          <Text style={styles.bottomButtonText}>Refresh Reports</Text>
        </Pressable>

        <Text style={styles.footer}>
          QR Attendance System · Administrator Reports
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  pressed: {
    opacity: 0.7,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 15,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: UI.radius.medium - 2,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  topBarText: {
    flex: 1,
  },
  topBarTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: "700",
  },
  topBarSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  adminIcon: {
    width: 40,
    height: 40,
    borderRadius: UI.radius.medium - 2,
    backgroundColor: COLORS.surface,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  header: {
    marginBottom: 24,
  },
  eyebrow: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.3,
    marginBottom: 7,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 26,
    fontWeight: "800",
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },
  sectionTitle: {
    color: COLORS.textPrimary,
    fontSize: 19,
    fontWeight: "700",
    marginTop: 12,
    marginBottom: 14,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    width: "48%",
    flexGrow: 1,
    flexBasis: "44%",
    backgroundColor: COLORS.card,
    borderRadius: UI.radius.large,
    padding: 17,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  statLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  statValue: {
    color: COLORS.primary,
    fontSize: 30,
    fontWeight: "800",
    marginTop: 10,
  },
  statHint: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 5,
  },
  roleCard: {
    backgroundColor: COLORS.card,
    borderRadius: UI.radius.large,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
    marginBottom: 20,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  roleCardTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },
  roleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  roleLabel: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  roleValue: {
    color: COLORS.primary,
    fontWeight: "700",
    fontSize: 14,
  },
  filterCard: {
    backgroundColor: COLORS.card,
    padding: 18,
    borderRadius: UI.radius.large,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  inputLabel: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
    marginTop: 8,
  },
  input: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: UI.radius.medium - 2,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 46,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  filterActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    minHeight: 46,
    paddingVertical: 13,
    borderRadius: UI.radius.medium,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  secondaryButton: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 18,
    paddingVertical: 13,
    minHeight: 46,
    borderRadius: UI.radius.medium,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  filterHint: {
    color: COLORS.textSecondary,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 12,
  },
  resultCount: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 10,
  },
  eventCard: {
    backgroundColor: COLORS.card,
    borderRadius: UI.radius.large,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 17,
    marginBottom: 14,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  eventHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  eventTitleContainer: {
    flex: 1,
  },
  eventTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: "700",
  },
  eventCode: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 5,
  },
  attendanceBadge: {
    backgroundColor: COLORS.surface,
    borderRadius: UI.radius.medium - 2,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
    minWidth: 66,
  },
  attendanceBadgeValue: {
    color: COLORS.primary,
    fontSize: 18,
    fontWeight: "800",
  },
  attendanceBadgeLabel: {
    color: COLORS.textSecondary,
    fontSize: 10,
    marginTop: 2,
  },
  eventDetails: {
    marginTop: 16,
    gap: 5,
  },
  detailLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 4,
  },
  detailValue: {
    color: COLORS.textPrimary,
    fontSize: 12,
  },
  eventDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 16,
  },
  attendanceListTitle: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 10,
  },
  noRecordsText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  recordRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 9,
    gap: 10,
  },
  recordAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  recordAvatarText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "700",
  },
  recordInfo: {
    flex: 1,
  },
  recordName: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: "700",
  },
  recordDate: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 4,
  },
  moreRecords: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 8,
  },
  recentCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderRadius: UI.radius.medium,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  recentIndicator: {
    width: 4,
    alignSelf: "stretch",
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  recentInfo: {
    flex: 1,
  },
  recentEvent: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  errorCard: {
    backgroundColor: COLORS.dangerSoft,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: UI.radius.large,
    padding: 16,
    marginBottom: 20,
  },
  errorTitle: {
    color: COLORS.dangerText,
    fontSize: 15,
    fontWeight: "700",
  },
  errorText: {
    color: COLORS.dangerText,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
    opacity: 0.85,
  },
  retryButton: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.dangerText,
    borderRadius: UI.radius.small,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 12,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  bottomButton: {
    backgroundColor: COLORS.primary,
    borderRadius: UI.radius.medium,
    padding: 15,
    alignItems: "center",
    marginTop: 16,
  },
  bottomButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
  footer: {
    color: COLORS.textSecondary,
    fontSize: 11,
    textAlign: "center",
    marginTop: 24,
  },
});
