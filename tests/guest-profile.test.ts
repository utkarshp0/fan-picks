import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  createAnonymousProfile,
  normalizeHandle,
  updateAnonymousProfile,
} from "../src/lib/guest-profile";
import type { AnonymousProfile } from "../src/types/profile";

// --- normalizeHandle ---

describe("normalizeHandle", () => {
  test("lowercases input", () => {
    assert.equal(normalizeHandle("ALICE"), "alice");
  });

  test("trims whitespace", () => {
    assert.equal(normalizeHandle("  alice  "), "alice");
  });

  test("strips leading @", () => {
    assert.equal(normalizeHandle("@alice"), "alice");
  });

  test("replaces dots with dashes (unlike username, dots are not preserved)", () => {
    assert.equal(normalizeHandle("alice.bob"), "alice-bob");
  });

  test("replaces underscores with dashes", () => {
    assert.equal(normalizeHandle("alice_bob"), "alice-bob");
  });

  test("collapses consecutive dashes into one", () => {
    assert.equal(normalizeHandle("alice--bob"), "alice-bob");
  });

  test("strips leading and trailing dashes", () => {
    assert.equal(normalizeHandle("-alice-"), "alice");
  });

  test("truncates to 24 characters", () => {
    const result = normalizeHandle("a".repeat(30));
    assert.equal(result.length, 24);
  });

  test("allows alphanumeric characters and hyphens only", () => {
    assert.equal(normalizeHandle("user123-ok"), "user123-ok");
  });

  test("returns empty string for all-disallowed input", () => {
    assert.equal(normalizeHandle("!!!"), "");
  });
});

// --- createAnonymousProfile ---

describe("createAnonymousProfile", () => {
  test("creates a profile with handle in guest-XXXXX format", () => {
    const profile = createAnonymousProfile();
    assert.match(profile.handle, /^guest-[a-z0-9]{5}$/);
  });

  test("uses Fan as default displayName when none provided", () => {
    const profile = createAnonymousProfile();
    assert.equal(profile.displayName, "Fan");
  });

  test("uses provided displayName", () => {
    const profile = createAnonymousProfile("Alice");
    assert.equal(profile.displayName, "Alice");
  });

  test("falls back to Fan when displayName is empty string", () => {
    const profile = createAnonymousProfile("");
    assert.equal(profile.displayName, "Fan");
  });

  test("id is a UUID-formatted string", () => {
    const profile = createAnonymousProfile();
    assert.match(profile.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  test("avatarInitials are derived from displayName", () => {
    const profile = createAnonymousProfile("Alice Bob");
    assert.equal(profile.avatarInitials, "AB");
  });

  test("avatarInitials for single-word name", () => {
    const profile = createAnonymousProfile("Alice");
    assert.equal(profile.avatarInitials, "A");
  });

  test("has createdAt timestamp", () => {
    const profile = createAnonymousProfile();
    assert.ok(new Date(profile.createdAt).getTime() > 0);
  });

  test("has lastSeenAt timestamp", () => {
    const profile = createAnonymousProfile();
    assert.ok(new Date(profile.lastSeenAt).getTime() > 0);
  });

  test("two profiles have different ids", () => {
    const a = createAnonymousProfile();
    const b = createAnonymousProfile();
    assert.notEqual(a.id, b.id);
  });
});

// --- updateAnonymousProfile ---

describe("updateAnonymousProfile", () => {
  const base: AnonymousProfile = {
    id: "test-id-123",
    displayName: "Fan",
    handle: "guest-abcde",
    avatarInitials: "F",
    createdAt: "2026-01-01T00:00:00Z",
    lastSeenAt: "2026-01-01T00:00:00Z",
  };

  test("updates displayName when a non-empty value is provided", () => {
    const updated = updateAnonymousProfile(base, { displayName: "Alice", handle: "" });
    assert.equal(updated.displayName, "Alice");
  });

  test("keeps original displayName when update is empty", () => {
    const updated = updateAnonymousProfile(base, { displayName: "", handle: "" });
    assert.equal(updated.displayName, "Fan");
  });

  test("keeps original displayName when update is only whitespace", () => {
    const updated = updateAnonymousProfile(base, { displayName: "   ", handle: "" });
    assert.equal(updated.displayName, "Fan");
  });

  test("updates handle when a valid value is provided", () => {
    const updated = updateAnonymousProfile(base, { displayName: "", handle: "new-handle" });
    assert.equal(updated.handle, "new-handle");
  });

  test("normalizes handle on update (strips @, lowercases)", () => {
    const updated = updateAnonymousProfile(base, { displayName: "", handle: "@ALICE" });
    assert.equal(updated.handle, "alice");
  });

  test("keeps original handle when normalized update is empty", () => {
    const updated = updateAnonymousProfile(base, { displayName: "", handle: "!!!" });
    assert.equal(updated.handle, "guest-abcde");
  });

  test("recalculates avatarInitials from new displayName", () => {
    const updated = updateAnonymousProfile(base, { displayName: "Bob Charlie", handle: "" });
    assert.equal(updated.avatarInitials, "BC");
  });

  test("preserves id and createdAt unchanged", () => {
    const updated = updateAnonymousProfile(base, { displayName: "Alice", handle: "alice" });
    assert.equal(updated.id, "test-id-123");
    assert.equal(updated.createdAt, "2026-01-01T00:00:00Z");
  });

  test("updates lastSeenAt to a more recent time", () => {
    const updated = updateAnonymousProfile(base, { displayName: "Alice", handle: "alice" });
    assert.ok(new Date(updated.lastSeenAt) >= new Date(base.lastSeenAt));
  });
});
