import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  getInitials,
  normalizeDisplayName,
  normalizeUsername,
  usernameToAuthEmail,
} from "../src/lib/auth-identity";

describe("normalizeUsername", () => {
  test("lowercases input", () => {
    assert.equal(normalizeUsername("ALICE"), "alice");
  });

  test("trims leading and trailing whitespace", () => {
    assert.equal(normalizeUsername("  bob  "), "bob");
  });

  test("strips a leading @ sign", () => {
    assert.equal(normalizeUsername("@charlie"), "charlie");
  });

  test("replaces spaces with dashes", () => {
    assert.equal(normalizeUsername("alice bob"), "alice-bob");
  });

  test("replaces special characters with dashes", () => {
    assert.equal(normalizeUsername("user!name"), "user-name");
  });

  test("collapses consecutive dashes into one", () => {
    assert.equal(normalizeUsername("user--name"), "user-name");
  });

  test("strips leading and trailing dashes after replacements", () => {
    assert.equal(normalizeUsername("!alice!"), "alice");
  });

  test("preserves dots and underscores", () => {
    assert.equal(normalizeUsername("user.name_2"), "user.name_2");
  });

  test("allows digits", () => {
    assert.equal(normalizeUsername("user123"), "user123");
  });

  test("truncates to 32 characters", () => {
    const result = normalizeUsername("a".repeat(50));
    assert.equal(result.length, 32);
  });

  test("returns empty string when input is all disallowed characters", () => {
    assert.equal(normalizeUsername("!!!"), "");
  });

  test("handles empty string", () => {
    assert.equal(normalizeUsername(""), "");
  });
});

describe("usernameToAuthEmail", () => {
  test("appends @fanpicks.local domain", () => {
    assert.equal(usernameToAuthEmail("alice"), "alice@fanpicks.local");
  });

  test("normalizes username before building email", () => {
    assert.equal(usernameToAuthEmail("@ALICE"), "alice@fanpicks.local");
  });

  test("handles username with spaces", () => {
    assert.equal(usernameToAuthEmail("alice bob"), "alice-bob@fanpicks.local");
  });
});

describe("normalizeDisplayName", () => {
  test("returns the display name when provided", () => {
    assert.equal(normalizeDisplayName("Alice Smith", "alice"), "Alice Smith");
  });

  test("falls back to username when display name is empty string", () => {
    assert.equal(normalizeDisplayName("", "alice"), "alice");
  });

  test("falls back to username when display name is only whitespace", () => {
    assert.equal(normalizeDisplayName("   ", "alice"), "alice");
  });

  test("falls back to Fan when both display name and username are empty", () => {
    assert.equal(normalizeDisplayName("", ""), "Fan");
  });

  test("returns Fan when display name is undefined and username is empty", () => {
    assert.equal(normalizeDisplayName(undefined, ""), "Fan");
  });

  test("handles undefined display name and uses username", () => {
    assert.equal(normalizeDisplayName(undefined, "alice"), "alice");
  });

  test("truncates display name to 40 characters", () => {
    const long = "A".repeat(50);
    const result = normalizeDisplayName(long, "alice");
    assert.equal(result.length, 40);
  });

  test("preserves exactly 40 character display name", () => {
    const exactly40 = "B".repeat(40);
    assert.equal(normalizeDisplayName(exactly40, "alice"), exactly40);
  });
});

describe("getInitials", () => {
  test("returns first letter of each word (max 2)", () => {
    assert.equal(getInitials("Alice Bob"), "AB");
  });

  test("uppercases each initial", () => {
    assert.equal(getInitials("alice bob"), "AB");
  });

  test("returns single initial for one-word name", () => {
    assert.equal(getInitials("Alice"), "A");
  });

  test("takes only first two words when more are given", () => {
    assert.equal(getInitials("Alice Bob Charlie"), "AB");
  });

  test("returns empty string for empty input", () => {
    assert.equal(getInitials(""), "");
  });

  test("handles multiple spaces between words (filters empty parts)", () => {
    assert.equal(getInitials("Alice  Bob"), "AB");
  });
});
