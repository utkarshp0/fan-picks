import assert from "node:assert/strict";
import test from "node:test";

import {
  getPostLogoutHref,
  postLogoutHref,
} from "../src/lib/auth-navigation.mjs";

test("logout redirects to the neutral auth entry route", () => {
  assert.equal(postLogoutHref, "/championships");
  assert.equal(getPostLogoutHref(), "/championships");
});
