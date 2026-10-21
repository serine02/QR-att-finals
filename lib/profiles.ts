// lib/profile.ts

import { supabase } from "@/lib/supabase";

export type Role = "student" | "teacher" | "admin";

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: Role;
  created_at?: string;
  updated_at?: string;
};

type ProfileUpdates = {
  full_name?: string;
  role?: Role;
};

// Normalize the role received from Supabase.

function normalizeRole(value: unknown): Role {
  const role = String(value ?? "")
    .trim()
    .toLowerCase();

  if (role === "student" || role === "teacher" || role === "admin") {
    return role;
  }

  // Older rows stored "administrator"; the app now uses "admin" everywhere.
  if (role === "administrator") {
    return "admin";
  }

  return "student";
}

// Fetch the current user's profile from Supabase.
export async function getProfile(userId: string): Promise<Profile | null> {
  if (!userId) {
    throw new Error("A user ID is required to fetch the profile.");
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, created_at, updated_at")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching profile:", error.message);
    throw error;
  }

  if (!data) {
    console.warn("No profile found for user:", userId);
    return null;
  }

  return {
    ...data,
    role: normalizeRole(data.role),
  } as Profile;
}

// Update the current user's profile.
export async function updateProfile(
  userId: string,
  updates: { full_name: string },
) {
  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId)
    .select()
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data, error: null };
}
