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

type EventRecord = {
  id: string;
  event_code: string;
  title: string;
  start_time: string;
  end_time: string;
  created_by: string | null;
  created_at: string;
};

type EventForm = {
  title: string;
  event_code: string;
  start_time: string;
  end_time: string;
};

const EMPTY_FORM: EventForm = {
  title: "",
  event_code: "",
  start_time: "",
  end_time: "",
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
  success: "#237A57",
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

// Converts a local date/time into the ISO timestamp Supabase expects.
function toTimestamp(value: string): string | null {
  const normalized = value.trim().replace(" ", "T");
  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

// Displays a timestamp in local time for editing.
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

export default function AdminEventsScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [events, setEvents] = useState<EventRecord[]>([]);
  const [search, setSearch] = useState("");
  const [pageLoading, setPageLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventRecord | null>(null);
  const [form, setForm] = useState<EventForm>(EMPTY_FORM);

  const updateField = (field: keyof EventForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const loadEvents = useCallback(
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
        // Confirm that the current user is an administrator.
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) {
          throw profileError;
        }

        if (profile?.role !== "admin") {
          Alert.alert(
            "Access denied",
            "Only administrators can manage events.",
            [{ text: "OK", onPress: () => router.replace("/(tabs)") }],
          );
          setEvents([]);
          return;
        }

        const { data, error } = await supabase
          .from("events")
          .select(
            "id, event_code, title, start_time, end_time, created_by, created_at",
          )
          .order("start_time", { ascending: true });

        if (error) {
          throw error;
        }

        setEvents((data ?? []) as EventRecord[]);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to load events.";

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
        void loadEvents();
      }
    }, [authLoading, loadEvents]),
  );

  const openCreateModal = () => {
    setEditingEvent(null);
    setForm(EMPTY_FORM);
    setModalVisible(true);
  };

  const openEditModal = (event: EventRecord) => {
    setEditingEvent(event);
    setForm({
      title: event.title,
      event_code: event.event_code,
      start_time: toLocalInput(event.start_time),
      end_time: toLocalInput(event.end_time),
    });
    setModalVisible(true);
  };

  const saveEvent = async () => {
    if (!user?.id) {
      Alert.alert("Session required", "Please sign in again.");
      return;
    }

    const title = form.title.trim();
    const eventCode = form.event_code.trim();

    if (
      !title ||
      !eventCode ||
      !form.start_time.trim() ||
      !form.end_time.trim()
    ) {
      Alert.alert("Missing information", "Please complete all event fields.");
      return;
    }

    const startTime = toTimestamp(form.start_time);
    const endTime = toTimestamp(form.end_time);

    if (!startTime || !endTime) {
      Alert.alert(
        "Invalid date or time",
        "Enter valid dates and times using the format YYYY-MM-DD HH:mm.",
      );
      return;
    }

    if (new Date(endTime).getTime() <= new Date(startTime).getTime()) {
      Alert.alert(
        "Invalid schedule",
        "The event end time must be later than its start time.",
      );
      return;
    }

    setSaving(true);

    try {
      // Recheck the administrator role before writing.
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      if (profile?.role !== "admin") {
        Alert.alert("Access denied", "Administrator access is required.");
        return;
      }

      const eventData = {
        title,
        event_code: eventCode,
        start_time: startTime,
        end_time: endTime,
      };

      if (editingEvent) {
        const { error } = await supabase
          .from("events")
          .update(eventData)
          .eq("id", editingEvent.id);

        if (error) {
          throw error;
        }

        Alert.alert("Success", "Event updated successfully.");
      } else {
        const { error } = await supabase.from("events").insert({
          ...eventData,
          created_by: user.id,
        });

        if (error) {
          throw error;
        }

        Alert.alert("Success", "Event created successfully.");
      }

      setModalVisible(false);
      setEditingEvent(null);
      setForm(EMPTY_FORM);
      await loadEvents(true);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to save the event.";

      Alert.alert("Save failed", message);
    } finally {
      setSaving(false);
    }
  };

  const deleteEvent = (event: EventRecord) => {
    Alert.alert(
      "Delete event",
      `Are you sure you want to delete "${event.title}"? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              if (!user?.id) {
                Alert.alert("Session required", "Please sign in again.");
                return;
              }

              const { data: profile, error: profileError } = await supabase
                .from("profiles")
                .select("role")
                .eq("id", user.id)
                .maybeSingle();

              if (profileError) {
                throw profileError;
              }

              if (profile?.role !== "admin") {
                Alert.alert(
                  "Access denied",
                  "Administrator access is required.",
                );
                return;
              }

              const { error } = await supabase
                .from("events")
                .delete()
                .eq("id", event.id);

              if (error) {
                throw error;
              }

              setEvents((current) =>
                current.filter((item) => item.id !== event.id),
              );

              Alert.alert("Success", "Event deleted successfully.");
            } catch (error) {
              const message =
                error instanceof Error
                  ? error.message
                  : "Unable to delete the event.";

              Alert.alert("Delete failed", message);
            }
          },
        },
      ],
    );
  };

  const filteredEvents = events.filter((event) => {
    const query = search.trim().toLowerCase();

    return (
      event.title.toLowerCase().includes(query) ||
      event.event_code.toLowerCase().includes(query)
    );
  });

  const renderEvent = ({ item }: { item: EventRecord }) => (
    <View style={styles.eventCard}>
      <View style={styles.eventHeader}>
        <View style={styles.eventIcon}>
          <Ionicons name="calendar-outline" size={23} color={COLORS.primary} />
        </View>

        <View style={styles.eventHeading}>
          <Text style={styles.eventTitle}>{item.title}</Text>
          <Text style={styles.eventCode}>Code: {item.event_code}</Text>
        </View>
      </View>

      <View style={styles.dateRow}>
        <Ionicons name="play-circle-outline" size={18} color={COLORS.success} />
        <View style={styles.dateTextContainer}>
          <Text style={styles.dateLabel}>STARTS</Text>
          <Text style={styles.dateValue}>{formatDate(item.start_time)}</Text>
        </View>
      </View>

      <View style={styles.dateRow}>
        <Ionicons name="stop-circle-outline" size={18} color={COLORS.danger} />
        <View style={styles.dateTextContainer}>
          <Text style={styles.dateLabel}>ENDS</Text>
          <Text style={styles.dateValue}>{formatDate(item.end_time)}</Text>
        </View>
      </View>

      <View style={styles.cardActions}>
        <Pressable
          style={styles.editButton}
          onPress={() => openEditModal(item)}
        >
          <Ionicons name="create-outline" size={18} color={COLORS.primary} />
          <Text style={styles.editButtonText}>Edit</Text>
        </Pressable>

        <Pressable
          style={styles.deleteButton}
          onPress={() => deleteEvent(item)}
        >
          <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
          <Text style={styles.deleteButtonText}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );

  if (authLoading || pageLoading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading events...</Text>
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
          <Ionicons name="arrow-back" size={23} color={COLORS.text} />
        </Pressable>

        <View style={styles.topBarTitleContainer}>
          <Text style={styles.topBarTitle}>Event Management</Text>
          <Text style={styles.topBarSubtitle}>Manage attendance events</Text>
        </View>

        <View style={styles.adminBadge}>
          <Ionicons name="shield-checkmark" size={19} color={COLORS.primary} />
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.summaryCard}>
          <View style={styles.summaryIcon}>
            <Ionicons name="calendar" size={24} color={COLORS.primary} />
          </View>
          <View style={styles.summaryText}>
            <Text style={styles.summaryLabel}>TOTAL EVENTS</Text>
            <Text style={styles.summaryNumber}>{events.length}</Text>
          </View>
          <Pressable
            style={styles.refreshButton}
            onPress={() => void loadEvents(true)}
            disabled={refreshing}
          >
            <Ionicons name="refresh-outline" size={21} color={COLORS.primary} />
          </Pressable>
        </View>

        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color={COLORS.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search event title or code..."
            placeholderTextColor={COLORS.muted}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={20} color={COLORS.muted} />
            </Pressable>
          )}
        </View>

        <View style={styles.listHeading}>
          <Text style={styles.sectionTitle}>All Events</Text>
          <Text style={styles.eventCount}>
            {filteredEvents.length}{" "}
            {filteredEvents.length === 1 ? "event" : "events"}
          </Text>
        </View>

        <FlatList
          data={filteredEvents}
          keyExtractor={(item) => item.id}
          renderItem={renderEvent}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void loadEvents(true)}
              tintColor={COLORS.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons
                  name="calendar-clear-outline"
                  size={35}
                  color={COLORS.primary}
                />
              </View>
              <Text style={styles.emptyTitle}>No events found</Text>
              <Text style={styles.emptyDescription}>
                {search
                  ? "Try another event title or code."
                  : "Create an event to get started."}
              </Text>
            </View>
          }
        />
      </View>

      <Pressable style={styles.fab} onPress={openCreateModal}>
        <Ionicons name="add" size={25} color={COLORS.white} />
        <Text style={styles.fabText}>Create Event</Text>
      </Pressable>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => {
          if (!saving) {
            setModalVisible(false);
          }
        }}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {editingEvent ? "Edit Event" : "Create Event"}
                </Text>
                <Text style={styles.modalSubtitle}>
                  Enter the event details below.
                </Text>
              </View>

              <Pressable
                style={styles.closeButton}
                disabled={saving}
                onPress={() => setModalVisible(false)}
              >
                <Ionicons name="close" size={23} color={COLORS.text} />
              </Pressable>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.inputLabel}>Event Title</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Annual School Assembly"
                placeholderTextColor={COLORS.muted}
                value={form.title}
                onChangeText={(value) => updateField("title", value)}
                editable={!saving}
                maxLength={150}
              />

              <Text style={styles.inputLabel}>Event Code</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. ASSEMBLY2026"
                placeholderTextColor={COLORS.muted}
                value={form.event_code}
                onChangeText={(value) => updateField("event_code", value)}
                autoCapitalize="characters"
                editable={!saving}
                maxLength={100}
              />

              <Text style={styles.inputLabel}>Start Date and Time</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD HH:mm"
                placeholderTextColor={COLORS.muted}
                value={form.start_time}
                onChangeText={(value) => updateField("start_time", value)}
                editable={!saving}
                autoCapitalize="none"
              />

              <Text style={styles.inputLabel}>End Date and Time</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD HH:mm"
                placeholderTextColor={COLORS.muted}
                value={form.end_time}
                onChangeText={(value) => updateField("end_time", value)}
                editable={!saving}
                autoCapitalize="none"
              />

              <Text style={styles.helperText}>
                Use your local time in the format YYYY-MM-DD HH:mm. Example:
                2026-10-20 09:00.
              </Text>

              <Pressable
                style={[styles.saveButton, saving && styles.disabledButton]}
                onPress={() => void saveEvent()}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <>
                    <Ionicons
                      name={
                        editingEvent
                          ? "checkmark-circle-outline"
                          : "add-circle-outline"
                      }
                      size={20}
                      color={COLORS.white}
                    />
                    <Text style={styles.saveButtonText}>
                      {editingEvent ? "Save Changes" : "Create Event"}
                    </Text>
                  </>
                )}
              </Pressable>

              <Pressable
                style={styles.cancelButton}
                disabled={saving}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
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
    color: COLORS.muted,
    marginTop: 12,
    fontSize: 14,
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
  topBarTitleContainer: {
    flex: 1,
  },
  topBarTitle: {
    color: COLORS.text,
    fontSize: 19,
    fontWeight: "800",
  },
  topBarSubtitle: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 3,
  },
  adminBadge: {
    height: 40,
    width: 40,
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
    borderRadius: 18,
    padding: 17,
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
    justifyContent: "center",
    alignItems: "center",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 13,
    height: 49,
    marginBottom: 22,
  },
  searchInput: {
    flex: 1,
    color: COLORS.text,
    marginLeft: 9,
    fontSize: 13,
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
  eventCount: {
    color: COLORS.muted,
    fontSize: 12,
  },
  listContent: {
    paddingBottom: 110,
    flexGrow: 1,
  },
  eventCard: {
    backgroundColor: COLORS.white,
    borderRadius: 17,
    padding: 16,
    marginBottom: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  eventHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },
  eventIcon: {
    width: 45,
    height: 45,
    borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  eventHeading: {
    flex: 1,
  },
  eventTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "800",
  },
  eventCode: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 5,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 13,
  },
  dateTextContainer: {
    flex: 1,
    marginLeft: 10,
  },
  dateLabel: {
    color: COLORS.muted,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  dateValue: {
    color: COLORS.text,
    fontSize: 12,
    lineHeight: 18,
  },
  cardActions: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 13,
    marginTop: 2,
    gap: 10,
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
    fontSize: 13,
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
    fontSize: 13,
    fontWeight: "700",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 25,
    paddingVertical: 55,
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
    fontSize: 13,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
  fab: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 28 : 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    paddingHorizontal: 19,
    paddingVertical: 15,
    borderRadius: 16,
    gap: 8,
    elevation: 5,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  fabText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "800",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(16, 35, 35, 0.48)",
    justifyContent: "flex-end",
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
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 22,
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 21,
    fontWeight: "800",
  },
  modalSubtitle: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 5,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
  },
  inputLabel: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
    marginTop: 5,
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
    marginBottom: 15,
  },
  helperText: {
    color: COLORS.muted,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 0,
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
});
