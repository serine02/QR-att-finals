
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";

import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
};

type EventItem = {
  id: string;
  title: string;
  event_code: string;
  start_time: string;
  end_time: string;
};

type AttendanceRecord = {
  id: string;
  student_id: string;
  event_id: string;
  scanned_at: string;
};

type AttendanceView = AttendanceRecord & {
  student_name: string;
  student_email: string;
  event_title: string;
  event_code: string;
};

type EditForm = {
  student_id: string;
  event_id: string;
  scanned_at: string;
};

const COLORS = {
  primary: "#246B67",
  primaryLight: "#E7F3F1",
  background: "#F5F8F8",
  white: "#FFFFFF",
  text: "#203334",
  muted: "#718181",
  border: "#E1E9E8",
  danger: "#C62828",
  dangerLight: "#FDECEC",
};

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function toLocalInput(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const pad = (number: number) => String(number).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toTimestamp(value: string): string | null {
  const date = new Date(value.trim().replace(" ", "T"));

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

export default function AdminAttendanceScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [records, setRecords] = useState<AttendanceView[]>([]);
  const [students, setStudents] = useState<Profile[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);

  const [search, setSearch] = useState("");
  const [pageLoading, setPageLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editingRecord, setEditingRecord] =
    useState<AttendanceView | null>(null);

  const [form, setForm] = useState<EditForm>({
    student_id: "",
    event_id: "",
    scanned_at: "",
  });

  const [selectorVisible, setSelectorVisible] = useState(false);
  const [selectorType, setSelectorType] = useState<"student" | "event">(
    "student",
  );
  const [selectorSearch, setSelectorSearch] = useState("");

  const loadAttendance = useCallback(
    async (isRefresh = false) => {
      if (!user?.id) {
        if (!authLoading) {
          router.replace("/login");
        }

        setPageLoading(false);
        return;
      }

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setPageLoading(true);
      }

      try {
        const { data: adminProfile, error: adminError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        if (adminError) {
          throw adminError;
        }

        if (adminProfile?.role !== "admin") {
          Alert.alert(
            "Access denied",
            "Only administrators can view attendance records.",
            [
              {
                text: "OK",
                onPress: () => router.replace("/(tabs)"),
              },
            ],
          );

          setRecords([]);
          return;
        }

        const [
          { data: attendanceData, error: attendanceError },
          { data: profileData, error: profileError },
          { data: eventData, error: eventError },
        ] = await Promise.all([
          supabase
            .from("attendance")
            .select("id, student_id, event_id, scanned_at")
            .order("scanned_at", { ascending: false }),

          supabase
            .from("profiles")
            .select("id, full_name, email, role")
            .order("full_name", { ascending: true }),

          supabase
            .from("events")
            .select("id, title, event_code, start_time, end_time")
            .order("start_time", { ascending: false }),
        ]);

        if (attendanceError) throw attendanceError;
        if (profileError) throw profileError;
        if (eventError) throw eventError;

        const profileList = (profileData ?? []) as Profile[];
        const eventList = (eventData ?? []) as EventItem[];
        const attendanceList = (attendanceData ?? []) as AttendanceRecord[];

        const profileMap = new Map(
          profileList.map((profile) => [profile.id, profile]),
        );

        const eventMap = new Map(
          eventList.map((event) => [event.id, event]),
        );

        const mappedRecords: AttendanceView[] = attendanceList.map(
          (record) => {
            const student = profileMap.get(record.student_id);
            const event = eventMap.get(record.event_id);

            return {
              ...record,
              student_name: student?.full_name || "Unknown student",
              student_email: student?.email || "",
              event_title: event?.title || "Unknown event",
              event_code: event?.event_code || "",
            };
          },
        );

        setStudents(
          profileList.filter(
            (profile) => profile.role?.toLowerCase() === "student",
          ),
        );

        setEvents(eventList);
        setRecords(mappedRecords);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unable to load attendance records.";

        Alert.alert("Error", message);
      } finally {
        setPageLoading(false);
        setRefreshing(false);
      }
    },
    [user?.id, authLoading, router],
  );

  useFocusEffect(
    useCallback(() => {
      if (!authLoading) {
        void loadAttendance();
      }
    }, [authLoading, loadAttendance]),
  );

  const openEditModal = (record: AttendanceView) => {
    setEditingRecord(record);

    setForm({
      student_id: record.student_id,
      event_id: record.event_id,
      scanned_at: toLocalInput(record.scanned_at),
    });
  };

  const closeEditModal = () => {
    if (saving) return;

    setEditingRecord(null);
    setSelectorVisible(false);
    setSelectorSearch("");
  };

  const saveCorrection = async () => {
    if (!user?.id || !editingRecord) {
      Alert.alert("Error", "No attendance record is selected.");
      return;
    }

    if (!form.student_id || !form.event_id || !form.scanned_at.trim()) {
      Alert.alert("Missing information", "Complete all correction fields.");
      return;
    }

    const scannedAt = toTimestamp(form.scanned_at);

    if (!scannedAt) {
      Alert.alert(
        "Invalid date or time",
        "Use the format YYYY-MM-DD HH:mm.",
      );
      return;
    }

    setSaving(true);

    try {
      const { data: adminProfile, error: adminError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (adminError) throw adminError;

      if (adminProfile?.role !== "admin") {
        Alert.alert("Access denied", "Administrator access is required.");
        return;
      }

      const { error } = await supabase
        .from("attendance")
        .update({
          student_id: form.student_id,
          event_id: form.event_id,
          scanned_at: scannedAt,
        })
        .eq("id", editingRecord.id);

      if (error) throw error;

      setEditingRecord(null);
      setSelectorVisible(false);
      setSelectorSearch("");

      await loadAttendance(true);

      Alert.alert(
        "Success",
        "Attendance record corrected successfully.",
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to correct the attendance record.";

      Alert.alert("Correction failed", message);
    } finally {
      setSaving(false);
    }
  };

  const deleteRecord = (record: AttendanceView) => {
    Alert.alert(
      "Delete attendance record",
      `Delete the attendance record for ${record.student_name} at "${record.event_title}"?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (!user?.id) {
              Alert.alert("Session required", "Please sign in again.");
              return;
            }

            try {
              const { data: adminProfile, error: adminError } =
                await supabase
                  .from("profiles")
                  .select("role")
                  .eq("id", user.id)
                  .maybeSingle();

              if (adminError) throw adminError;

              if (adminProfile?.role !== "admin") {
                Alert.alert(
                  "Access denied",
                  "Administrator access is required.",
                );
                return;
              }

              const { error } = await supabase
                .from("attendance")
                .delete()
                .eq("id", record.id);

              if (error) throw error;

              setRecords((current) =>
                current.filter((item) => item.id !== record.id),
              );

              Alert.alert("Success", "Attendance record deleted.");
            } catch (error) {
              const message =
                error instanceof Error
                  ? error.message
                  : "Unable to delete the record.";

              Alert.alert("Delete failed", message);
            }
          },
        },
      ],
    );
  };

  const openSelector = (type: "student" | "event") => {
    setSelectorType(type);
    setSelectorSearch("");
    setSelectorVisible(true);
  };

  const selectStudent = (student: Profile) => {
    setForm((current) => ({
      ...current,
      student_id: student.id,
    }));

    setSelectorVisible(false);
    setSelectorSearch("");
  };

  const selectEvent = (event: EventItem) => {
    setForm((current) => ({
      ...current,
      event_id: event.id,
    }));

    setSelectorVisible(false);
    setSelectorSearch("");
  };

  const selectedStudent = students.find(
    (student) => student.id === form.student_id,
  );

  const selectedEvent = events.find(
    (event) => event.id === form.event_id,
  );

  const filteredRecords = records.filter((record) => {
    const query = search.trim().toLowerCase();

    return (
      record.student_name.toLowerCase().includes(query) ||
      record.student_email.toLowerCase().includes(query) ||
      record.event_title.toLowerCase().includes(query) ||
      record.event_code.toLowerCase().includes(query)
    );
  });

  const filteredStudents = students.filter((student) => {
    const query = selectorSearch.trim().toLowerCase();

    return (
      (student.full_name ?? "").toLowerCase().includes(query) ||
      (student.email ?? "").toLowerCase().includes(query)
    );
  });

  const filteredEvents = events.filter((event) => {
    const query = selectorSearch.trim().toLowerCase();

    return (
      event.title.toLowerCase().includes(query) ||
      event.event_code.toLowerCase().includes(query)
    );
  });

  const renderRecord = ({ item }: { item: AttendanceView }) => (
    <View style={styles.recordCard}>
      <View style={styles.recordHeader}>
        <View style={styles.studentIcon}>
          <Ionicons
            name="person-outline"
            size={22}
            color={COLORS.primary}
          />
        </View>

        <View style={styles.recordHeading}>
          <Text style={styles.studentName}>{item.student_name}</Text>
          <Text style={styles.studentEmail}>
            {item.student_email || "No email available"}
          </Text>
        </View>

        <View style={styles.checkBadge}>
          <Ionicons
            name="checkmark-circle"
            size={21}
            color={COLORS.primary}
          />
        </View>
      </View>

      <View style={styles.infoRow}>
        <Ionicons
          name="calendar-outline"
          size={18}
          color={COLORS.primary}
        />

        <View style={styles.infoContent}>
          <Text style={styles.infoLabel}>EVENT</Text>
          <Text style={styles.infoValue}>{item.event_title}</Text>

          {!!item.event_code && (
            <Text style={styles.eventCode}>
              Code: {item.event_code}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.infoRow}>
        <Ionicons
          name="time-outline"
          size={18}
          color={COLORS.primary}
        />

        <View style={styles.infoContent}>
          <Text style={styles.infoLabel}>RECORDED AT</Text>
          <Text style={styles.infoValue}>
            {formatDate(item.scanned_at)}
          </Text>
        </View>
      </View>

      <View style={styles.actionRow}>
        <Pressable
          style={styles.editButton}
          onPress={() => openEditModal(item)}
        >
          <Ionicons
            name="create-outline"
            size={17}
            color={COLORS.primary}
          />
          <Text style={styles.editButtonText}>Correct Record</Text>
        </Pressable>

        <Pressable
          style={styles.deleteButton}
          onPress={() => deleteRecord(item)}
        >
          <Ionicons
            name="trash-outline"
            size={17}
            color={COLORS.danger}
          />
          <Text style={styles.deleteButtonText}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );

  if (authLoading || pageLoading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator
          size="large"
          color={COLORS.primary}
        />
        <Text style={styles.loadingText}>
          Loading attendance records...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.replace("/admin")}
        >
          <Ionicons
            name="arrow-back"
            size={23}
            color={COLORS.text}
          />
        </Pressable>

        <View style={styles.topBarText}>
          <Text style={styles.topBarTitle}>
            Attendance Records
          </Text>
          <Text style={styles.topBarSubtitle}>
            Review and correct attendance
          </Text>
        </View>

        <View style={styles.adminIcon}>
          <Ionicons
            name="shield-checkmark"
            size={20}
            color={COLORS.primary}
          />
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.summaryCard}>
          <View style={styles.summaryIcon}>
            <Ionicons
              name="people-outline"
              size={25}
              color={COLORS.primary}
            />
          </View>

          <View style={styles.summaryText}>
            <Text style={styles.summaryLabel}>TOTAL RECORDS</Text>
            <Text style={styles.summaryNumber}>
              {records.length}
            </Text>
          </View>

          <Pressable
            style={styles.refreshButton}
            onPress={() => void loadAttendance(true)}
            disabled={refreshing}
          >
            <Ionicons
              name="refresh-outline"
              size={21}
              color={COLORS.primary}
            />
          </Pressable>
        </View>

        <View style={styles.searchBox}>
          <Ionicons
            name="search-outline"
            size={20}
            color={COLORS.muted}
          />

          <TextInput
            style={styles.searchInput}
            placeholder="Search student, event, or code..."
            placeholderTextColor={COLORS.muted}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
          />

          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")}>
              <Ionicons
                name="close-circle"
                size={20}
                color={COLORS.muted}
              />
            </Pressable>
          )}
        </View>

        <View style={styles.listHeading}>
          <Text style={styles.sectionTitle}>All Attendance</Text>
          <Text style={styles.recordCount}>
            {filteredRecords.length} records
          </Text>
        </View>

        <FlatList<AttendanceView>
          data={filteredRecords}
          keyExtractor={(item) => item.id}
          renderItem={renderRecord}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void loadAttendance(true)}
              tintColor={COLORS.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons
                  name="document-text-outline"
                  size={35}
                  color={COLORS.primary}
                />
              </View>

              <Text style={styles.emptyTitle}>
                No records found
              </Text>

              <Text style={styles.emptyDescription}>
                {search
                  ? "Try a different search term."
                  : "Attendance records will appear here after students scan their QR codes."}
              </Text>
            </View>
          }
        />
      </View>

      {/* Correct attendance record */}
      <Modal
        visible={editingRecord !== null}
        animationType="slide"
        transparent
        onRequestClose={closeEditModal}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderText}>
                <Text style={styles.modalTitle}>
                  Correct Attendance
                </Text>
                <Text style={styles.modalSubtitle}>
                  Update the student, event, or recorded time.
                </Text>
              </View>

              <Pressable
                style={styles.closeButton}
                onPress={closeEditModal}
                disabled={saving}
              >
                <Ionicons
                  name="close"
                  size={23}
                  color={COLORS.text}
                />
              </Pressable>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.inputLabel}>Student</Text>

              <Pressable
                style={styles.selectButton}
                onPress={() => openSelector("student")}
                disabled={saving}
              >
                <View style={styles.selectTextContainer}>
                  <Text style={styles.selectValue}>
                    {selectedStudent?.full_name || "Select a student"}
                  </Text>

                  <Text style={styles.selectHint}>
                    {selectedStudent?.email ||
                      "Choose the correct student"}
                  </Text>
                </View>

                <Ionicons
                  name="chevron-down"
                  size={20}
                  color={COLORS.muted}
                />
              </Pressable>

              <Text style={styles.inputLabel}>Event</Text>

              <Pressable
                style={styles.selectButton}
                onPress={() => openSelector("event")}
                disabled={saving}
              >
                <View style={styles.selectTextContainer}>
                  <Text style={styles.selectValue}>
                    {selectedEvent?.title || "Select an event"}
                  </Text>

                  <Text style={styles.selectHint}>
                    {selectedEvent?.event_code ||
                      "Choose the correct event"}
                  </Text>
                </View>

                <Ionicons
                  name="chevron-down"
                  size={20}
                  color={COLORS.muted}
                />
              </Pressable>

              <Text style={styles.inputLabel}>
                Attendance Date and Time
              </Text>

              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD HH:mm"
                placeholderTextColor={COLORS.muted}
                value={form.scanned_at}
                onChangeText={(value) =>
                  setForm((current) => ({
                    ...current,
                    scanned_at: value,
                  }))
                }
                autoCapitalize="none"
                editable={!saving}
              />

              <Text style={styles.helperText}>
                Enter the local date and time using YYYY-MM-DD HH:mm.
                Example: 2026-10-14 09:30.
              </Text>

              <Pressable
                style={[
                  styles.saveButton,
                  saving && styles.disabledButton,
                ]}
                onPress={() => void saveCorrection()}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <>
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={20}
                      color={COLORS.white}
                    />
                    <Text style={styles.saveButtonText}>
                      Save Correction
                    </Text>
                  </>
                )}
              </Pressable>

              <Pressable
                style={styles.cancelButton}
                onPress={closeEditModal}
                disabled={saving}
              >
                <Text style={styles.cancelButtonText}>
                  Cancel
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Student/event selector */}
      <Modal
        visible={selectorVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectorVisible(false)}
      >
        <View style={styles.selectorOverlay}>
          <View style={styles.selectorCard}>
            <View style={styles.selectorHeader}>
              <Text style={styles.modalTitle}>
                {selectorType === "student"
                  ? "Select Student"
                  : "Select Event"}
              </Text>

              <Pressable
                onPress={() => setSelectorVisible(false)}
              >
                <Ionicons
                  name="close"
                  size={24}
                  color={COLORS.text}
                />
              </Pressable>
            </View>

            <View style={styles.selectorSearchBox}>
              <Ionicons
                name="search-outline"
                size={19}
                color={COLORS.muted}
              />

              <TextInput
                style={styles.searchInput}
                placeholder={
                  selectorType === "student"
                    ? "Search student..."
                    : "Search event..."
                }
                placeholderTextColor={COLORS.muted}
                value={selectorSearch}
                onChangeText={setSelectorSearch}
                autoCapitalize="none"
              />
            </View>

            {/*
              Use two separately typed FlatLists.
              This avoids casting the same item to Profile and EventItem.
            */}
            {selectorType === "student" ? (
              <FlatList<Profile>
                data={filteredStudents}
                keyExtractor={(item) => item.id}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.selectorList}
                ListEmptyComponent={
                  <Text style={styles.noOptions}>
                    No students found.
                  </Text>
                }
                renderItem={({ item }) => (
                  <Pressable
                    style={styles.optionRow}
                    onPress={() => selectStudent(item)}
                  >
                    <View style={styles.optionIcon}>
                      <Ionicons
                        name="person-outline"
                        size={20}
                        color={COLORS.primary}
                      />
                    </View>

                    <View style={styles.optionText}>
                      <Text style={styles.optionTitle}>
                        {item.full_name || "Unnamed student"}
                      </Text>

                      <Text style={styles.optionSubtitle}>
                        {item.email || "No email"}
                      </Text>
                    </View>

                    {item.id === form.student_id && (
                      <Ionicons
                        name="checkmark-circle"
                        size={21}
                        color={COLORS.primary}
                      />
                    )}
                  </Pressable>
                )}
              />
            ) : (
              <FlatList<EventItem>
                data={filteredEvents}
                keyExtractor={(item) => item.id}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.selectorList}
                ListEmptyComponent={
                  <Text style={styles.noOptions}>
                    No events found.
                  </Text>
                }
                renderItem={({ item }) => (
                  <Pressable
                    style={styles.optionRow}
                    onPress={() => selectEvent(item)}
                  >
                    <View style={styles.optionIcon}>
                      <Ionicons
                        name="calendar-outline"
                        size={20}
                        color={COLORS.primary}
                      />
                    </View>

                    <View style={styles.optionText}>
                      <Text style={styles.optionTitle}>
                        {item.title}
                      </Text>

                      <Text style={styles.optionSubtitle}>
                        Code: {item.event_code}
                      </Text>
                    </View>

                    {item.id === form.event_id && (
                      <Ionicons
                        name="checkmark-circle"
                        size={21}
                        color={COLORS.primary}
                      />
                    )}
                  </Pressable>
                )}
              />
            )}

            <Pressable
              style={styles.cancelSelectorButton}
              onPress={() => setSelectorVisible(false)}
            >
              <Text style={styles.cancelButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    color: COLORS.muted,
    fontSize: 13,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 15,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  topBarText: {
    flex: 1,
  },
  topBarTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "800",
  },
  topBarSubtitle: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 4,
  },
  adminIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: COLORS.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: 17,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  summaryIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 13,
  },
  summaryText: {
    flex: 1,
  },
  summaryLabel: {
    color: COLORS.muted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  summaryNumber: {
    color: COLORS.text,
    fontSize: 25,
    fontWeight: "800",
    marginTop: 3,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBox: {
    height: 49,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 13,
    backgroundColor: COLORS.white,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 22,
  },
  searchInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 13,
    marginLeft: 9,
    paddingVertical: 8,
  },
  listHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "800",
  },
  recordCount: {
    color: COLORS.muted,
    fontSize: 12,
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: 25,
  },
  recordCard: {
    backgroundColor: COLORS.white,
    borderRadius: 17,
    padding: 16,
    marginBottom: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  recordHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 19,
  },
  studentIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  recordHeading: {
    flex: 1,
  },
  studentName: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "800",
  },
  studentEmail: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 5,
  },
  checkBadge: {
    marginLeft: 8,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 15,
  },
  infoContent: {
    flex: 1,
    marginLeft: 10,
  },
  infoLabel: {
    color: COLORS.muted,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  infoValue: {
    color: COLORS.text,
    fontSize: 12,
    lineHeight: 18,
  },
  eventCode: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 3,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 13,
    marginTop: 1,
  },
  editButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    borderRadius: 11,
    backgroundColor: COLORS.primaryLight,
    gap: 7,
  },
  editButtonText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  deleteButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    borderRadius: 11,
    backgroundColor: COLORS.dangerLight,
    gap: 7,
  },
  deleteButtonText: {
    color: COLORS.danger,
    fontSize: 12,
    fontWeight: "700",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 50,
  },
  emptyIcon: {
    width: 75,
    height: 75,
    borderRadius: 24,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "800",
  },
  emptyDescription: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(16, 35, 35, 0.48)",
  },
  modalCard: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    paddingHorizontal: 22,
    paddingTop: 23,
    paddingBottom: Platform.OS === "ios" ? 30 : 22,
    maxHeight: "92%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 22,
  },
  modalHeaderText: {
    flex: 1,
    paddingRight: 12,
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "800",
  },
  modalSubtitle: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 5,
    lineHeight: 18,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
  },
  inputLabel: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
    marginTop: 5,
  },
  selectButton: {
    minHeight: 58,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#FBFCFC",
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 10,
    marginBottom: 15,
    flexDirection: "row",
    alignItems: "center",
  },
  selectTextContainer: {
    flex: 1,
    marginRight: 10,
  },
  selectValue: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "700",
  },
  selectHint: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 4,
  },
  input: {
    height: 49,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#FBFCFC",
    borderRadius: 12,
    paddingHorizontal: 13,
    color: COLORS.text,
    fontSize: 13,
    marginBottom: 14,
  },
  helperText: {
    color: COLORS.muted,
    fontSize: 11,
    lineHeight: 17,
    marginBottom: 18,
  },
  saveButton: {
    height: 50,
    backgroundColor: COLORS.primary,
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  disabledButton: {
    opacity: 0.65,
  },
  saveButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "800",
  },
  cancelButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    marginTop: 5,
  },
  cancelButtonText: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: "700",
  },
  selectorOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(16, 35, 35, 0.48)",
  },
  selectorCard: {
    height: "78%",
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: Platform.OS === "ios" ? 28 : 18,
  },
  selectorHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  selectorSearchBox: {
    height: 47,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
  },
  selectorList: {
    paddingBottom: 15,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },
  optionText: {
    flex: 1,
    marginRight: 8,
  },
  optionTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "700",
  },
  optionSubtitle: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 4,
  },
  noOptions: {
    color: COLORS.muted,
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 30,
  },
  cancelSelectorButton: {
    alignItems: "center",
    paddingVertical: 13,
    marginTop: 5,
  },
});