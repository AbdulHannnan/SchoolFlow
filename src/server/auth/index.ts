import NextAuth from "next-auth";

import { authConfig } from "@/server/auth/config";

/**
 * The single Auth.js instance for the app.
 *   - `handlers`      -> mounted by the `/api/auth/[...nextauth]` route
 *   - `auth`          -> read the session in Server Components / route handlers
 *   - `signIn`/`signOut` -> server-side helpers (used in Server Actions)
 */
export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
