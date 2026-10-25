# GILHANG QR Attendance System — UI Unification Plan

> **Status: DRAFT — awaiting approval. No source code has been modified.**
> Date prepared: October 25, 2026
> Baseline: working tree on top of commit `d975710` ("final 1.1 commit"), TypeScript clean (`npx tsc --noEmit` passes with 0 errors).

---

## 1. Goal

Make every existing screen share one clean, modern, pink-and-white design language
**without changing any behavior**: no auth changes, no QR/attendance logic changes,
no navigation changes, no new dependencies, no renames, no rebuilds.

Design sources of truth:

- `constants/colors.ts` — pink palette (primary `#EE7FA4`, background `#FFF8FA`, card white, border `#F5D9E1`, surface `#FFEBF0`).
- `constants/ui.ts` — radius (10/14/18/pill), spacing (4/8/12/16/24), typography sizes, shared card style.
- `components/AppButton.tsx` — 52px-high primary/secondary buttons (kept as-is, reused more widely).

---

## 2. Audit Summary (based on reading the actual current files)

### What is already good
| Item | Verdict |
|---|---|
| `constants/colors.ts`, `constants/ui.ts` | Correct pink theme; exists but under-used by screens. |
| `components/AppButton.tsx`, `components/Header.tsx` | Consistent, reusable, working. Keep. |
| `app/(tabs)/_layout.tsx` tab bar | Already pink-themed. No change. |
| `app/admin.tsx` | Only admin screen that already imports the pink `COLORS`. |
| Student/teacher tabs + login + register | Already use pink `COLORS`. |
| History "Confirmed" badge accuracy | **Verified correct**: `lib/database.ts` sets `synced = 1` only after a successful Supabase insert, so offline records correctly show "Pending Sync". No code change needed. |
| Teacher event logic (create/edit/delete/pickers/quick-end/QR) | Sound. Will not be rewritten. |
| Admin role verification on every screen | Working. Will not be touched. |

### Problems found
1. **Three off-theme palettes in the admin area:**
   - `app/admin/users.tsx` — local olive/green palette `C` (`#617A46`, `#F5F6EB`, `#D9E3C4`).
   - `app/admin/events.tsx` — local teal palette `COLORS` (`#246B67`, `#F5F8F8`).
   - `app/admin/attendance.tsx` — local teal palette `COLORS` (`#246B67`).
   - `app/admin/reports.tsx` — ~80 hard-coded teal hex values (`#246B67`, `#173D3A`, `#F4F8F7`…).
2. **Hard-coded semantic colors** scattered in scan, history, teacher, profile, reports (success/error/pending/status/role tints) instead of shared constants.
3. **Corner-radius chaos:** 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 22, 24, 25 px used across screens (target: 10/14/18 per `constants/ui.ts`).
4. **Typography inconsistency:** page titles 22–30px; weights mixed 600/700/800.
5. **Spacing inconsistency:** page padding 18/20/22/24; card padding 15–22.
6. **Empty / loading / error states:** three different visual languages (plain text in history/teacher; icon cards in admin; ad-hoc cards in profile).
7. **Duplicated badge styles** in 5 places (history, teacher, profile, admin users, admin reports) with slightly different colors.
8. **Minor:** `app/+not-found.tsx` is a dark `#25292e` screen — the only non-pink screen.
9. **Minor:** `teacher.tsx` contains ~6 dead style entries from an older layout (`existingCard`, `existingMain`, `existingActions`, `actionButton`, `actionButtonPressed`, `dangerButton`, `existingInfo`, `existingTitle`, `existingCode`) — verified not referenced by any JSX.

---

## 3. Files That Will Be Modified

| # | File | Batch | Nature of change |
|---|---|---|---|
| 1 | `constants/colors.ts` | 1 | Additive only: new semantic tokens (see §4). |
| 2 | `components/Badge.tsx` | 1 | **New file** — shared pill badge. |
| 3 | `components/EmptyState.tsx` | 1 | **New file** — shared icon + title + message empty state. |
| 4 | `app/(tabs)/index.tsx` | 2 | Style-only restyle. |
| 5 | `app/(tabs)/scan.tsx` | 3 | Style-only restyle (logic untouched). |
| 6 | `app/(tabs)/history.tsx` | 4 | Restyle + summary chips + shared Badge/EmptyState (data logic untouched). |
| 7 | `app/(tabs)/profile.tsx` | 5 | Restyle (handlers untouched). |
| 8 | `app/(tabs)/teacher.tsx` | 6 | Restyle + Badge (all event functions untouched; optional dead-style removal). |
| 9 | `app/admin.tsx` | 7 | Light polish only (already on-theme). |
| 10 | `app/admin/users.tsx` | 8 | Retheme olive → pink via imported `COLORS`. |
| 11 | `app/admin/events.tsx` | 9 | Retheme teal → pink via imported `COLORS`. |
| 12 | `app/admin/attendance.tsx` | 10 | Retheme teal → pink via imported `COLORS`. |
| 13 | `app/admin/reports.tsx` | 11 | Retheme teal → pink; icon back button for consistency. |
| 14 | `app/+not-found.tsx` | 12 *(optional)* | Theme dark screen to pink. |

## 4. Files That Will NOT Be Touched (protected / out of scope)

```
.env, .env.example, supabase/**          — never touched
lib/auth.ts, lib/supabase.ts             — protected (restriction #4)
app/_layout.tsx                          — protected (restriction #4)
lib/database.ts, lib/attendance.ts,
lib/events.ts, lib/profiles.ts, lib/qr.ts — business logic, untouched
app/login.tsx, app/register.tsx, app/index.tsx — auth flow, untouched
app/(tabs)/_layout.tsx                   — tab bar already on-theme
package.json, package-lock.json          — no new dependencies
app.json, eas.json, metro.config.js, tsconfig.json
assets/**                                — branding untouched
constants/student.ts                     — untouched
```

---

## 5. Batch Details

### Batch 0 — Git checkpoint
Commit the current (pre-existing, uncommitted) working tree as a baseline commit,
e.g. `baseline before UI unification`. Then every later `git diff` shows only my
UI changes, and rollback is trivial. *(Method per your answer to the checkpoint
question.)*

### Batch 1 — Foundations

**`constants/colors.ts`** — additive keys only; existing keys unchanged:

```ts
// NEW semantic tokens (values chosen from tones already used in the app,
// softened to sit on the pink background):
success:  "#9DC3A6",   // exists already
successSoft: "#E9F4EC", // tint behind "Confirmed" style badges
successText: "#2E7D32", // already hard-coded in scan/history
warning:     "#B7791F", // already hard-coded (Pending Sync text)
warningSoft: "#FFF3E0", // already hard-coded (Pending Sync badge bg)
danger:      "#E07A93", // exists already
dangerSoft:  "#FDECEF", // tint behind delete/error surfaces (pink-toned)
dangerText:  "#C62828", // already hard-coded (error text)
info:        "#7FA8E0", // softened from #DBEAFE usage (Upcoming badge)
infoSoft:    "#EAF1FB", // tint behind "Upcoming" badge
```

**`components/Badge.tsx`** (new):

```ts
type BadgeTone = "confirmed" | "pending" | "upcoming" | "ongoing"
               | "ended" | "unscheduled" | "neutral" | "info";
type Props = { label: string; tone: BadgeTone };
```
- Pill (radius 999), paddingHorizontal 10, paddingVertical 5, fontSize 11, fontWeight "700".
- Each tone = soft background + readable text color from `COLORS`.

**`components/EmptyState.tsx`** (new):

```ts
type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
};
```
- Centered Ionicon in a `COLORS.surface` circle (72px, radius 24), title 16/700 textPrimary, message 13 textSecondary centered, max width for readability.

**Validation:** `npx tsc --noEmit` (nothing imports the new files yet, so this batch is zero-risk).

### Batch 2 — Student Home `app/(tabs)/index.tsx`
**Preserved:** greeting logic, live date via `useFocusEffect`, School Event Attendance card, Scan QR / History / Profile buttons (same routes), Attendance Reminder.

Changes:
- Replace hard-coded card styles with `UI.card` base (radius 18, border, shadow).
- Normalize page padding to 24, section gaps to `UI.space.xl` (24).
- Greeting 26→24/800 for consistency with other page titles; date stays 14 secondary.
- Reminder card gets surface-tinted background (`COLORS.surface`) to differentiate it from white info cards.
- No imports removed; `Header`, `AppButton`, router pushes untouched.

### Batch 3 — QR Scanner `app/(tabs)/scan.tsx`
**Preserved 100% of logic:** `useCameraPermissions`, `syncPendingAttendance` on focus, `registerAttendance`, `getResultTitle`, status state machine, Scan Again reset, sign-in prompt.

Changes (style + presentation only):
- Overlay card: radius 18→keep, add shadow (`UI.card` shadow), padding 22→20 for consistency.
- Add a lightweight **scan-frame guide**: thin rounded rectangle outline (border `COLORS.card` at 90% opacity) centered over the camera — purely decorative, no camera behavior change.
- Result presentation: status-tinted icon circle + tinted title using new semantic tokens (success → `successText`, error → `dangerText`, pending → `warning`, loading → primary).
- Loading indicator stays `ActivityIndicator` primary.
- Hard-coded `#2E7D32 / #C62828 / #B7791F` replaced by `COLORS` tokens.

### Batch 4 — Attendance History `app/(tabs)/history.tsx`
**Preserved:** role branching (teacher vs student), all data loading in `load()` (including Supabase name lookup), `formatDate`, `shortId`, FlatList keys.

Changes:
- Wrap screens in `SafeAreaView` for consistent top inset on Android (matching Home).
- Student summary → row of 2–3 stat chips in one card: **Total** / **Confirmed** (synced === 1) / **Pending** (synced === 0) — computed from the existing `studentRecords` array, no new queries.
- Badges → `Badge` component (`confirmed` / `pending` tones). Pending notice text uses `COLORS.warning`.
- Empty states (no records / no events) → `EmptyState` component; loading & error screens restyled to match (primary spinner + secondary text; error uses `dangerText`).
- Teacher event cards: add `UI.card` shadow, attendee rows keep dividers; attendee name 14/600; timestamps 12 secondary.

### Batch 5 — Profile `app/(tabs)/profile.tsx`
**Preserved:** all handlers (`loadProfile`, `handleRefresh`, `handleSaveName`, `handleCancelEdit`, `performSignOut`, `handleSignOut` with Alert confirmation), validation limits, pull-to-refresh.

Changes:
- Avatar: 96px circle, `COLORS.surface` fill, 1px `COLORS.border` ring, initial 40/700 primary — centered above account card.
- Role badge → `Badge` with a mapped tone (admin → `info`, teacher → `unscheduled`-amber, student → `confirmed`-green); role label logic untouched.
- Unify small buttons (Refresh / Edit / Save Changes / Cancel / Retry): one shared shape — radius `UI.radius.small` (10), minHeight 40, 13/700 labels, primary = pink fill / secondary = surface fill.
- Sections: label 11 uppercase secondary (keep), value 15/500; dividers between sections using `COLORS.border` for scannability.
- Inputs: radius 12, border `COLORS.border`, white background, minHeight 46 (touch-friendly).

### Batch 6 — Teacher Events `app/(tabs)/teacher.tsx`
**Preserved 100%:** every state variable and handler (`openPicker`, `onPickerChange`, `handleQuickEnd`, `handleCreateEvent`, `handleShowExisting`, `refreshEvents`, `applyTypedTime`, `handleEditEvent`, `handleCancelEdit`, `handleUpdateEvent`, `handleDeleteEvent`), `DateTimePicker` wiring, `WebDateTimeInput`, `PickerField`, QR payload rendering, role gating.

Changes:
- Event cards: `UI.card` shadow + radius 18; title 16/700; status badge → `Badge` (`upcoming`/`ongoing`/`ended`/`unscheduled` tones).
- Detail rows: keep icons; text 13 (slightly larger than current 12) secondary.
- Action buttons: unify to minHeight 44, radius `UI.radius.medium` (14); Show QR = primary fill, Edit/Delete = surface fill with danger text/icon on Delete.
- Form card: radius 18, inputs consistent with profile inputs (minHeight 46, radius 12); chips keep pill shape with `COLORS.surface` + primary text.
- Section header/count pill/refresh button: normalized to tokens.
- *(Optional, if approved)* remove the 9 verified-dead style entries listed in §2.9.

### Batch 7 — Admin Dashboard `app/admin.tsx`
**Preserved:** all stats loading, role verification redirect, menu navigation, pull-to-refresh, sign-out alert.

Changes (light):
- `content` paddingTop 56→24 (footer already safe); spacing normalized to 16/24 steps.
- Stat cards & menu cards: adopt `UI.card` shadow exactly (currently shadow-less); radius 16→18 for cards; keep grid layout and all labels/icons.
- Sign-out button: keep outline style; hover/press states unchanged.

### Batch 8 — Admin Users `app/admin/users.tsx` (olive → pink)
- Delete local `const C = {...}`; `import { COLORS } from "@/constants/colors"`; map:
  `C.primary→COLORS.primary`, `C.background→COLORS.background`, `C.card→COLORS.card`, `C.surface→COLORS.surface`, `C.border→COLORS.border`, `C.text→COLORS.textPrimary`, `C.secondary→COLORS.textSecondary`, `C.danger→COLORS.danger`, teacher/admin badge bgs → `COLORS.surface`/`COLORS.infoSoft`.
- Hard-coded placeholder `#909989` → `COLORS.textSecondary`.
- Keep ALL functionality: role gating redirect, user list, search filter, Add Teacher form (Edge Function `admin-create-teacher` call untouched), role-change Alert, sign-out, refresh, empty state (→ `EmptyState`).

### Batch 9 — Admin Events `app/admin/events.tsx` (teal → pink)
- Delete local `const COLORS = {...}` (name collides with import, so local object is removed and every reference remapped):
  `white→COLORS.card`, `muted→COLORS.textSecondary`, `text→COLORS.textPrimary`, `primaryLight→COLORS.surface`, `dangerLight→COLORS.dangerSoft`, `danger→COLORS.dangerText`, `success→COLORS.success`.
- Geometry normalized: card radius 17→18, buttons radius 11→`UI.radius.medium` (14), top bar unchanged structurally.
- Keep ALL functionality: CRUD (insert/update/delete with role re-verification), search, refresh, modal form with `YYYY-MM-DD HH:mm` validation, FAB, empty state (→ `EmptyState`).

### Batch 10 — Admin Attendance `app/admin/attendance.tsx` (teal → pink)
- Same remap strategy as Batch 9.
- Keep ALL functionality: record list, search, correction modal (student/event selector modals, timestamp parsing via `toTimestamp`), delete with role re-verification, refresh, empty state (→ `EmptyState`).

### Batch 11 — Admin Reports `app/admin/reports.tsx` (teal → pink)
- Replace every hard-coded hex with `COLORS` equivalents (mapping as in Batch 9).
- Replace text back-button (`"<  Administrator Dashboard"`) with icon back button in a top bar matching events/attendance screens (arrow icon + title + subtitle) — same `router.replace("/admin")` target.
- Stat cards get icon circles (matching admin dashboard `StatCard` look) — presentation only; all computed numbers, date filtering, and validation logic untouched.
- Error card: keep structure; colors from tokens (`dangerSoft` bg, `dangerText` title).

### Batch 12 (optional) — `app/+not-found.tsx`
- Dark `#25292e` → `COLORS.background`, link styled as a pink `AppButton`-like pressable.
- Purely cosmetic; routing untouched.

---

## 6. Validation Protocol

After **every batch**:
1. `npx tsc --noEmit` — must stay at 0 errors.
2. Targeted `git diff <file>` review of that batch.

At the **end**:
3. `git diff --stat` full summary.
4. `git status` — confirm none of the protected files appear.
5. Final written summary per file.

**Honest scope of testing:** TypeScript compile checks + code review only. I cannot
run the Expo app or an Android device/emulator from here — runtime behavior
(scanning, sync, camera permission prompts) must be verified by you on a device.
I will never claim runtime verification I didn't perform.

## 7. Risk Notes

- Admin retheme batches (8–11) are the largest diffs but are mechanical color/geometry remaps; all query and state logic is copy-preserving.
- New components (`Badge`, `EmptyState`) are additive; existing screens keep working even if a prop is missed because both have safe defaults.
- `constants/colors.ts` changes are additive keys only — no existing import can break.
- If anything in a batch looks riskier than described while implementing, I will stop and report instead of forcing the change (per restriction: report required-but-blocked changes separately).
