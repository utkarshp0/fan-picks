"use client";

import {
  getInitials,
  normalizeUsername,
  usernameToAuthEmail,
} from "@/lib/auth-identity";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { AnonymousProfile } from "@/types/profile";

type AccountInput = {
  username: string;
  password: string;
  displayName?: string;
};

type AccountResult =
  | { profile: AnonymousProfile; message: string; status: "created" | "signed_in" }
  | { profile: null; message: string; status: "error" };

type DbProfile = {
  id: string;
  display_name: string;
  handle: string;
  created_at: string;
  last_seen_at: string;
};

export async function loginWithPassword(input: AccountInput) {
  const username = normalizeUsername(input.username);
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: usernameToAuthEmail(username),
    password: input.password,
  });

  if (error || !data.user) {
    return {
      profile: null,
      message: getFriendlyLoginError(error?.message),
      status: "error" as const,
    };
  }

  const profile = await getOrCreateProfileFromAuthUser(data.user.id, username);

  return {
    profile,
    message: "Logged in.",
    status: "signed_in",
  };
}

export async function signUpWithPassword(input: AccountInput) {
  const signupResult = await submitSignupRequest(input);

  if (!signupResult.profile) {
    return signupResult;
  }

  const loginResult = await loginWithPassword(input);

  if (!loginResult.profile) {
    return signupResult;
  }

  return {
    ...loginResult,
    message: "Account created.",
    status: "created" as const,
  };
}

export async function logoutFromSupabaseAuth() {
  const supabase = createSupabaseBrowserClient();
  await supabase.auth.signOut();
}

export async function getCurrentSupabaseAuthProfile() {
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (!user) {
    return null;
  }

  const username =
    typeof user.user_metadata.username === "string"
      ? normalizeUsername(user.user_metadata.username)
      : normalizeUsername(user.email?.split("@")[0] ?? "");

  return getOrCreateProfileFromAuthUser(user.id, username);
}

async function submitSignupRequest(input: AccountInput): Promise<AccountResult> {
  const response = await fetch("/api/auth/signup", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  const result = (await response.json()) as AccountResult | { message?: string };

  if (!response.ok) {
    return {
      profile: null,
      message: result.message ?? "Signup failed.",
      status: "error",
    };
  }

  return result as AccountResult;
}

async function getOrCreateProfileFromAuthUser(
  userId: string,
  username: string,
): Promise<AnonymousProfile> {
  const supabase = createSupabaseBrowserClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, handle, created_at, last_seen_at")
    .eq("id", userId)
    .single();

  if (profile) {
    return mapDbProfile(profile as DbProfile);
  }

  const displayName = username || "Fan";
  const now = new Date().toISOString();
  const fallbackProfile: AnonymousProfile = {
    id: userId,
    displayName,
    handle: username,
    avatarInitials: getInitials(displayName),
    createdAt: now,
    lastSeenAt: now,
  };

  await supabase.from("profiles").insert({
    id: fallbackProfile.id,
    display_name: fallbackProfile.displayName,
    handle: fallbackProfile.handle,
    created_at: fallbackProfile.createdAt,
    last_seen_at: fallbackProfile.lastSeenAt,
  });

  return fallbackProfile;
}

function mapDbProfile(profile: DbProfile): AnonymousProfile {
  return {
    id: profile.id,
    displayName: profile.display_name,
    handle: profile.handle,
    avatarInitials: getInitials(profile.display_name),
    createdAt: profile.created_at,
    lastSeenAt: profile.last_seen_at,
  };
}

function getFriendlyLoginError(message: string | undefined) {
  if (!message) {
    return "Login failed.";
  }

  if (
    message.toLowerCase().includes("invalid") ||
    message.toLowerCase().includes("credentials")
  ) {
    return "Incorrect username or password.";
  }

  return message;
}
