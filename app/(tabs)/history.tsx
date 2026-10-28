import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import Badge from "@/components/Badge";
import EmptyState from "@/components/EmptyState";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { COLORS } from "@/constants/colors";
import { UI } from "@/constants/ui";

import { getAttendanceHistory, type AttendanceRecord } from "@/lib/database";

import { getProfile, type Role } from "@/lib/profiles";

import {
  getTeacherEventAttendance,
  type TeacherEventAttendance,
} from "@/lib/attendance";

export default function HistoryScreen() {
  const { user } = useAuth();

  const [role, setRole] = useState<Role | null>(null);
  const [studentRecords, setStudentRecords] = useState<AttendanceRecord[]>([]);
  const [teacherEvents, setTeacherEvents] = useState<TeacherEventAttendance[]>(
    [],
  );
  const [studentNames, setStudentNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    if (!user) {
      setRole(null);
      setStudentRecords([]);
      setTeacherEvents([]);
      setLoading(false);
      return;
    }

    try {
      const profile = await getProfile(user.id);
      const currentRole = profile?.role ?? "student";

      setRole(currentRole);

      if (currentRole === "teacher") {
        const events = await getTeacherEventAttendance(user.id);

        const attendeeIds = [
          ...new Set(
            events.flatMap((event) =>
              event.attendees.map((attendee) => attendee.studentId),
            ),
          ),
        ];

        const names: Record<string, string> = {};

        if (attendeeIds.length > 0) {
          const { data, error: namesError } = await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", attendeeIds);

          if (namesError) {
            console.warn("Unable to load attendee names:", namesError.message);
          }

          for (const row of data ?? []) {
            if (row.full_name) {
              names[row.id] = row.full_name;
            }
          }
        }

        setStudentNames(names);
        setTeacherEvents(events);
        setStudentRecords([]);
      } else {
        const records = await getAttendanceHistory(user.id);

        const sortedRecords = [...records].sort(
          (a, b) =>
            new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime(),
        );

        setStudentRecords(sortedRecords);
        setTeacherEvents([]);
      }
    } catch (err) {
      console.error("Failed to load attendance history:", err);
      setError("Unable to load attendance records. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>Attendance History</Text>

        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.centerText}>Loading attendance records...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>Attendance History</Text>

        <EmptyState
          icon="alert-circle-outline"
          title="Something went wrong"
          message={error}
        />
      </SafeAreaView>
    );
  }

  // TEACHER ATTENDANCE HISTORY
  if (role === "teacher") {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>Attendance History</Text>
        <Text style={styles.description}>
          View attendance records from your school events.
        </Text>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Events</Text>
          <Text style={styles.summaryValue}>{teacherEvents.length}</Text>
        </View>

        <FlatList
          data={teacherEvents}
          keyExtractor={(item) => item.eventId}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState
              icon="calendar-clear-outline"
              title="No events yet"
              message="Events you create will appear here with their attendance."
            />
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.eventTitle}>{item.title}</Text>

              <Text style={styles.eventMeta}>
                Event Code: {item.eventCode}
              </Text>

              <Text style={styles.eventMeta}>
                Start: {item.startTime ? formatDate(item.startTime) : "N/A"}
              </Text>

              <Text style={styles.eventMeta}>
                End: {item.endTime ? formatDate(item.endTime) : "N/A"}
              </Text>

              <View style={styles.attendeeHeader}>
                <Text style={styles.attendeeTitle}>
                  Attendees ({item.attendeeCount})
                </Text>
              </View>

              {item.attendees.length === 0 ? (
                <Text style={styles.eventMeta}>
                  No students have attended yet.
                </Text>
              ) : (
                item.attendees.map((attendee) => (
                  <View
                    key={`${item.eventId}-${attendee.studentId}`}
                    style={styles.attendeeRow}
                  >
                    <Text style={styles.attendeeName}>
                      {studentNames[attendee.studentId] ??
                        shortId(attendee.studentId)}
                    </Text>

                    <Text style={styles.eventMeta}>
                      {formatDate(attendee.scannedAt)}
                    </Text>
                  </View>
                ))
              )}
            </View>
          )}
        />
      </SafeAreaView>
    );
  }

  const confirmedCount = studentRecords.filter(
    (record) => record.synced === 1,
  ).length;

  const pendingCount = studentRecords.length - confirmedCount;

  // STUDENT ATTENDANCE HISTORY
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Attendance History</Text>

      <Text style={styles.description}>
        Track your recorded school event attendance.
      </Text>

      <View style={styles.summaryCard}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{studentRecords.length}</Text>
          <Text style={styles.summaryLabel}>Total</Text>
        </View>

        <View style={styles.summaryDivider} />

        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, styles.summaryConfirmed]}>
            {confirmedCount}
          </Text>
          <Text style={styles.summaryLabel}>Confirmed</Text>
        </View>

        <View style={styles.summaryDivider} />

        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, styles.summaryPending]}>
            {pendingCount}
          </Text>
          <Text style={styles.summaryLabel}>Pending</Text>
        </View>
      </View>

      <FlatList
        data={studentRecords}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState
            icon="qr-code-outline"
            title="No records yet"
            message="Scan a QR code to register your attendance."
          />
        }
        renderItem={({ item }) => {
          const isSynced = item.synced === 1;

          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.eventTitle}>{item.eventTitle}</Text>

                <Badge
                  label={isSynced ? "Confirmed" : "Pending Sync"}
                  tone={isSynced ? "confirmed" : "pending"}
                />
              </View>

              <Text style={styles.eventMeta}>Event ID: {item.eventId}</Text>

              <Text style={styles.eventMeta}>
                Scanned: {formatDate(item.scannedAt)}
              </Text>

              {!isSynced && (
                <Text style={styles.pendingNotice}>
                  This attendance is saved locally and is waiting to sync with
                  the server.
                </Text>
              )}
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

function formatDate(iso: string) {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return date.toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function shortId(id: string) {
  return id ? `…${id.slice(-8)}` : "unknown";
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: UI.space.lg,
    paddingTop: UI.space.xl,
  },

  title: {
    fontSize: 24,
    fontWeight: "800",
    color: COLORS.textPrimary,
    marginBottom: 6,
  },

  description: {
    fontSize: UI.typography.body,
    color: COLORS.textSecondary,
    marginBottom: UI.space.lg,
    lineHeight: 20,
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  centerText: {
    fontSize: UI.typography.body,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginTop: UI.space.md,
    lineHeight: 21,
  },

  summaryCard: {
    backgroundColor: COLORS.card,
    borderRadius: UI.radius.large,
    padding: UI.space.lg,
    marginBottom: UI.space.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },

  summaryItem: {
    flex: 1,
    alignItems: "center",
  },

  summaryDivider: {
    width: 1,
    height: 36,
    backgroundColor: COLORS.border,
  },

  summaryValue: {
    fontSize: 24,
    fontWeight: "800",
    color: COLORS.primary,
  },

  summaryConfirmed: {
    color: COLORS.successText,
  },

  summaryPending: {
    color: COLORS.warning,
  },

  summaryLabel: {
    fontSize: UI.typography.caption,
    color: COLORS.textSecondary,
    marginTop: 4,
  },

  list: {
    paddingBottom: 32,
    flexGrow: 1,
  },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: UI.radius.large,
    padding: UI.space.lg,
    marginBottom: UI.space.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },

  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: UI.space.sm,
    marginBottom: UI.space.sm,
  },

  eventTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },

  eventMeta: {
    fontSize: UI.typography.caption + 1,
    color: COLORS.textSecondary,
    marginTop: 5,
  },

  pendingNotice: {
    fontSize: UI.typography.caption,
    color: COLORS.warning,
    marginTop: UI.space.md,
    lineHeight: 18,
  },

  attendeeHeader: {
    marginTop: UI.space.lg,
    marginBottom: UI.space.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: UI.space.md,
  },

  attendeeTitle: {
    fontSize: UI.typography.body,
    fontWeight: "700",
    color: COLORS.primary,
  },

  attendeeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: UI.space.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 10,
  },

  attendeeName: {
    flex: 1,
    fontSize: UI.typography.body,
    color: COLORS.textPrimary,
    fontWeight: "600",
  },
});
