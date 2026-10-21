-- Normalize legacy role values
-- Run this in: Supabase Dashboard -> SQL Editor (safe to run more than once)
--
-- Older versions of the admin screen wrote "administrator" to profiles.role,
-- but the login flow only accepts "admin" and silently demoted anything it
-- did not recognize. Store one canonical value everywhere.

UPDATE public.profiles
SET role = 'admin'
WHERE role = 'administrator';
