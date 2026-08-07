/**
 * Helpers for getting the browser's password manager to remember staff
 * credentials — in practice Google Password Manager, since the school runs
 * Chromebooks.
 *
 * Important: no web API can write into a password manager silently. The
 * browser always asks the user. What these helpers do is make that prompt
 * *reliable*.
 *
 * Chrome decides whether to offer "Save password?" by watching for a form
 * submission followed by a navigation. This app's sign-in form submits over
 * XHR and then unmounts without navigating, which is precisely the case
 * Chrome's heuristic tends to miss — so teachers were never being offered the
 * save at all. Calling navigator.credentials.store() asks for the prompt
 * explicitly instead of hoping the heuristic fires.
 *
 * PasswordCredential exists in Chrome and Edge only. Safari and Firefox fall
 * back to their built-in heuristics, which is why every input in LoginForm
 * also carries a correct `autocomplete` attribute — that is what those
 * browsers key off.
 */

interface PasswordCredentialData {
  email: string;
  password: string;
  name?: string;
}

/** True when this browser supports the Credential Management password API. */
export function canStorePassword(): boolean {
  return (
    typeof window !== "undefined" &&
    "credentials" in navigator &&
    typeof (window as any).PasswordCredential === "function"
  );
}

/**
 * Ask the browser to save the credential the teacher just used.
 *
 * Never throws and never blocks the caller: a password manager that declines
 * or is unavailable must not turn a successful sign-in into a visible error.
 */
export async function offerToSavePassword({
  email,
  password,
  name,
}: PasswordCredentialData): Promise<void> {
  if (!canStorePassword()) return;
  try {
    const PasswordCredentialCtor = (window as any).PasswordCredential;
    const credential = new PasswordCredentialCtor({
      id: email,
      password,
      name: name || email,
    });
    await navigator.credentials.store(credential);
  } catch {
    // User dismissed the prompt, or the browser refused (e.g. non-secure
    // context). Either way there is nothing useful to tell the teacher.
  }
}

/**
 * Give the browser a moment to attach its "Save password?" prompt to the form
 * before React unmounts it. Without this the sign-in modal disappears in the
 * same tick and Chrome discards the prompt.
 */
export function waitForPasswordPrompt(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 400));
}

/**
 * Clear everything the service worker is holding on sign-out.
 *
 * The current worker never caches API responses, but staff devices may still
 * be running an older worker that did — and that cache would hold borrower
 * names from the previous teacher's session on a shared iPad.
 */
export function clearServiceWorkerCaches(): void {
  try {
    navigator.serviceWorker?.controller?.postMessage({ type: "CLEAR_CACHES" });
  } catch {
    // Not supported, or no worker in control. Nothing to clean up.
  }
}
