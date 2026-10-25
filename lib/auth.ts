import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "./supabase";

type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
};

export type SignUpProfile = {
  full_name: string;
  role: "student" | "teacher";
};

// Shared authentication state
let currentSession: Session | null = null;
let isInitializing = true;
let initialized = false;

const subscribers = new Set<() => void>();

// Notify all components when authentication changes
function notifySubscribers() {
  console.log("AUTH DEBUG: notifying subscribers");

  subscribers.forEach((callback) => {
    callback();
  });
}

// Update the authentication session
function updateSession(session: Session | null) {
  console.log(
    "AUTH DEBUG: session updated",
    session ? "SIGNED IN" : "SIGNED OUT",
  );

  currentSession = session;
  isInitializing = false;

  notifySubscribers();
}

export function setAuth(session: Session | null) {
  updateSession(session);
}

// Initialize Supabase authentication once
function initializeAuth() {
  console.log("AUTH DEBUG: initializeAuth called");

  if (initialized) {
    console.log("AUTH DEBUG: already initialized");
    return;
  }

  initialized = true;

  console.log("AUTH DEBUG: registering auth listener");

  supabase.auth.onAuthStateChange((event, session) => {
    console.log("AUTH DEBUG: auth event", event);
    updateSession(session);
  });

  console.log("AUTH DEBUG: starting getSession");

  // Always finish the initial loading state,
  // even if getSession takes too long.
  void (async () => {
    try {
      const result = await Promise.race([
        supabase.auth.getSession(),
        new Promise<null>((resolve) => {
          setTimeout(() => resolve(null), 5000);
        }),
      ]);

      if (result === null) {
        console.warn("AUTH DEBUG: getSession timed out");

        if (isInitializing) {
          updateSession(null);
        }

        return;
      }

      if (result.error) {
        console.error("AUTH DEBUG: session error", result.error.message);
      }

      console.log("AUTH DEBUG: getSession completed");

      if (isInitializing) {
        updateSession(result.data.session ?? null);
      }
    } catch (error) {
      console.error("AUTH DEBUG: initialization failed", error);

      if (isInitializing) {
        updateSession(null);
      }
    }
  })();
}

// Hook used throughout the application
export function useAuth(): AuthState {
  const [, refresh] = useState(0);

  useEffect(() => {
    console.log("AUTH DEBUG: useAuth mounted");

    const subscriber = () => {
      console.log("AUTH DEBUG: component refreshing");

      refresh((value) => value + 1);
    };

    subscribers.add(subscriber);

    initializeAuth();

    return () => {
      console.log("AUTH DEBUG: useAuth unmounted");
      subscribers.delete(subscriber);
    };
  }, []);

  return {
    session: currentSession,
    user: currentSession?.user ?? null,
    loading: isInitializing,
  };
}

// Register a user
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
      console.error("Profile update failed:", profileError.message);
    }
  }

  if (data.session) {
    setAuth(data.session);
  }

  return { data, error: null };
}

// Sign in with email and password
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (!error && data.session) {
    setAuth(data.session);
  }

  return { data, error };
}

// Sign out
export async function signOut() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("Sign-out failed:", error.message);

    return { error };
  }

  setAuth(null);

  return { error: null };
}
