"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/lib/auth";
import { actionError, actionOk, type ActionResult } from "@/lib/errors";

export async function signInWithCredentials(
  email: string,
  password: string,
): Promise<ActionResult<void>> {
  try {
    await signIn("credentials", { email, password, redirect: false });
    return actionOk();
  } catch (error) {
    if (error instanceof AuthError) return actionError("auth.invalidCredentials");
    throw error;
  }
}

export async function signInWithGoogle(callbackUrl: string): Promise<void> {
  await signIn("google", { redirectTo: callbackUrl });
}

export async function signOutAction(redirectTo: string): Promise<void> {
  await signOut({ redirectTo });
}
