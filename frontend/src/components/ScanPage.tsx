import React, { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  Laptop,
  RotateCcw,
} from "lucide-react";
import {
  fetchResource,
  fetchBookings,
  returnAllForResource,
  returnBooking,
  loginWithEmail,
  AuthUser,
} from "../api";
import { Booking, Resource } from "../types";
import {
  clearServiceWorkerCaches,
  offerToSavePassword,
} from "../utils/browserCredentials";
import {
  describePasskeyError,
  loginWithPasskey,
  supportsPasskeys,
} from "../utils/passkeys";

interface Props {
  resourceId: string;
}

/** Compact school masthead shown at the top of the standalone scan page. */
const Masthead: React.FC = () => (
  <header className="bg-purple-700 sp-rule-gold px-4 py-3">
    <div className="max-w-md mx-auto">
      <div className="text-white text-base font-semibold leading-tight">
        Stonepark Intermediate School
      </div>
      <div className="text-purple-200 text-xs mt-0.5">
        Chromebook Manager
      </div>
    </div>
  </header>
);

export default function ScanPage({ resourceId }: Props) {
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => {
    try {
      const u = localStorage.getItem("auth_user");
      return u ? (JSON.parse(u) as AuthUser) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState<string>(
    () => localStorage.getItem("auth_token") || "",
  );
  const [resource, setResource] = useState<Resource | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [returning, setReturning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Login form state
  const [showLogin, setShowLogin] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [passkeyAvailable, setPasskeyAvailable] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);

  useEffect(() => {
    setPasskeyAvailable(supportsPasskeys());
  }, []);

  /**
   * Passkey sign-in matters most here: the teacher is at the cabinet holding
   * a phone, and typing an email and password one-handed is the worst part
   * of the whole return flow.
   */
  const handlePasskeyLogin = async () => {
    setPasskeyLoading(true);
    setLoginError(null);
    try {
      const { user, token: newToken } = await loginWithPasskey({
        email: email || undefined,
        rememberMe,
      });
      localStorage.setItem("auth_token", newToken);
      localStorage.setItem("auth_user", JSON.stringify(user));
      setAuthUser(user);
      setToken(newToken);
      setShowLogin(false);
    } catch (err: any) {
      const msg = describePasskeyError(err);
      if (msg) setLoginError(msg);
    } finally {
      setPasskeyLoading(false);
    }
  };

  // Check auth and load data
  useEffect(() => {
    const t = localStorage.getItem("auth_token");
    const u = localStorage.getItem("auth_user");
    if (t && u) {
      try {
        setAuthUser(JSON.parse(u) as AuthUser);
        setToken(t);
      } catch {
        setShowLogin(true);
      }
    } else {
      setShowLogin(true);
      setLoading(false);
    }
  }, []);

  /**
   * Send the teacher back to the sign-in form when their session has expired.
   * The axios interceptor already clears localStorage on a 401, so without
   * this the page would sit on an error with no way back in — the teacher is
   * standing at the cabinet with no route forward. Returns true if handled.
   */
  const handleExpiredSession = useCallback((err: any) => {
    if (err?.response?.status !== 401) return false;
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    setAuthUser(null);
    setToken("");
    setError(null);
    setSuccess(null);
    setLoginError("Your session has expired. Please sign in again.");
    setShowLogin(true);
    return true;
  }, []);

  // Load resource and bookings once authenticated
  useEffect(() => {
    if (!token || !resourceId) return;
    setLoading(true);
    Promise.all([
      fetchResource(resourceId),
      fetchBookings({ resourceId, status: "active" }),
    ])
      .then(([res, bks]) => {
        setResource(res);
        setBookings(bks);
      })
      .catch((err) => {
        if (!handleExpiredSession(err)) {
          setError("Failed to load resource data.");
        }
      })
      .finally(() => setLoading(false));
  }, [token, resourceId, handleExpiredSession]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);
    try {
      const { user, token: newToken } = await loginWithEmail(
        email,
        password,
        rememberMe,
      );
      localStorage.setItem("auth_token", newToken);
      localStorage.setItem("auth_user", JSON.stringify(user));
      await offerToSavePassword({ email, password, name: user.name });
      setAuthUser(user);
      setToken(newToken);
      setShowLogin(false);
    } catch (err: any) {
      setLoginError(
        err?.response?.data?.message ||
          "Login failed. Please check your credentials.",
      );
    } finally {
      setLoginLoading(false);
    }
  };

  const handleReturnAll = async () => {
    if (!resource || bookings.length === 0) return;
    setReturning(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await returnAllForResource(resource.id);
      setSuccess(`Returned ${result.returned} booking(s) successfully.`);
      setBookings([]);
    } catch (err: any) {
      if (!handleExpiredSession(err)) {
        setError(err?.response?.data?.message || "Failed to return bookings.");
      }
    } finally {
      setReturning(false);
    }
  };

  const handleReturnSingle = async (booking: Booking) => {
    setReturning(true);
    setError(null);
    setSuccess(null);
    try {
      await returnBooking(booking.id);
      setSuccess(`Returned booking for ${booking.borrower}.`);
      setBookings((prev) => prev.filter((b) => b.id !== booking.id));
    } catch (err: any) {
      if (!handleExpiredSession(err)) {
        setError(err?.response?.data?.message || "Failed to return booking.");
      }
    } finally {
      setReturning(false);
    }
  };

  // Login view
  if (showLogin) {
    return (
      <div className="min-h-screen bg-ink-50 font-sans text-ink-800">
        <Masthead />
        <div className="flex items-center justify-center px-5 py-10">
          <div className="sp-card w-full max-w-sm p-7">
            <div className="text-center mb-5">
              <KeyRound
                size={40}
                strokeWidth={2}
                aria-hidden="true"
                className="mx-auto mb-2 text-purple-700"
              />
              <h1 className="text-lg font-semibold text-purple-800">
                Staff Sign In
              </h1>
              <p className="text-sm text-ink-500 mt-1">
                Sign in once — stay signed in for 30 days
              </p>
            </div>

            {loginError && (
              <div className="sp-banner-alert text-sm mb-4">{loginError}</div>
            )}

            <form onSubmit={handleLogin}>
              <div className="mb-4">
                <label className="sp-label" htmlFor="scan-login-email">
                  Email
                </label>
                <input
                  id="scan-login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="sp-input"
                />
              </div>
              <div className="mb-4">
                <label className="sp-label" htmlFor="scan-login-password">
                  Password
                </label>
                <input
                  id="scan-login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="sp-input"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-ink-600 mb-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="accent-purple-700"
                />
                Keep me signed in for 30 days
              </label>

              <button
                type="submit"
                disabled={loginLoading}
                className="sp-btn-primary w-full"
              >
                {loginLoading ? "Signing in…" : "Sign In"}
              </button>
            </form>

            {passkeyAvailable && (
              <>
                <div className="flex items-center gap-3 my-4">
                  <span className="flex-1 h-px bg-ink-200" aria-hidden="true" />
                  <span className="text-xs text-ink-400">or</span>
                  <span className="flex-1 h-px bg-ink-200" aria-hidden="true" />
                </div>
                <button
                  type="button"
                  onClick={handlePasskeyLogin}
                  disabled={passkeyLoading || loginLoading}
                  className="sp-btn-secondary w-full inline-flex items-center justify-center gap-2"
                >
                  <KeyRound size={20} strokeWidth={2} aria-hidden="true" />
                  {passkeyLoading
                    ? "Waiting for your device…"
                    : "Sign In with a Passkey"}
                </button>
              </>
            )}

            <p className="text-center text-xs text-ink-400 mt-4">
              Sign in with your staff email and password.
              <br />
              You'll stay signed in on this device for 30 days.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Main scan page
  return (
    <div className="min-h-screen bg-ink-50 font-sans text-ink-800">
      <Masthead />
      <main className="max-w-md mx-auto p-4">
        {/* Page heading */}
        <div className="mb-4">
          <h1 className="sp-rule-gold inline-block pb-1 text-lg font-semibold text-purple-800">
            Return Chromebooks
          </h1>
          {authUser && (
            <div className="text-xs text-ink-500 mt-1.5">
              Signed in as {authUser.name || authUser.email}
            </div>
          )}
        </div>

        {/* Error / Success */}
        {error && (
          <div className="sp-banner-alert text-sm mb-3 flex items-start gap-2">
            <AlertTriangle
              size={16}
              strokeWidth={2}
              aria-hidden="true"
              className="flex-shrink-0 mt-0.5"
            />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="sp-banner-success text-sm mb-3 flex items-start gap-2">
            <CheckCircle2
              size={16}
              strokeWidth={2}
              aria-hidden="true"
              className="flex-shrink-0 mt-0.5"
            />
            <span>{success}</span>
          </div>
        )}

        {loading ? (
          <div className="text-center py-10 text-ink-500">Loading…</div>
        ) : resource ? (
          <>
            {/* Resource info */}
            <div className="sp-card p-4 mb-3">
              <div className="flex items-start gap-2">
                <Laptop
                  size={16}
                  strokeWidth={2}
                  aria-hidden="true"
                  className="flex-shrink-0 mt-0.5 text-purple-700"
                />
                <div>
                  <div className="text-sm font-semibold text-purple-800">
                    {resource.name}
                  </div>
                  <div className="text-xs text-ink-500 mt-0.5">
                    {resource.classRoom}
                    {resource.type === "cabinet" && (
                      <>
                        {" · "}
                        <span className="font-mono">
                          {resource.totalQuantity}
                        </span>{" "}
                        Chromebooks
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Active bookings */}
            {bookings.length === 0 ? (
              <div className="sp-card p-6 text-center">
                <CheckCircle2
                  size={40}
                  strokeWidth={2}
                  aria-hidden="true"
                  className="mx-auto mb-2 text-status-success-edge"
                />
                <div className="text-sm text-ink-500">
                  No active bookings for this resource.
                </div>
              </div>
            ) : (
              <>
                <div className="text-xs font-semibold uppercase tracking-wide text-ink-500 mb-2">
                  Active Bookings (
                  <span className="font-mono">{bookings.length}</span>)
                </div>

                {bookings.map((b) => (
                  <div
                    key={b.id}
                    className="sp-card p-3 mb-2 flex items-center justify-between gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-ink-800">
                        {b.borrower}
                      </div>
                      <div className="text-xs text-ink-500 mt-0.5">
                        {b.borrowerClass}
                        {b.quantity > 1 && (
                          <>
                            {" · Qty: "}
                            <span className="font-mono">{b.quantity}</span>
                          </>
                        )}
                      </div>
                      {b.isOverdue && (
                        <span className="sp-pill-alert inline-flex items-center gap-1 mt-1">
                          <AlertTriangle
                            size={12}
                            strokeWidth={2}
                            aria-hidden="true"
                          />
                          Overdue
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleReturnSingle(b)}
                      disabled={returning}
                      className="sp-btn-secondary sp-btn-sm inline-flex items-center gap-1.5 whitespace-nowrap flex-shrink-0"
                    >
                      <RotateCcw size={14} strokeWidth={2} aria-hidden="true" />
                      Return
                    </button>
                  </div>
                ))}

                {/* Return All button */}
                <button
                  onClick={handleReturnAll}
                  disabled={returning}
                  className="sp-btn-primary w-full mt-2 inline-flex items-center justify-center gap-2"
                >
                  <RotateCcw size={20} strokeWidth={2} aria-hidden="true" />
                  {returning ? "Processing…" : "Return All"}
                </button>
              </>
            )}

            {/* Sign out */}
            <button
              onClick={() => {
                localStorage.removeItem("auth_token");
                localStorage.removeItem("auth_user");
                clearServiceWorkerCaches();
                setAuthUser(null);
                setToken("");
                setShowLogin(true);
              }}
              className="sp-btn-ghost w-full mt-4 text-sm"
            >
              Sign Out
            </button>
          </>
        ) : (
          <div className="text-center py-10 text-ink-500">
            Resource not found.
          </div>
        )}
      </main>
    </div>
  );
}
