"use client";

import { FormEvent, useState } from "react";
import { LogIn, Trophy, UserPlus } from "lucide-react";

import { useGuestSession } from "@/components/auth/guest-session-provider";
import { Button } from "@/components/ui/button";

export function LoginScreen({
  inviteNotice,
}: {
  inviteNotice?: string;
}) {
  const { signIn, signUp } = useGuestSession();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const payload = {
      username: String(formData.get("username") ?? ""),
      password: String(formData.get("password") ?? ""),
      displayName: String(formData.get("displayName") ?? ""),
    };
    const result = mode === "login" ? await signIn(payload) : await signUp(payload);

    setIsSubmitting(false);

    if (!result.ok) {
      setMessage(result.message);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 text-foreground">
      <section className="w-full max-w-md rounded-lg border border-border bg-surface p-5">
        <div className="grid h-12 w-12 place-items-center rounded-md bg-accent text-accent-foreground">
          <Trophy aria-hidden className="h-6 w-6" />
        </div>
        <h1 className="mt-5 text-3xl font-semibold">
          {mode === "login" ? "Login" : "Sign up"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          {mode === "login"
            ? "Login with your username and password to get back to your pools."
            : "Create a simple Fan Picks account with a username and password."}
        </p>
        {inviteNotice ? (
          <p className="mt-4 rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-sm leading-6 text-accent">
            {inviteNotice}
          </p>
        ) : null}
        <div className="mt-5 grid grid-cols-2 rounded-md border border-border bg-background p-1">
          <button
            className={`min-h-10 rounded px-3 text-sm font-semibold transition-colors ${
              mode === "login"
                ? "bg-surface-raised text-foreground"
                : "text-muted hover:text-foreground"
            }`}
            onClick={() => {
              setMode("login");
              setMessage("");
            }}
            type="button"
          >
            Login
          </button>
          <button
            className={`min-h-10 rounded px-3 text-sm font-semibold transition-colors ${
              mode === "signup"
                ? "bg-surface-raised text-foreground"
                : "text-muted hover:text-foreground"
            }`}
            onClick={() => {
              setMode("signup");
              setMessage("");
            }}
            type="button"
          >
            Sign up
          </button>
        </div>
        <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
          <label className="grid gap-2">
            <span className="text-sm font-medium">Username</span>
            <input
              autoComplete="username"
              autoFocus
              className="min-h-11 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent"
              maxLength={32}
              name="username"
              placeholder="utkarsh"
              required
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-medium">Password</span>
            <input
              autoComplete="current-password"
              className="min-h-11 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent"
              minLength={8}
              name="password"
              placeholder="At least 8 characters"
              required
              type="password"
            />
          </label>
          {mode === "signup" ? (
            <label className="grid gap-2">
              <span className="text-sm font-medium">Display name</span>
              <input
                autoComplete="name"
                className="min-h-11 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent"
                maxLength={40}
                name="displayName"
                placeholder="Utkarsh"
              />
            </label>
          ) : null}
          <Button
            disabled={isSubmitting}
            loading={isSubmitting}
            loadingLabel={
              mode === "login" ? "Checking account" : "Creating account"
            }
            type="submit"
          >
            {mode === "login" ? (
              <LogIn aria-hidden className="h-4 w-4" />
            ) : (
              <UserPlus aria-hidden className="h-4 w-4" />
            )}
            {isSubmitting
              ? mode === "login"
                ? "Logging in"
                : "Creating account"
              : mode === "login"
                ? "Login"
                : "Create account"}
          </Button>
          {message ? (
            <p className="rounded-md border border-warning/60 bg-warning/10 px-3 py-2 text-sm text-warning">
              {message}
            </p>
          ) : null}
        </form>
      </section>
    </main>
  );
}
