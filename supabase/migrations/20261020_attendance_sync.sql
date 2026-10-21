-- Attendance sync migration
-- Run this in: Supabase Dashboard -> SQL Editor (safe to run more than once)
--
-- The app now writes scans to the cloud:
--   * UNIQUE (event_id, student_id) makes duplicate scans impossible at the
--     database level and powers the upsert's ON CONFLICT clause.
--   * RLS lets a signed-in student insert their own attendance row and read
--     their own rows, and lets teachers/admins read everything.
--   * is_staff() lets policies check a user's role without recursing into
--     the profiles table's own RLS policies.

-- ---------------------------------------------------------------------------
-- 1. Helper: is the signed-in user a teacher or admin?
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('teacher', 'admin', 'administrator')
  );
$$;

REVOKE ALL ON FUNCTION public.is_staff() FROM public;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Remove existing duplicate attendance rows (keeps the earliest per pair),
--    then add the unique constraint if it is missing.
-- ---------------------------------------------------------------------------

DELETE FROM public.attendance
WHERE id NOT IN (
  SELECT MIN(id)
  FROM public.attendance
  GROUP BY event_id, student_id
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conrelid = 'public.attendance'::regclass
      AND c.contype = 'u'
      AND (
        SELECT array_agg(a.attname ORDER BY a.attname)
        FROM unnest(c.conkey) AS k
        JOIN pg_attribute a
          ON a.attrelid = c.conrelid AND a.attnum = k
      ) = ARRAY['event_id', 'student_id']
  ) THEN
    ALTER TABLE public.attendance
      ADD CONSTRAINT attendance_event_student_unique UNIQUE (event_id, student_id);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Row level security policies (recreated so the bodies are always current).
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users insert their own attendance" ON public.attendance;
CREATE POLICY "Users insert their own attendance"
  ON public.attendance FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Users read their own attendance" ON public.attendance;
CREATE POLICY "Users read their own attendance"
  ON public.attendance FOR SELECT TO authenticated
  USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Staff read all attendance" ON public.attendance;
CREATE POLICY "Staff read all attendance"
  ON public.attendance FOR SELECT TO authenticated
  USING (public.is_staff());

-- Scanning validates the event code against the events table.
DROP POLICY IF EXISTS "Authenticated users read events" ON public.events;
CREATE POLICY "Authenticated users read events"
  ON public.events FOR SELECT TO authenticated
  USING (true);

-- Teachers see attendee names (not UUIDs) in their history screen.
DROP POLICY IF EXISTS "Staff read profiles" ON public.profiles;
CREATE POLICY "Staff read profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.is_staff());
