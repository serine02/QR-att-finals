import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { COLORS } from "@/constants/colors";

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
      <View style={styles.container}>
        <Text style={styles.title}>Attendance History</Text>

        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.subtitle}>Loading attendance records...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Attendance History</Text>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  // TEACHER ATTENDANCE HISTORY
  if (role === "teacher") {
    return (
      <View style={styles.container}>
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
            <Text style={styles.subtitle}>No events created yet.</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.eventTitle}>{item.title}</Text>

              <Text style={styles.eventMeta}>Event Code: {item.eventCode}</Text>

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
      </View>
    );
  }

  // STUDENT ATTENDANCE HISTORY
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Attendance History</Text>

      <Text style={styles.description}>
        Track your recorded school event attendance.
      </Text>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Total Records</Text>
        <Text style={styles.summaryValue}>{studentRecords.length}</Text>
      </View>

      <FlatList
        data={studentRecords}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.subtitle}>
            No records yet. Scan a QR code to register your attendance.
          </Text>
        }
        renderItem={({ item }) => {
          const isSynced = item.synced === 1;

          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.eventTitle}>{item.eventTitle}</Text>

                <View
                  style={[
                    styles.badge,
                    isSynced ? styles.confirmedBadge : styles.pendingBadge,
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      isSynced ? styles.confirmedText : styles.pendingText,
                    ]}
                  >
                    {isSynced ? "Confirmed" : "Pending Sync"}
                  </Text>
                </View>
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
    </View>
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
    paddingHorizontal: 20,
    paddingTop: 24,
  },

  title: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: 6,
  },

  description: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 20,
    lineHeight: 20,
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginTop: 24,
    lineHeight: 21,
  },

  error: {
    color: "#C62828",
    textAlign: "center",
    marginTop: 30,
    fontSize: 14,
  },

  summaryCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  summaryLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 5,
  },

  summaryValue: {
    fontSize: 26,
    fontWeight: "700",
    color: COLORS.primary,
  },

  list: {
    paddingBottom: 32,
    flexGrow: 1,
  },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },

  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 8,
  },

  eventTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },

  eventMeta: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 5,
  },

  badge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },

  confirmedBadge: {
    backgroundColor: "#E8F5E9",
  },

  confirmedText: {
    color: "#2E7D32",
  },

  pendingBadge: {
    backgroundColor: "#FFF3E0",
  },

  pendingText: {
    color: "#B7791F",
  },

  pendingNotice: {
    fontSize: 12,
    color: "#B7791F",
    marginTop: 12,
    lineHeight: 18,
  },

  attendeeHeader: {
    marginTop: 16,
    marginBottom: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 12,
  },

  attendeeTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.primary,
  },

  attendeeRow: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 10,
  },

  attendeeName: {
    fontSize: 14,
    color: COLORS.textPrimary,
    fontWeight: "600",
  },
});
