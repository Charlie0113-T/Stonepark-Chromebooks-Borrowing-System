/**
 * Thin wrapper over @simplewebauthn/browser.
 *
 * Its job is mostly translation: the raw WebAuthn errors are written for
 * developers ("NotAllowedError", "The operation either timed out or was not
 * allowed") and would be alarming and useless to a teacher standing at a
 * cabinet. Everything here resolves to plain language and a next step.
 */

import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
  browserSupportsWebAuthnAutofill,
} from "@simplewebauthn/browser";
import {
  fetchPasskeyLoginOptions,
  fetchPasskeyRegistrationOptions,
  verifyPasskeyLogin,
  verifyPasskeyRegistration,
  AuthUser,
} from "../api";

/** Whether this browser can do passkeys at all. */
export function supportsPasskeys(): boolean {
  try {
    return browserSupportsWebAuthn();
  } catch {
    return false;
  }
}

/** Whether passkeys can appear in the email field's autofill dropdown. */
export async function supportsPasskeyAutofill(): Promise<boolean> {
  try {
    return await browserSupportsWebAuthnAutofill();
  } catch {
    return false;
  }
}

/** True when the teacher simply dismissed the OS prompt — not a real failure. */
export function isUserCancellation(err: any): boolean {
  return err?.name === "NotAllowedError" || err?.name === "AbortError";
}

/**
 * Turn any passkey failure into something worth showing a teacher.
 * Returns null when the teacher just cancelled, so callers can stay silent.
 */
export function describePasskeyError(err: any): string | null {
  if (isUserCancellation(err)) return null;

  const serverMessage = err?.response?.data?.message;
  if (serverMessage) return serverMessage;

  if (err?.name === "InvalidStateError") {
    return "This device already has a passkey for your account.";
  }
  if (err?.name === "SecurityError") {
    return "Passkeys need a secure (https) connection. Please tell your administrator.";
  }
  if (err?.response?.status === 501) {
    return "Passkeys are not set up on this server yet. Please sign in with your password.";
  }
  return "Passkey sign-in did not work. Please use your email and password instead.";
}

/** Add a passkey to the signed-in teacher's account. */
export async function registerPasskey(): Promise<void> {
  const { options, challengeId } = await fetchPasskeyRegistrationOptions();
  const response = await startRegistration({ optionsJSON: options });
  await verifyPasskeyRegistration(response, challengeId);
}

/**
 * Sign in with a passkey.
 *
 * `useAutofill` drives the conditional-UI flow: the call sits waiting in the
 * background and resolves only when the teacher picks a passkey from the
 * email field's dropdown. It must not be treated as a click-triggered action.
 */
export async function loginWithPasskey({
  email,
  rememberMe,
  useAutofill = false,
}: {
  email?: string;
  rememberMe?: boolean;
  useAutofill?: boolean;
} = {}): Promise<{ user: AuthUser; token: string }> {
  const { options, challengeId } = await fetchPasskeyLoginOptions(
    useAutofill ? undefined : email,
  );
  const response = await startAuthentication({
    optionsJSON: options,
    useBrowserAutofill: useAutofill,
  });
  return verifyPasskeyLogin(response, challengeId, rememberMe);
}
