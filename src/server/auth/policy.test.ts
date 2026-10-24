import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { hasSchool, isRoleAllowed, isSuperAdmin, type PolicyUser } from "./policy.ts";

/**
 * Unit tests for the role-authorization kernel, exercised from the HEAD role's
 * point of view - this is the logic every HEAD-gated page, action and route
 * ultimately depends on (`requireRole`, `requireSchool`, `hasRole` all delegate
 * here). Runs with the built-in runner: `npm test`.
 */

/** A tenant HEAD - the school administrator. */
const head: PolicyUser = { role: "HEAD", schoolId: "school_1" };
/** The other roles, for "must be rejected" coverage. */
const teacher: PolicyUser = { role: "TEACHER", schoolId: "school_1" };
const parent: PolicyUser = { role: "PARENT", schoolId: "school_1" };
const student: PolicyUser = { role: "STUDENT", schoolId: "school_1" };
/** Platform operator - no tenant. */
const superAdmin: PolicyUser = { role: "SUPER_ADMIN", schoolId: null };

describe("isRoleAllowed - HEAD role", () => {
  it("admits a HEAD to a HEAD-only gate", () => {
    assert.equal(isRoleAllowed(head, ["HEAD"]), true);
  });

  it("admits a HEAD to a shared HEAD/TEACHER gate (order-independent)", () => {
    assert.equal(isRoleAllowed(head, ["TEACHER", "HEAD"]), true);
    assert.equal(isRoleAllowed(head, ["HEAD", "TEACHER"]), true);
  });

  it("rejects every non-HEAD role at a HEAD-only gate", () => {
    for (const u of [teacher, parent, student, superAdmin]) {
      assert.equal(isRoleAllowed(u, ["HEAD"]), false, `${u.role} must not pass a HEAD-only gate`);
    }
  });

  it("does NOT treat SUPER_ADMIN as a HEAD (no implicit privilege inheritance)", () => {
    assert.equal(isRoleAllowed(superAdmin, ["HEAD"]), false);
  });

  it("rejects a null / undefined user (signed out)", () => {
    assert.equal(isRoleAllowed(null, ["HEAD"]), false);
    assert.equal(isRoleAllowed(undefined, ["HEAD"]), false);
  });

  it("rejects when the allowed set is empty", () => {
    assert.equal(isRoleAllowed(head, []), false);
  });

  it("covers the full role matrix for a HEAD-only gate", () => {
    const expected: Record<PolicyUser["role"], boolean> = {
      HEAD: true,
      TEACHER: false,
      PARENT: false,
      STUDENT: false,
      SUPER_ADMIN: false,
    };
    for (const u of [head, teacher, parent, student, superAdmin]) {
      assert.equal(isRoleAllowed(u, ["HEAD"]), expected[u.role]);
    }
  });
});

describe("isSuperAdmin", () => {
  it("is false for a HEAD (a HEAD is never the platform operator)", () => {
    assert.equal(isSuperAdmin(head), false);
  });

  it("is true only for SUPER_ADMIN", () => {
    assert.equal(isSuperAdmin(superAdmin), true);
    for (const u of [head, teacher, parent, student, null]) {
      assert.equal(isSuperAdmin(u), false);
    }
  });
});

describe("hasSchool - tenant scoping for the HEAD role", () => {
  it("is true for a HEAD (HEADs are always bound to one school)", () => {
    assert.equal(hasSchool(head), true);
  });

  it("is false for SUPER_ADMIN (operates above any single tenant)", () => {
    assert.equal(hasSchool(superAdmin), false);
  });

  it("is false for a signed-out user", () => {
    assert.equal(hasSchool(null), false);
    assert.equal(hasSchool(undefined), false);
  });

  it("narrows schoolId to a non-null string on the true branch", () => {
    const u: PolicyUser = head;
    if (hasSchool(u)) {
      // Type-level: `u.schoolId` is `string` here, not `string | null`.
      const id: string = u.schoolId;
      assert.equal(id, "school_1");
    } else {
      assert.fail("HEAD should have a school");
    }
  });

  it("rejects an empty-string schoolId (a malformed row is not a tenant)", () => {
    // We must never fall through to `withTenant("")`, so empty is denied.
    assert.equal(hasSchool({ role: "HEAD", schoolId: "" }), false);
  });
});
