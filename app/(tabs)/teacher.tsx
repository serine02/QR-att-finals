import Ionicons from "@expo/vector-icons/Ionicons";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import {
  createElement,
  useCallback,
  useState,
  type ChangeEvent,
  type CSSProperties,
} from "react";
import { useFocusEffect } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";

import AppButton from "@/components/AppButton";
import Badge from "@/components/Badge";
import { COLORS } from "@/constants/colors";
import { UI } from "@/constants/ui";
import { useAuth } from "@/lib/auth";
import {
  createEvent,
  deleteEvent,
  getEventsByTeacher,
  updateEvent,
  type CloudEvent,
} from "@/lib/events";
import { getProfile, type Role } from "@/lib/profiles";

function toLocalISO(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:00`
  );
}

function formatDateTime(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const month = date.toLocaleString("en-US", { month: "short" });

  return `${month} ${pad(date.getDate())}, ${date.getFullYear()} at ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function parseTypedDateTime(dateText: string, timeText: string) {
  const dateMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(dateText.trim());
  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(timeText.trim());

  if (!dateMatch || !timeMatch) return null;

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]) - 1;
  const day = Number(dateMatch[3]);
  const hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);

  if (month < 0 || month > 11 || day < 1 || day > 31) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  const date = new Date(year, month, day, hours, minutes, 0, 0);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function getEventStatus(event: CloudEvent) {
  if (!event.start_time || !event.end_time) {
    return "Unscheduled";
  }

  const start = new Date(event.start_time).getTime();
  const end = new Date(event.end_time).getTime();
  const now = Date.now();

  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
    return "Unscheduled";
  }

  if (now < start) return "Upcoming";
  if (now >= end) return "Ended";

  return "Ongoing";
}

const QUICK_END_OPTIONS = [
  { label: "+30 min", ms: 30 * 60 * 1000 },
  { label: "+1 hour", ms: 60 * 60 * 1000 },
  { label: "+2 hours", ms: 2 * 60 * 60 * 1000 },
];

type EditTarget = "start" | "end";

export default function TeacherScreen() {
  const { user } = useAuth();

  const [role, setRole] = useState<Role | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [roleLoading, setRoleLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [eventId, setEventId] = useState("");
  const [startDate, setStartDate] = useState(() => new Date());
  const [endDate, setEndDate] = useState(
    () => new Date(Date.now() + 60 * 60 * 1000),
  );
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [editingPart, setEditingPart] = useState<"date" | "time">("date");
  const [visibleQrCode, setVisibleQrCode] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [existingEvents, setExistingEvents] = useState<CloudEvent[]>([]);
  const [existingLoading, setExistingLoading] = useState(true);

  const [startDateText, setStartDateText] = useState("");
  const [startTimeText, setStartTimeText] = useState("");
  const [endDateText, setEndDateText] = useState("");
  const [endTimeText, setEndTimeText] = useState("");
  const [editingEvent, setEditingEvent] = useState<CloudEvent | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      if (!user) {
        setRoleLoading(false);

        return () => {
          active = false;
        };
      }

      getProfile(user.id).then((profile) => {
        if (!active) return;

        setRole(profile?.role ?? "student");
        setRoleLoading(false);

        if (profile?.role === "teacher") {
          getEventsByTeacher(user.id).then((events) => {
            if (!active) return;

            setExistingEvents(events);
            setExistingLoading(false);
          });
        }
      });

      return () => {
        active = false;
      };
    }, [user]),
  );

  const isAndroid = Platform.OS === "android";

  const openPicker = (target: EditTarget) => {
    setMessage(null);
    setEditTarget(target);
    setEditingPart("date");
  };

  const onPickerChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (!editTarget) return;

    if (event.type === "dismissed" || !selected) {
      setEditTarget(null);
      setEditingPart("date");
      return;
    }

    const current = editTarget === "start" ? startDate : endDate;
    const next = new Date(current);

    // Android opens date and time as separate pickers.
    // Changing the date must not reset the chosen hour to midnight,
    // and changing the hour must not overwrite the chosen date.
    if (isAndroid && editingPart === "date") {
      next.setFullYear(
        selected.getFullYear(),
        selected.getMonth(),
        selected.getDate(),
      );
    } else if (isAndroid && editingPart === "time") {
      next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    } else {
      next.setFullYear(
        selected.getFullYear(),
        selected.getMonth(),
        selected.getDate(),
      );
      next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    }

    if (editTarget === "start") {
      setStartDate(next);
    } else {
      setEndDate(next);
    }

    if (isAndroid && editingPart === "date") {
      setEditingPart("time");
    } else {
      setEditTarget(null);
      setEditingPart("date");
    }
  };

  const handleQuickEnd = (ms: number) => {
    setMessage(null);
    setEndDate(new Date(startDate.getTime() + ms));
  };

  const handleCreateEvent = () => {
    const event = {
      eventId: eventId.trim(),
      title: title.trim(),
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    };

    if (!event.eventId || !event.title) {
      setMessage("Event title and code are required.");
      return;
    }

    if (endDate.getTime() <= startDate.getTime()) {
      setMessage("End time must be after start time.");
      return;
    }

    createEvent(event).then(({ error }) => {
      if (error) {
        setMessage("Could not save the event. Please try again.");
        return;
      }

      setMessage("Event created! Its QR code is below the event card.");
      setShowForm(false);

      setVisibleQrCode(event.eventId);

      if (user) {
        getEventsByTeacher(user.id).then((events) => {
          setExistingEvents(events);
          setExistingLoading(false);
        });
      }
    });
  };

  const handleShowExisting = (ev: CloudEvent) => {
    setVisibleQrCode((current) =>
      current === ev.event_code ? null : ev.event_code,
    );
  };

  const refreshEvents = () => {
    if (!user) return;

    getEventsByTeacher(user.id).then((events) => {
      setExistingEvents(events);
      setExistingLoading(false);
    });
  };

  const applyTypedTime = () => {
    const start = parseTypedDateTime(startDateText, startTimeText);
    const end = parseTypedDateTime(endDateText, endTimeText);

    if (!start || !end) {
      setMessage("Use YYYY-MM-DD for date and HH:MM for time.");
      return;
    }

    if (end.getTime() <= start.getTime()) {
      setMessage("End time must be after start time.");
      return;
    }

    setStartDate(start);
    setEndDate(end);
    setMessage("Date and time set from the fields above.");
  };

  const handleEditEvent = (ev: CloudEvent) => {
    setMessage(`Editing "${ev.title}". Change the details below.`);

    setShowForm(true);
    setEditingEvent(ev);
    setTitle(ev.title);
    setEventId(ev.event_code);

    if (ev.start_time) setStartDate(new Date(ev.start_time));
    if (ev.end_time) setEndDate(new Date(ev.end_time));

    setVisibleQrCode(null);
  };

  const handleCancelEdit = () => {
    setMessage(null);

    setEditingEvent(null);
    setShowForm(false);
    setTitle("");
    setEventId("");
  };

  const handleUpdateEvent = () => {
    if (!editingEvent) return;

    const event = {
      eventId: eventId.trim(),
      title: title.trim(),
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    };

    if (!event.eventId || !event.title) {
      setMessage("Event title and code are required.");
      return;
    }

    if (endDate.getTime() <= startDate.getTime()) {
      setMessage("End time must be after start time.");
      return;
    }

    updateEvent(editingEvent.id, {
      event_code: event.eventId,
      title: event.title,
      start_time: event.start,
      end_time: event.end,
    }).then(({ error }) => {
      if (error) {
        setMessage("Could not update the event. Please try again.");
        return;
      }

      setMessage("Event updated! Its QR code is below the event card.");
      setShowForm(false);

      setEditingEvent(null);
      setVisibleQrCode(event.eventId);
      refreshEvents();
    });
  };

  const handleDeleteEvent = (ev: CloudEvent) => {
    Alert.alert(
      "Delete Event",
      `Delete "${ev.title}"? This also removes all its attendance records.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteEvent(ev.id).then(({ error }) => {
              if (error) {
                setMessage("Could not delete the event. Please try again.");
                return;
              }

              setMessage("Event deleted.");

              if (editingEvent?.id === ev.id) {
                setEditingEvent(null);
              }
              if (visibleQrCode === ev.event_code) {
                setVisibleQrCode(null);
              }

              refreshEvents();
            });
          },
        },
      ],
    );
  };

  if (roleLoading) {
    return (
      <View style={[styles.container, styles.content, styles.centerContent]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.subtitle}>Checking your account...</Text>
      </View>
    );
  }

  if (role !== "teacher") {
    return (
      <View style={[styles.container, styles.content, styles.centerContent]}>
        <View style={styles.lockIcon}>
          <Ionicons
            name="lock-closed-outline"
            size={30}
            color={COLORS.primary}
          />
        </View>

        <Text style={styles.title}>Teachers Only</Text>

        <Text style={styles.subtitle}>
          Only teacher accounts can create events.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.pageHeading}>
        <View style={styles.headingIcon}>
          <Ionicons name="school-outline" size={24} color={COLORS.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.pageTitle}>Teacher Events</Text>
          <Text style={styles.pageSubtitle}>
            Create events and manage QR attendance.
          </Text>
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.primaryCreateButton,
          pressed && styles.pressed,
        ]}
        onPress={() => {
          if (showForm && !editingEvent) {
            setShowForm(false);
          } else {
            setEditingEvent(null);
            setTitle("");
            setEventId("");
            setMessage(null);
            setShowForm(true);
          }
        }}
      >
        <Ionicons
          name={
            showForm && !editingEvent
              ? "close-circle-outline"
              : "add-circle-outline"
          }
          size={22}
          color="#FFFFFF"
        />
        <Text style={styles.primaryCreateText}>
          {showForm && !editingEvent ? "Close Event Form" : "Create New Event"}
        </Text>
      </Pressable>

      {message && !showForm && <Text style={styles.noticeText}>{message}</Text>}

      {showForm && (
        <View style={styles.formCard}>
          <Text style={styles.formHeading}>
            {editingEvent ? "Edit Event" : "Create Event QR"}
          </Text>
          <Text style={styles.formDescription}>
            Enter the event code, schedule, and details below.
          </Text>

          <Text style={styles.label}>Event Title</Text>

          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Founders Day Assembly"
            placeholderTextColor={COLORS.textSecondary}
          />

          <Text style={styles.label}>Event Code</Text>

          <TextInput
            style={styles.input}
            value={eventId}
            onChangeText={setEventId}
            placeholder="e.g. EVT-2026-0002"
            placeholderTextColor={COLORS.textSecondary}
            autoCapitalize="characters"
          />

          <Text style={styles.label}>Starts</Text>

          {Platform.OS === "web" ? (
            <WebDateTimeInput value={startDate} onChange={setStartDate} />
          ) : (
            <PickerField
              value={formatDateTime(startDate)}
              icon="sunny-outline"
              onPress={() => openPicker("start")}
            />
          )}

          <Text style={styles.label}>Ends</Text>

          {Platform.OS === "web" ? (
            <WebDateTimeInput value={endDate} onChange={setEndDate} />
          ) : (
            <PickerField
              value={formatDateTime(endDate)}
              icon="moon-outline"
              onPress={() => openPicker("end")}
            />
          )}

          <Text style={styles.label}>Or type the date & time manually</Text>

          <Text style={styles.fieldLabel}>Start Date (YYYY-MM-DD)</Text>

          <TextInput
            style={styles.input}
            value={startDateText}
            onChangeText={setStartDateText}
            placeholder="e.g. 2026-10-05"
            placeholderTextColor={COLORS.textSecondary}
            autoCapitalize="none"
          />

          <Text style={styles.fieldLabel}>Start Time (HH:MM)</Text>

          <TextInput
            style={styles.input}
            value={startTimeText}
            onChangeText={setStartTimeText}
            placeholder="e.g. 09:00"
            placeholderTextColor={COLORS.textSecondary}
            autoCapitalize="none"
            keyboardType="numbers-and-punctuation"
          />

          <Text style={styles.fieldLabel}>End Date (YYYY-MM-DD)</Text>

          <TextInput
            style={styles.input}
            value={endDateText}
            onChangeText={setEndDateText}
            placeholder="e.g. 2026-10-05"
            placeholderTextColor={COLORS.textSecondary}
            autoCapitalize="none"
          />

          <Text style={styles.fieldLabel}>End Time (HH:MM)</Text>

          <TextInput
            style={styles.input}
            value={endTimeText}
            onChangeText={setEndTimeText}
            placeholder="e.g. 11:00"
            placeholderTextColor={COLORS.textSecondary}
            autoCapitalize="none"
            keyboardType="numbers-and-punctuation"
          />

          <AppButton
            title="Apply Typed Date & Time"
            icon="checkmark-circle-outline"
            onPress={applyTypedTime}
          />

          <View style={styles.chipRow}>
            {QUICK_END_OPTIONS.map((option) => (
              <Pressable
                key={option.label}
                style={({ pressed }) => [
                  styles.chip,
                  pressed && styles.chipPressed,
                ]}
                onPress={() => handleQuickEnd(option.ms)}
              >
                <Text style={styles.chipText}>{option.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.hint}>
            Tap a chip to set the end time from start.
          </Text>

          {message && <Text style={styles.message}>{message}</Text>}

          {editingEvent ? (
            <View style={styles.editControls}>
              <AppButton
                theme="primary"
                title="Update Event"
                icon="checkmark-circle-outline"
                onPress={handleUpdateEvent}
              />

              <Pressable
                style={styles.cancelEditButton}
                onPress={handleCancelEdit}
              >
                <Text style={styles.cancelEditText}>Cancel Editing</Text>
              </Pressable>
            </View>
          ) : (
            <AppButton
              theme="primary"
              title="Create Event"
              icon="add-circle-outline"
              onPress={handleCreateEvent}
            />
          )}
        </View>
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Your Events</Text>

        <View style={styles.sectionControls}>
          <Text style={styles.sectionCount}>{existingEvents.length}</Text>
          <Pressable
            accessibilityLabel="Refresh events"
            onPress={refreshEvents}
            style={({ pressed }) => [
              styles.refreshButton,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="refresh" size={19} color={COLORS.primary} />
          </Pressable>
        </View>
      </View>

      <Text style={styles.sectionHint}>
        See each event's status and manage its QR code.
      </Text>

      {existingLoading ? (
        <View style={styles.listState}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={styles.subtitle}>Loading events...</Text>
        </View>
      ) : existingEvents.length === 0 ? (
        <View style={styles.listState}>
          <EmptyEvents />
        </View>
      ) : (
        <View>
          {existingEvents.map((ev) => {
            const status = getEventStatus(ev);

            const badgeTone =
              status === "Upcoming"
                ? "upcoming"
                : status === "Ongoing"
                  ? "ongoing"
                  : status === "Ended"
                    ? "ended"
                    : "unscheduled";

            return (
              <View key={ev.id} style={styles.eventCard}>
                <View style={styles.eventCardHeading}>
                  <Text style={styles.eventCardTitle}>{ev.title}</Text>
                  <Badge label={status} tone={badgeTone} />
                </View>

                <View style={styles.eventDetailRow}>
                  <Ionicons
                    name="calendar-outline"
                    size={16}
                    color={COLORS.textSecondary}
                  />
                  <Text style={styles.eventDetailText}>
                    Starts:{" "}
                    {ev.start_time
                      ? formatDateTime(new Date(ev.start_time))
                      : "Not set"}
                  </Text>
                </View>
                <View style={styles.eventDetailRow}>
                  <Ionicons
                    name="time-outline"
                    size={16}
                    color={COLORS.textSecondary}
                  />
                  <Text style={styles.eventDetailText}>
                    Ends:{" "}
                    {ev.end_time
                      ? formatDateTime(new Date(ev.end_time))
                      : "Not set"}
                  </Text>
                </View>
                <View style={styles.eventDetailRow}>
                  <Ionicons
                    name="qr-code-outline"
                    size={16}
                    color={COLORS.textSecondary}
                  />
                  <Text style={styles.eventDetailText}>
                    Code: {ev.event_code}
                  </Text>
                </View>

                <View style={styles.eventButtonRow}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.eventAction,
                      styles.showQrAction,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => handleShowExisting(ev)}
                  >
                    <Ionicons
                      name="qr-code-outline"
                      size={17}
                      color="#FFFFFF"
                    />
                    <Text style={styles.showQrText}>
                      {visibleQrCode === ev.event_code ? "Hide QR" : "Show QR"}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.eventAction,
                      styles.neutralAction,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => handleEditEvent(ev)}
                  >
                    <Ionicons
                      name="pencil-outline"
                      size={17}
                      color={COLORS.textPrimary}
                    />
                    <Text style={styles.neutralActionText}>Edit</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.eventAction,
                      styles.neutralAction,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => handleDeleteEvent(ev)}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={17}
                      color={COLORS.dangerText}
                    />
                    <Text style={styles.dangerActionText}>Delete</Text>
                  </Pressable>
                </View>
                {visibleQrCode === ev.event_code && (
                  <View style={styles.inlineQrCard}>
                    <Text style={styles.resultTitle}>
                      Scan this QR code for {ev.title}:
                    </Text>
                    <View style={styles.qrBox}>
                      <QRCode
                        value={JSON.stringify({
                          v: 1,
                          event: ev.event_code,
                          title: ev.title,
                          start: ev.start_time ?? "",
                          end: ev.end_time ?? "",
                        })}
                        size={200}
                      />
                    </View>
                    <Text style={styles.inlineQrHint}>
                      Show this QR to students during the scheduled event.
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {editTarget && (
        <View style={styles.pickerContainer}>
          <DateTimePicker
            value={editTarget === "start" ? startDate : endDate}
            mode={isAndroid ? editingPart : "datetime"}
            display={isAndroid ? "default" : "spinner"}
            onChange={onPickerChange}
          />
        </View>
      )}
    </ScrollView>
  );
}

function EmptyEvents() {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Ionicons
          name="calendar-clear-outline"
          size={30}
          color={COLORS.primary}
        />
      </View>

      <Text style={styles.emptyTitle}>No events created yet</Text>

      <Text style={styles.emptyText}>
        Tap "Create New Event" to schedule your first attendance event.
      </Text>
    </View>
  );
}

const webDateTimeStyle: CSSProperties = {
  width: "100%",
  backgroundColor: COLORS.card,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: COLORS.border,
  borderRadius: 14,
  padding: "12px 14px",
  fontSize: 15,
  color: COLORS.textPrimary,
  boxSizing: "border-box",
  marginBottom: 8,
};

function WebDateTimeInput({
  value,
  onChange,
}: {
  value: Date;
  onChange: (date: Date) => void;
}) {
  return createElement("input", {
    type: "datetime-local",
    value: toLocalISO(value).slice(0, 16),
    onChange: (e: ChangeEvent<HTMLInputElement>) => {
      const text = e.target.value;
      if (!text) return;

      const next = new Date(text);

      if (!Number.isNaN(next.getTime())) {
        onChange(next);
      }
    },
    style: webDateTimeStyle,
  });
}

type PickerFieldProps = {
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};

function PickerField({ value, icon, onPress }: PickerFieldProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.pickerField,
        pressed && styles.pickerFieldPressed,
      ]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={20} color={COLORS.primary} />

      <Text style={styles.pickerValue}>{value}</Text>

      <Ionicons
        name="calendar-outline"
        size={18}
        color={COLORS.textSecondary}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: UI.space.xl,
    paddingTop: UI.space.xl,
    paddingBottom: 40,
  },
  centerContent: {
    justifyContent: "center",
    alignItems: "center",
  },
  pressed: {
    opacity: 0.75,
  },
  pageHeading: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: UI.space.lg,
    gap: UI.space.md,
  },
  headingIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  pageTitle: { fontSize: 24, fontWeight: "800", color: COLORS.textPrimary },
  pageSubtitle: {
    fontSize: UI.typography.caption + 1,
    color: COLORS.textSecondary,
    marginTop: 3,
    lineHeight: 19,
  },
  primaryCreateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    minHeight: 52,
    paddingVertical: UI.space.lg,
    borderRadius: UI.radius.large,
    gap: 9,
    marginBottom: UI.space.sm,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  primaryCreateText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
  },
  formCard: {
    backgroundColor: COLORS.card,
    padding: UI.space.lg,
    borderRadius: UI.radius.large,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: UI.space.md,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  formHeading: {
    fontSize: UI.typography.section,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  formDescription: {
    fontSize: UI.typography.caption + 1,
    color: COLORS.textSecondary,
    marginTop: 5,
    marginBottom: UI.space.sm,
  },
  noticeText: {
    fontSize: UI.typography.caption + 1,
    color: COLORS.primary,
    textAlign: "center",
    marginTop: UI.space.md,
  },
  sectionControls: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: "auto",
    gap: 9,
  },
  refreshButton: {
    width: 36,
    height: 36,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: UI.radius.medium - 2,
    alignItems: "center",
    justifyContent: "center",
  },
  eventCard: {
    backgroundColor: COLORS.card,
    borderRadius: UI.radius.large,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: UI.space.lg,
    marginTop: UI.space.md,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  eventCardHeading: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: UI.space.sm,
    marginBottom: UI.space.md,
  },
  eventCardTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  eventDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginTop: 7,
  },
  eventDetailText: {
    flex: 1,
    fontSize: UI.typography.caption + 1,
    color: COLORS.textSecondary,
  },
  eventButtonRow: {
    flexDirection: "row",
    gap: UI.space.sm,
    marginTop: UI.space.lg,
    paddingTop: UI.space.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  eventAction: {
    flex: 1,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderRadius: UI.radius.medium,
    paddingHorizontal: 4,
  },
  showQrAction: { backgroundColor: COLORS.primary },
  showQrText: { color: "#FFFFFF", fontWeight: "700", fontSize: 12 },
  neutralAction: { backgroundColor: COLORS.surface },
  neutralActionText: {
    color: COLORS.textPrimary,
    fontWeight: "600",
    fontSize: 12,
  },
  dangerActionText: {
    color: COLORS.dangerText,
    fontWeight: "600",
    fontSize: 12,
  },
  lockIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: UI.space.lg,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: UI.space.xs,
    textAlign: "center",
  },
  subtitle: {
    fontSize: UI.typography.body,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginTop: UI.space.md,
    textAlign: "center",
  },
  listState: {
    alignItems: "center",
    paddingVertical: UI.space.xl,
  },
  emptyState: {
    alignItems: "center",
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: UI.space.md,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  emptyText: {
    fontSize: UI.typography.caption + 1,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 19,
    marginTop: UI.space.sm,
  },
  label: {
    fontSize: UI.typography.body,
    fontWeight: "600",
    color: COLORS.textPrimary,
    marginBottom: 6,
    marginTop: UI.space.lg,
  },
  input: {
    backgroundColor: COLORS.card,
    borderRadius: UI.radius.medium - 2,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: UI.space.md,
    paddingVertical: UI.space.md,
    minHeight: 46,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  pickerField: {
    backgroundColor: COLORS.card,
    borderRadius: UI.radius.medium - 2,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: UI.space.md,
    paddingVertical: UI.space.md,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
  },
  pickerFieldPressed: {
    backgroundColor: COLORS.surface,
  },
  pickerValue: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: COLORS.textPrimary,
    marginHorizontal: 10,
  },
  chipRow: {
    flexDirection: "row",
    marginTop: UI.space.sm,
    flexWrap: "wrap",
  },
  chip: {
    backgroundColor: COLORS.surface,
    borderRadius: 999,
    paddingHorizontal: UI.space.md,
    paddingVertical: 7,
    marginRight: UI.space.sm,
    marginBottom: UI.space.sm,
  },
  chipPressed: {
    opacity: 0.7,
  },
  chipText: {
    fontSize: UI.typography.caption + 1,
    fontWeight: "600",
    color: COLORS.primary,
  },
  hint: {
    fontSize: UI.typography.caption,
    color: COLORS.textSecondary,
    marginTop: 6,
  },
  pickerContainer: {
    marginTop: UI.space.md,
    alignItems: "center",
  },
  fieldLabel: {
    fontSize: UI.typography.caption,
    fontWeight: "600",
    color: COLORS.textSecondary,
    marginBottom: 4,
    marginTop: UI.space.md,
  },
  editControls: {
    marginTop: 4,
  },
  cancelEditButton: {
    marginTop: UI.space.md,
    alignItems: "center",
    paddingVertical: UI.space.sm,
  },
  cancelEditText: {
    fontSize: UI.typography.body,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 28,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  sectionCount: {
    marginLeft: 10,
    fontSize: UI.typography.caption,
    fontWeight: "700",
    color: COLORS.textOnPrimary,
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    paddingHorizontal: UI.space.sm,
    paddingVertical: 2,
    overflow: "hidden",
  },
  sectionHint: {
    fontSize: UI.typography.caption,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  message: {
    fontSize: UI.typography.body,
    color: COLORS.primary,
    textAlign: "center",
    marginTop: UI.space.md,
  },
  inlineQrCard: {
    marginTop: UI.space.md,
    padding: UI.space.lg,
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderRadius: UI.radius.large,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  inlineQrHint: {
    fontSize: UI.typography.caption,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginTop: UI.space.xs,
  },
  resultCard: {
    backgroundColor: COLORS.card,
    borderRadius: UI.radius.large,
    padding: UI.space.lg,
    marginTop: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.textPrimary,
    textAlign: "center",
    marginBottom: UI.space.md,
  },
  qrBox: {
    backgroundColor: "#FFFFFF",
    padding: UI.space.md,
    borderRadius: UI.radius.small,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: UI.space.md,
  },
  payloadText: {
    fontSize: UI.typography.caption,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 16,
  },
});
