import type { Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

/**
 * Augment Auth.js types so our extra claims (`role`, `schoolId`, and the user
 * `id`) are typed everywhere `session.user` or the JWT is read.
 */
declare module "next-auth" {
  interface User {
    role: Role;
    schoolId: string | null;
  }

  interface Session {
    user: {
      id: string;
      role: Role;
      schoolId: string | null;
    } & DefaultSession["user"];
  }
}

// The JWT interface is declared in `@auth/core/jwt`; `next-auth/jwt` only
// re-exports it, so the augmentation must target the declaring module to merge.
declare module "@auth/core/jwt" {
  interface JWT {
    role: Role;
    schoolId: string | null;
  }
}
