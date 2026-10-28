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

import EmptyState from "@/components/EmptyState";
import { COLORS } from "@/constants/colors";
import { UI } from "@/constants/ui";
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
        <Ionicons
          name="stop-circle-outline"
          size={18}
          color={COLORS.dangerText}
        />
        <View style={styles.dateTextContainer}>
          <Text style={styles.dateLabel}>ENDS</Text>
          <Text style={styles.dateValue}>{formatDate(item.end_time)}</Text>
        </View>
      </View>

      <View style={styles.cardActions}>
        <Pressable
          style={({ pressed }) => [
            styles.editButton,
            pressed && styles.pressed,
          ]}
          onPress={() => openEditModal(item)}
        >
          <Ionicons name="create-outline" size={18} color={COLORS.primary} />
          <Text style={styles.editButtonText}>Edit</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.deleteButton,
            pressed && styles.pressed,
          ]}
          onPress={() => deleteEvent(item)}
        >
          <Ionicons name="trash-outline" size={18} color={COLORS.dangerText} />
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
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
          ]}
          onPress={() => router.replace("/admin")}
        >
          <Ionicons
            name="arrow-back"
            size={23}
            color={COLORS.textPrimary}
          />
        </Pressable>

        <View style={styles.topBarTitleContainer}>
          <Text style={styles.topBarTitle}>Event Management</Text>
          <Text style={styles.topBarSubtitle}>Manage attendance events</Text>
        </View>

        <View style={styles.adminBadge}>
          <Ionicons
            name="shield-checkmark"
            size={19}
            color={COLORS.primary}
          />
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
            style={({ pressed }) => [
              styles.refreshButton,
              pressed && styles.pressed,
            ]}
            onPress={() => void loadEvents(true)}
            disabled={refreshing}
          >
            <Ionicons name="refresh-outline" size={21} color={COLORS.primary} />
          </Pressable>
        </View>

        <View style={styles.searchContainer}>
          <Ionicons
            name="search-outline"
            size={20}
            color={COLORS.textSecondary}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search event title or code..."
            placeholderTextColor={COLORS.textSecondary}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")}>
              <Ionicons
                name="close-circle"
                size={20}
                color={COLORS.textSecondary}
              />
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
            <EmptyState
              icon="calendar-clear-outline"
              title="No events found"
              message={
                search
                  ? "Try another event title or code."
                  : "Create an event to get started."
              }
            />
          }
        />
      </View>

      <Pressable
        style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
        onPress={openCreateModal}
      >
        <Ionicons name="add" size={25} color="#FFFFFF" />
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
                <Ionicons name="close" size={23} color={COLORS.textPrimary} />
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
                placeholderTextColor={COLORS.textSecondary}
                value={form.title}
                onChangeText={(value) => updateField("title", value)}
                editable={!saving}
                maxLength={150}
              />

              <Text style={styles.inputLabel}>Event Code</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. ASSEMBLY2026"
                placeholderTextColor={COLORS.textSecondary}
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
                placeholderTextColor={COLORS.textSecondary}
                value={form.start_time}
                onChangeText={(value) => updateField("start_time", value)}
                editable={!saving}
                autoCapitalize="none"
              />

              <Text style={styles.inputLabel}>End Date and Time</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD HH:mm"
                placeholderTextColor={COLORS.textSecondary}
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
                style={[
                  styles.saveButton,
                  saving && styles.disabledButton,
                ]}
                onPress={() => void saveEvent()}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons
                      name={
                        editingEvent
                          ? "checkmark-circle-outline"
                          : "add-circle-outline"
                      }
                      size={20}
                      color="#FFFFFF"
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
    color: COLORS.textSecondary,
    marginTop: 12,
    fontSize: 14,
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
  topBarTitleContainer: {
    flex: 1,
  },
  topBarTitle: {
    color: COLORS.textPrimary,
    fontSize: 19,
    fontWeight: "700",
  },
  topBarSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 3,
  },
  adminBadge: {
    height: 40,
    width: 40,
    borderRadius: UI.radius.medium - 2,
    backgroundColor: COLORS.surface,
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
    backgroundColor: COLORS.card,
    borderRadius: UI.radius.large,
    padding: 17,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  summaryIcon: {
    width: 48,
    height: 48,
    borderRadius: UI.radius.medium,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 13,
  },
  summaryText: {
    flex: 1,
  },
  summaryLabel: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
  },
  summaryNumber: {
    color: COLORS.textPrimary,
    fontSize: 25,
    fontWeight: "800",
    marginTop: 3,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: UI.radius.medium - 2,
    backgroundColor: COLORS.surface,
    justifyContent: "center",
    alignItems: "center",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: UI.radius.medium,
    paddingHorizontal: 13,
    height: 48,
    marginBottom: 22,
  },
  searchInput: {
    flex: 1,
    color: COLORS.textPrimary,
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
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: "700",
  },
  eventCount: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  listContent: {
    paddingBottom: 110,
    flexGrow: 1,
  },
  eventCard: {
    backgroundColor: COLORS.card,
    borderRadius: UI.radius.large,
    padding: 16,
    marginBottom: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  eventHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },
  eventIcon: {
    width: 45,
    height: 45,
    borderRadius: UI.radius.medium,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  eventHeading: {
    flex: 1,
  },
  eventTitle: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
  eventCode: {
    color: COLORS.textSecondary,
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
    color: COLORS.textSecondary,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  dateValue: {
    color: COLORS.textPrimary,
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
    borderRadius: UI.radius.medium - 2,
    backgroundColor: COLORS.surface,
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
    borderRadius: UI.radius.medium - 2,
    backgroundColor: COLORS.dangerSoft,
    gap: 7,
  },
  deleteButtonText: {
    color: COLORS.dangerText,
    fontSize: 13,
    fontWeight: "700",
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
    borderRadius: UI.radius.large,
    gap: 8,
    elevation: 5,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  fabText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(74, 47, 58, 0.45)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: UI.radius.large + 6,
    borderTopRightRadius: UI.radius.large + 6,
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
    color: COLORS.textPrimary,
    fontSize: 21,
    fontWeight: "700",
  },
  modalSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 5,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: UI.radius.small + 2,
    backgroundColor: COLORS.surface,
    justifyContent: "center",
    alignItems: "center",
  },
  inputLabel: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
    marginTop: 5,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    borderRadius: UI.radius.medium - 2,
    paddingHorizontal: 13,
    color: COLORS.textPrimary,
    fontSize: 13,
    marginBottom: 15,
  },
  helperText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 0,
    marginBottom: 18,
  },
  saveButton: {
    height: 50,
    backgroundColor: COLORS.primary,
    borderRadius: UI.radius.medium,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  disabledButton: {
    opacity: 0.65,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  cancelButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    marginTop: 5,
  },
  cancelButtonText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: "700",
  },
});
