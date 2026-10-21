// lib/auth.ts

import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import type { Session, User } from "@supabase/supabase-js";

type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
};

export type SignUpProfile = {
  full_name: string;
  role: "student" | "teacher";
};

// Shared authentication state for the entire app.
let globalSession: Session | null = null;
let globalUser: User | null = null;
let globalLoading = true;

const listeners = new Set<() => void>();

let authInitialized = false;

// Notify every component using useAuth().
function notify() {
  listeners.forEach((listener) => listener());
}

// Update the shared authentication state.
export function setAuth(session: Session | null) {
  globalSession = session;
  globalUser = session?.user ?? null;
  globalLoading = false;

  notify();
}

// Initialize the Supabase authentication listener once.
function initializeAuth() {
  if (authInitialized) {
    return;
  }

  authInitialized = true;
  globalLoading = true;

  supabase.auth.onAuthStateChange((_event, session) => {
    setAuth(session);
  });

  // Resolve the stored session explicitly. Waiting only for the INITIAL_SESSION
  // event can leave the app stuck on the loading screen when the event never
  // fires (PKCE + SecureStore on some devices/launches).
  supabase.auth
    .getSession()
    .then(({ data }) => {
      setAuth(data.session);
    })
    .catch((error) => {
      console.error('Failed to load the stored session:', error);
      setAuth(null);
    });

  // Fail open: if nothing has resolved after a few seconds, continue signed
  // out instead of showing the loading screen forever.
  setTimeout(() => {
    if (globalLoading) {
      console.warn('Auth did not resolve in time; continuing signed out.');
      setAuth(null);
    }
  }, 5000);
}

// Access authentication state from any component.
export function useAuth(): AuthState {
  const [, forceRender] = useState(0);

  useEffect(() => {
    const listener = () => {
      forceRender((value) => value + 1);
    };

    // Subscribe before initializing authentication.
    listeners.add(listener);

    initializeAuth();

    return () => {
      listeners.delete(listener);
    };
  }, []);

  return {
    session: globalSession,
    user: globalUser,
    loading: globalLoading,
  };
}

// Register a new student or teacher.
export async function signUp(
  email: string,
  password: string,
  profile?: SignUpProfile,
) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
  });

  if (error) {
    return { data, error };
  }

  // The database trigger should create the profile row.
  // Update the name and role when a session is available.
  if (data.session && profile) {
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        full_name: profile.full_name.trim(),
        role: profile.role,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.session.user.id);

    if (profileError) {
      console.error(
        "Failed to update the new user's profile:",
        profileError.message,
      );
    }
  }

  if (data.session) {
    setAuth(data.session);
  }

  return { data, error: null };
}

// Sign in with email and password.
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) {
    return { data, error };
  }

  if (data.session) {
    setAuth(data.session);
  }

  return { data, error: null };
}

// Sign out from Supabase.
export async function signOut() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("Sign-out failed:", error.message);

    // Keep the current session if Supabase reports an error.
    return { error };
  }

  setAuth(null);

  return { error: null };
}
