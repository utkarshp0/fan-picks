"use client";

import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import {
  getCurrentSupabaseAuthProfile,
  loginWithPassword,
  logoutFromSupabaseAuth,
  signUpWithPassword,
} from "@/lib/account-auth";
import { updateAnonymousProfile } from "@/lib/guest-profile";
import { syncProfileToSupabase } from "@/lib/supabase-championships";
import type { AnonymousProfile, ProfileDraft } from "@/types/profile";

const storageKey = "fan-picks:user";
const profileChangeEvent = "fan-picks:profile-change";
let cachedProfile: AnonymousProfile | null = null;

type SignInInput = {
  username: string;
  password: string;
  displayName?: string;
};

type SignInResult = {
  ok: boolean;
  message: string;
};

type GuestSessionContextValue = {
  isReady: boolean;
  profile: AnonymousProfile | null;
  logout: () => void;
  resetProfile: () => void;
  signIn: (input: SignInInput) => Promise<SignInResult>;
  signUp: (input: SignInInput) => Promise<SignInResult>;
  updateProfile: (draft: ProfileDraft) => void;
};

const GuestSessionContext = createContext<GuestSessionContextValue | null>(null);

export function GuestSessionProvider({ children }: { children: ReactNode }) {
  const profile = useSyncExternalStore(
    subscribeToProfile,
    getProfileSnapshot,
    getServerProfileSnapshot,
  );

  const value = useMemo<GuestSessionContextValue>(
    () => ({
      isReady: true,
      profile,
      logout: () => {
        clearProfile();
        void logoutFromSupabaseAuth();
      },
      resetProfile: clearProfile,
      signIn: async (input) => {
        const result = await loginWithPassword(input);

        if (!result.profile) {
          return { ok: false, message: result.message };
        }

        writeProfile(result.profile);
        void syncProfileToSupabase(result.profile);
        return { ok: true, message: result.message };
      },
      signUp: async (input) => {
        const result = await signUpWithPassword(input);

        if (!result.profile) {
          return { ok: false, message: result.message };
        }

        writeProfile(result.profile);
        void syncProfileToSupabase(result.profile);
        return { ok: true, message: result.message };
      },
      updateProfile: (draft) => {
        const currentProfile = getProfileSnapshot();

        if (!currentProfile) {
          return;
        }

        const nextProfile = updateAnonymousProfile(currentProfile, draft);
        writeProfile(nextProfile);
      },
    }),
    [profile],
  );

  return (
    <GuestSessionContext.Provider value={value}>
      {children}
    </GuestSessionContext.Provider>
  );
}

export function useGuestSession() {
  const context = useContext(GuestSessionContext);

  if (!context) {
    throw new Error("useGuestSession must be used inside GuestSessionProvider.");
  }

  return context;
}

function subscribeToProfile(onStoreChange: () => void) {
  const handleStorageChange = () => {
    cachedProfile = null;
    onStoreChange();
  };

  window.addEventListener(profileChangeEvent, onStoreChange);
  window.addEventListener("storage", handleStorageChange);
  void hydrateProfileFromSupabaseAuth();

  return () => {
    window.removeEventListener(profileChangeEvent, onStoreChange);
    window.removeEventListener("storage", handleStorageChange);
  };
}

function getProfileSnapshot() {
  if (cachedProfile) {
    return cachedProfile;
  }

  const storedProfile = readStoredProfile();
  cachedProfile = storedProfile;
  return storedProfile;
}

function getServerProfileSnapshot() {
  return null;
}

function readStoredProfile(): AnonymousProfile | null {
  try {
    const rawProfile = localStorage.getItem(storageKey);

    if (!rawProfile) {
      return null;
    }

    cachedProfile = JSON.parse(rawProfile) as AnonymousProfile;
    return cachedProfile;
  } catch {
    return null;
  }
}

function writeProfile(profile: AnonymousProfile) {
  cachedProfile = profile;
  localStorage.setItem(storageKey, JSON.stringify(profile));
  window.dispatchEvent(new Event(profileChangeEvent));
}

function clearProfile() {
  cachedProfile = null;
  localStorage.removeItem(storageKey);
  window.dispatchEvent(new Event(profileChangeEvent));
}

async function hydrateProfileFromSupabaseAuth() {
  const profile = await getCurrentSupabaseAuthProfile();

  if (profile) {
    writeProfile(profile);
  }
}
