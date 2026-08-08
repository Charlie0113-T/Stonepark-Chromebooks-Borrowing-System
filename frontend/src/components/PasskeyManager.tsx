import React, { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  Plus,
  Trash2,
} from "lucide-react";
import { deletePasskey, fetchPasskeys, PasskeySummary } from "../api";
import {
  describePasskeyError,
  registerPasskey,
  supportsPasskeys,
} from "../utils/passkeys";

/**
 * Lets a signed-in teacher add and remove passkeys.
 *
 * Deliberately framed as an optional convenience rather than a security
 * setting — the audience is staff who are wary of new technology, so the
 * copy leads with what they get ("no password to type") and states plainly
 * that their password still works.
 */
export default function PasskeyManager() {
  const [passkeys, setPasskeys] = useState<PasskeySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [unsupported, setUnsupported] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPasskeys(await fetchPasskeys());
    } catch (err: any) {
      if (err?.response?.status === 501) {
        setUnsupported(true);
      } else {
        setError("Could not load your passkeys. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!supportsPasskeys()) {
      setUnsupported(true);
      setLoading(false);
      return;
    }
    load();
  }, [load]);

  const handleAdd = async () => {
    setAdding(true);
    setError(null);
    setSuccess(null);
    try {
      await registerPasskey();
      setSuccess("Passkey added. Next time you can sign in without typing.");
      await load();
    } catch (err: any) {
      const msg = describePasskeyError(err);
      if (msg) setError(msg);
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (credentialId: string) => {
    setError(null);
    setSuccess(null);
    try {
      await deletePasskey(credentialId);
      await load();
    } catch {
      setError("Could not remove that passkey. Please try again.");
    }
  };

  const fmt = (iso: string | null) => {
    if (!iso) return "never";
    try {
      return new Date(iso).toLocaleDateString();
    } catch {
      return "unknown";
    }
  };

  if (unsupported) {
    return (
      <p className="text-sm text-ink-800">
        Passkeys are not available on this device or browser. You can keep
        signing in with your email and password as normal.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-800">
        A passkey lets you sign in with your fingerprint, face, or screen lock
        instead of typing a password. Your password still works — this is just
        a shortcut.
      </p>

      {error && (
        <div className="sp-banner-alert flex items-start gap-2">
          <AlertTriangle
            size={16}
            strokeWidth={2}
            aria-hidden="true"
            className="mt-0.5 flex-shrink-0"
          />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="sp-banner-success flex items-start gap-2">
          <CheckCircle2
            size={16}
            strokeWidth={2}
            aria-hidden="true"
            className="mt-0.5 flex-shrink-0"
          />
          <span>{success}</span>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-ink-500">Loading…</p>
      ) : passkeys.length === 0 ? (
        <p className="text-sm text-ink-500">
          You have not set up a passkey yet.
        </p>
      ) : (
        <div className="divide-y divide-ink-200 border border-ink-200 rounded-md">
          {passkeys.map((pk) => (
            <div
              key={pk.credentialId}
              className="flex items-center justify-between px-3 py-2 gap-2"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-sm text-ink-800">
                  <KeyRound
                    size={16}
                    strokeWidth={2}
                    aria-hidden="true"
                    className="flex-shrink-0 text-purple-700"
                  />
                  {pk.deviceLabel}
                </div>
                <div className="text-xs text-ink-500 font-mono">
                  Added {fmt(pk.createdAt)} · Last used {fmt(pk.lastUsedAt)}
                </div>
              </div>
              <button
                onClick={() => handleRemove(pk.credentialId)}
                className="sp-btn-danger sp-btn-sm flex-shrink-0"
              >
                <Trash2 size={14} strokeWidth={2} aria-hidden="true" />
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={handleAdd}
        disabled={adding}
        className="sp-btn-primary w-full"
      >
        {adding ? (
          "Waiting for your device…"
        ) : (
          <>
            <Plus size={16} strokeWidth={2} aria-hidden="true" />
            Add a Passkey on This Device
          </>
        )}
      </button>

      <p className="text-xs text-ink-400">
        Add one on each device you use. A passkey created on a shared device
        stays on that device, so use your own phone or laptop.
      </p>
    </div>
  );
}
