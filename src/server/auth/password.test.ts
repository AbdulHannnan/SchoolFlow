import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { hashPassword, verifyPassword } from "./password.ts";

/**
 * Unit tests for credential hashing/verification - the gate a HEAD passes
 * through at sign-in (`authorize` in auth/config.ts calls `verifyPassword`).
 * These confirm the scheme round-trips and fails closed on bad input.
 */

describe("hashPassword", () => {
  it("produces a self-describing scrypt:<salt>:<hash> string", async () => {
    const stored = await hashPassword("correct horse battery staple");
    const parts = stored.split(":");
    assert.equal(parts.length, 3);
    assert.equal(parts[0], "scrypt");
    assert.ok(parts[1].length > 0, "salt present");
    assert.ok(parts[2].length > 0, "hash present");
  });

  it("uses a fresh random salt each time (same password -> different hash)", async () => {
    const a = await hashPassword("same-password");
    const b = await hashPassword("same-password");
    assert.notEqual(a, b);
  });
});

describe("verifyPassword", () => {
  it("accepts the correct password", async () => {
    const stored = await hashPassword("s3cret-head-pw");
    assert.equal(await verifyPassword("s3cret-head-pw", stored), true);
  });

  it("rejects a wrong password", async () => {
    const stored = await hashPassword("s3cret-head-pw");
    assert.equal(await verifyPassword("wrong", stored), false);
  });

  it("is case- and whitespace-sensitive", async () => {
    const stored = await hashPassword("HeadPass");
    assert.equal(await verifyPassword("headpass", stored), false);
    assert.equal(await verifyPassword("HeadPass ", stored), false);
  });

  it("fails closed on a malformed stored value (no scheme/salt/hash)", async () => {
    assert.equal(await verifyPassword("x", "garbage"), false);
    assert.equal(await verifyPassword("x", ""), false);
    assert.equal(await verifyPassword("x", "scrypt:onlysalt"), false);
  });

  it("rejects an unknown scheme prefix even if the rest looks valid", async () => {
    const stored = await hashPassword("pw");
    const forged = stored.replace(/^scrypt:/, "bcrypt:");
    assert.equal(await verifyPassword("pw", forged), false);
  });

  it("rejects when the stored hash length differs (no timingSafeEqual throw)", async () => {
    const stored = await hashPassword("pw");
    const [scheme, salt] = stored.split(":");
    // A short hash would make timingSafeEqual throw; verifyPassword must guard it.
    const truncated = `${scheme}:${salt}:abcd`;
    assert.equal(await verifyPassword("pw", truncated), false);
  });

  it("round-trips unicode and long passwords", async () => {
    const pw = "pä$$wörd-🔐-" + "x".repeat(200);
    const stored = await hashPassword(pw);
    assert.equal(await verifyPassword(pw, stored), true);
    assert.equal(await verifyPassword(pw + "!", stored), false);
  });
});
