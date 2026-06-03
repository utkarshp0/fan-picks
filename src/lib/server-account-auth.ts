import {
  getInitials,
  normalizeDisplayName,
  normalizeUsername,
  usernameToAuthEmail,
} from "@/lib/auth-identity";
import { createSupabaseServiceClient } from "@/lib/supabase-server";
import type { AnonymousProfile } from "@/types/profile";

type AccountInput = {
  username: string;
  password: string;
  displayName?: string;
};

type AccountResult =
  | { profile: AnonymousProfile; message: string; status: "created" | "signed_in" }
  | { profile: null; message: string; status: "error" };

export async function signUpAccount(input: AccountInput): Promise<AccountResult> {
  const username = normalizeUsername(input.username);
  const password = input.password.trim();
  const displayName = normalizeDisplayName(input.displayName, username);
  const validationMessage = validateCredentials(username, password);

  if (validationMessage) {
    return { profile: null, message: validationMessage, status: "error" };
  }

  const supabase = createSupabaseServiceClient();
  const { data: existingProfile, error: profileLookupError } = await supabase
    .from("profiles")
    .select("id")
    .eq("handle", username)
    .maybeSingle();

  if (profileLookupError) {
    return { profile: null, message: profileLookupError.message, status: "error" };
  }

  if (existingProfile) {
    return {
      profile: null,
      message: "That username is already reserved. Login or choose another username.",
      status: "error",
    };
  }

  const { data: authData, error: authError } =
    await supabase.auth.admin.createUser({
      email: usernameToAuthEmail(username),
      password,
      email_confirm: true,
      user_metadata: {
        display_name: displayName,
        username,
      },
    });

  if (authError || !authData.user) {
    return {
      profile: null,
      message: getFriendlyAuthError(authError?.message),
      status: "error",
    };
  }

  const now = new Date().toISOString();
  const profile: AnonymousProfile = {
    id: authData.user.id,
    displayName,
    handle: username,
    avatarInitials: getInitials(displayName),
    createdAt: authData.user.created_at ?? now,
    lastSeenAt: now,
  };
  const { error: profileError } = await supabase.from("profiles").insert({
    id: profile.id,
    display_name: profile.displayName,
    handle: profile.handle,
    created_at: profile.createdAt,
    last_seen_at: profile.lastSeenAt,
  });

  if (profileError) {
    await supabase.auth.admin.deleteUser(authData.user.id);

    return {
      profile: null,
      message: getFriendlyProfileError(profileError.message),
      status: "error",
    };
  }

  return {
    profile,
    message: "Account created.",
    status: "created",
  };
}

function validateCredentials(username: string, password: string) {
  if (!username) {
    return "Enter a username.";
  }

  if (password.length < 8) {
    return "Use at least 8 characters for the password.";
  }

  return "";
}

function getFriendlyAuthError(message: string | undefined) {
  if (!message) {
    return "Signup failed.";
  }

  if (message.toLowerCase().includes("already")) {
    return "That username already exists. Login instead.";
  }

  return message;
}

function getFriendlyProfileError(message: string) {
  if (message.includes("profiles_handle_key")) {
    return "That username is already reserved. Login or choose another username.";
  }

  return message;
}
