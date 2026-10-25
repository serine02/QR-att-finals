import * as SQLite from "expo-sqlite";

import { recordCloudAttendance } from "./attendance";
import { lookupEventByCode } from "./events";
import { parseQRPayload } from "./qr";

export type AttendanceRecord = {
  id: number;
  eventId: string;
  eventTitle: string;
  scannedAt: string;
  synced: number;
};

export type RegisterResult = {
  success: boolean;
  message: string;
  eventTitle?: string;
};

let db: SQLite.SQLiteDatabase | null = null;

async function getDb() {
  if (!db) {
    db = await SQLite.openDatabaseAsync("qr-attendance.db");
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS events (
        eventId TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        start TEXT NOT NULL,
        end TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        studentId TEXT NOT NULL,
        eventId TEXT NOT NULL,
        scannedAt TEXT NOT NULL,
        synced INTEGER NOT NULL DEFAULT 0,
        UNIQUE (studentId, eventId)
      );
    `);

    // Migrate databases created before the sync queue existed.
    const columns = await db.getAllAsync<{ name: string }>(
      "PRAGMA table_info(attendance)",
    );
    if (!columns.some((column) => column.name === "synced")) {
      await db.execAsync(
        "ALTER TABLE attendance ADD COLUMN synced INTEGER NOT NULL DEFAULT 0",
      );
    }
  }
  return db;
}

// Errors that mean the Supabase schema is not set up yet, not that the
// device is offline. They must not be swallowed by the offline queue.
function isSetupError(message: string) {
  return /constraint|conflict|row-level security|policy|permission denied/i.test(
    message,
  );
}

async function saveLocalAttendance(
  studentId: string,
  eventId: string,
  title: string,
  start: string,
  end: string,
  scannedAt: string,
  synced: boolean,
) {
  const database = await getDb();

  await database.runAsync(
    "INSERT OR IGNORE INTO events (eventId, title, start, end) VALUES (?, ?, ?, ?)",
    eventId,
    title,
    start,
    end,
  );

  await database.runAsync(
    "INSERT OR IGNORE INTO attendance (studentId, eventId, scannedAt, synced) VALUES (?, ?, ?, ?)",
    studentId,
    eventId,
    scannedAt,
    synced ? 1 : 0,
  );
}

// Record a scan. The cloud (Supabase) is the source of truth; SQLite keeps a
// local copy for the student's history and acts as an offline queue when the
// device has no connection.
export async function registerAttendance(
  rawPayload: string,
  studentId: string,
): Promise<RegisterResult> {
  const parsed = parseQRPayload(rawPayload);
  if (!parsed.ok) {
    return { success: false, message: parsed.message };
  }

  const payload = parsed.payload;
  const database = await getDb();
  const now = new Date().toISOString();

  // Fast local duplicate check for immediate feedback.
  const existing = await database.getFirstAsync<{ id: number }>(
    "SELECT id FROM attendance WHERE studentId = ? AND eventId = ?",
    studentId,
    payload.event,
  );
  if (existing) {
    return {
      success: false,
      message: "Already registered for this event.",
      eventTitle: payload.title ?? payload.event,
    };
  }

  // The event must exist in Supabase: teachers create it there, and the
  // saved record (not the QR) decides whether the time window is valid.
  const { event, error: lookupError } = await lookupEventByCode(payload.event);

  if (lookupError) {
    // Could not reach Supabase: queue the scan and sync later.
    // Fall back to the times inside the QR for a best-effort check.
    if (!validateWindow(payload.start, payload.end)) {
      return {
        success: false,
        message: "Event has not started yet or has already ended.",
        eventTitle: payload.title ?? payload.event,
      };
    }

    await saveLocalAttendance(
      studentId,
      payload.event,
      payload.title ?? payload.event,
      payload.start ?? "",
      payload.end ?? "",
      now,
      false,
    );

    return {
      success: true,
      message: "Saved offline. It will sync when you are back online.",
      eventTitle: payload.title ?? payload.event,
    };
  }

  if (!event) {
    return {
      success: false,
      message:
        "Unknown event code. Ask the teacher to create the event in the app.",
    };
  }

  // Validate the time window against the stored event, not the QR payload.
  if (!validateWindow(event.start_time, event.end_time)) {
    const notStarted = event.start_time
      ? Date.now() < new Date(event.start_time).getTime()
      : false;

    return {
      success: false,
      message: notStarted
        ? "Event has not started yet."
        : "Event has already ended.",
      eventTitle: event.title,
    };
  }

  const cloud = await recordCloudAttendance(event.id, studentId, now);

  if (cloud.error) {
    if (isSetupError(cloud.error)) {
      console.error("Attendance save rejected by Supabase:", cloud.error);
      return {
        success: false,
        message:
          "The server refused to save attendance. Ask the admin to run the attendance database migration.",
      };
    }

    // Network dropped mid-request: queue it.
    await saveLocalAttendance(
      studentId,
      payload.event,
      event.title,
      event.start_time ?? "",
      event.end_time ?? "",
      now,
      false,
    );

    return {
      success: true,
      message: "Saved offline. It will sync when you are back online.",
      eventTitle: event.title,
    };
  }

  // Keep a local copy (synced or duplicate - either way the cloud has it).
  await saveLocalAttendance(
    studentId,
    payload.event,
    event.title,
    event.start_time ?? "",
    event.end_time ?? "",
    now,
    true,
  );

  if (cloud.duplicate) {
    return {
      success: false,
      message: "Already registered for this event.",
      eventTitle: event.title,
    };
  }

  return {
    success: true,
    message: "Attendance recorded!",
    eventTitle: event.title,
  };
}

function validateWindow(
  start: string | null | undefined,
  end: string | null | undefined,
) {
  const now = Date.now();
  const startTime = start ? new Date(start).getTime() : null;
  const endTime = end ? new Date(end).getTime() : null;

  if (startTime && now < startTime) return false;
  if (endTime && now > endTime) return false;
  return true;
}

// Push every locally queued (unsynced) scan to Supabase.
// Returns how many records were synced.
export async function syncPendingAttendance(): Promise<number> {
  const database = await getDb();

  const pending = await database.getAllAsync<{
    studentId: string;
    eventId: string;
    scannedAt: string;
  }>(
    "SELECT studentId, eventId, scannedAt FROM attendance WHERE synced = 0 ORDER BY scannedAt ASC LIMIT 100",
  );

  if (pending.length === 0) {
    return 0;
  }

  let synced = 0;

  for (const row of pending) {
    const { event, error } = await lookupEventByCode(row.eventId);

    if (error || !event) {
      // Still offline, or the event does not exist. Try again later.
      continue;
    }

    const result = await recordCloudAttendance(
      event.id,
      row.studentId,
      row.scannedAt,
    );

    if (result.error) {
      if (isSetupError(result.error)) {
        console.error("Sync rejected by Supabase:", result.error);
        break;
      }
      continue;
    }

    await database.runAsync(
      "UPDATE attendance SET synced = 1 WHERE studentId = ? AND eventId = ?",
      row.studentId,
      row.eventId,
    );
    synced += 1;
  }

  return synced;
}

export async function getAttendanceHistory(
  studentId: string,
): Promise<AttendanceRecord[]> {
  const database = await getDb();
  const rows = await database.getAllAsync<AttendanceRecord>(
    `
SELECT
  a.id,
  a.eventId,
  e.title AS eventTitle,
  a.scannedAt,
  a.synced
FROM attendance a
JOIN events e ON e.eventId = a.eventId
WHERE a.studentId = ?
ORDER BY a.scannedAt DESC
`,
    studentId,
  );
  return rows;
}
