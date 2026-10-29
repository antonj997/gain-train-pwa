import test from "node:test";
import assert from "node:assert/strict";
import {
  PHONE_ACCOUNT,
  accountAfterAuthChange,
  needsSignInAgain,
} from "../src/lib/auth-account";

test("an unexpected sign-out keeps the account's log instead of the phone log", () => {
  const account = crypto.randomUUID();
  // A failed refresh or a sign-out on another device reports no user.
  assert.equal(accountAfterAuthChange(account, null), account);
  assert.equal(needsSignInAgain(account, null), true);
});

test("signing in shows that user's log", () => {
  const id = crypto.randomUUID();
  assert.equal(accountAfterAuthChange(PHONE_ACCOUNT, { id }), id);
  assert.equal(accountAfterAuthChange(crypto.randomUUID(), { id }), id);
  assert.equal(needsSignInAgain(id, { id }), false);
});

test("the phone log never asks to sign in again", () => {
  assert.equal(accountAfterAuthChange(PHONE_ACCOUNT, null), PHONE_ACCOUNT);
  assert.equal(needsSignInAgain(PHONE_ACCOUNT, null), false);
});
