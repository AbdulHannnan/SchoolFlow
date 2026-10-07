import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/server/auth";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in - School Management",
};

// This route gates on the session (redirects if already signed in), so it
// blocks on the server rather than prerendering into the static shell.
export const instant = false;

export default async function LoginPage() {
  // Already signed in? Skip the form.
  const session = await auth();
  if (session?.user) {
    redirect("/");
  }

  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
