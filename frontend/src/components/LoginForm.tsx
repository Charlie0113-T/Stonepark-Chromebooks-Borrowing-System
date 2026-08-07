import React, { useCallback, useEffect, useState } from "react";
import {
  applyForWhitelist,
  AuthUser,
  loginWithEmail,
  verifySecurityAnswers,
  resetPassword,
  signupWithEmail,
} from "../api";
import {
  offerToSavePassword,
  waitForPasswordPrompt,
} from "../utils/browserCredentials";
import {
  describePasskeyError,
  isUserCancellation,
  loginWithPasskey,
  supportsPasskeyAutofill,
  supportsPasskeys,
} from "../utils/passkeys";

interface Props {
  onLogin: (token: string, user: AuthUser) => void;
}

export default function LoginForm({ onLogin }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [mode, setMode] = useState<
    "login" | "signup" | "apply" | "forgot" | "reset"
  >("login");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirm, setSignupConfirm] = useState("");
  // Security question answers for signup
  const [signupFood, setSignupFood] = useState("");
  const [signupBook, setSignupBook] = useState("");
  const [signupColor, setSignupColor] = useState("");
  // Security question answers for forgot password
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotFood, setForgotFood] = useState("");
  const [forgotBook, setForgotBook] = useState("");
  const [forgotColor, setForgotColor] = useState("");
  const [applyEmail, setApplyEmail] = useState("");
  const [applyMessage, setApplyMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(true);
  const [passkeyAvailable, setPasskeyAvailable] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);

  const finishPasskeyLogin = useCallback(
    (token: string, user: AuthUser) => {
      localStorage.setItem("auth_token", token);
      localStorage.setItem("auth_user", JSON.stringify(user));
      onLogin(token, user);
    },
    [onLogin],
  );

  useEffect(() => {
    setPasskeyAvailable(supportsPasskeys());
  }, []);

  /**
   * Conditional UI: park a passkey request in the background so any passkey
   * this browser holds shows up in the email field's autofill dropdown. It
   * resolves only if the teacher picks one — otherwise it stays pending for
   * the life of the form, which is expected and not an error.
   */
  useEffect(() => {
    if (mode !== "login") return;
    let cancelled = false;

    (async () => {
      if (!supportsPasskeys() || !(await supportsPasskeyAutofill())) return;
      try {
        const { user, token } = await loginWithPasskey({
          rememberMe: true,
          useAutofill: true,
        });
        if (!cancelled) finishPasskeyLogin(token, user);
      } catch (err) {
        // A pending autofill request is aborted whenever the teacher submits
        // the password form or leaves — never surface that as a failure.
        if (!cancelled && !isUserCancellation(err)) {
          const msg = describePasskeyError(err);
          if (msg) setError(msg);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mode, finishPasskeyLogin]);

  const handlePasskeyLogin = async () => {
    setPasskeyLoading(true);
    setError(null);
    setMessage(null);
    try {
      const { user, token } = await loginWithPasskey({
        email: email || undefined,
        rememberMe,
      });
      finishPasskeyLogin(token, user);
    } catch (err: any) {
      const msg = describePasskeyError(err);
      if (msg) setError(msg);
    } finally {
      setPasskeyLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const { user, token } = await loginWithEmail(email, password, rememberMe);
      localStorage.setItem("auth_token", token);
      localStorage.setItem("auth_user", JSON.stringify(user));
      // Ask the browser to remember this so the teacher does not retype it
      // next time. Must happen before onLogin() unmounts the form.
      await offerToSavePassword({ email, password, name: user.name });
      await waitForPasswordPrompt();
      onLogin(token, user);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        "Login failed. Please check your email and password.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) {
      setError("Email is required.");
      return;
    }
    if (!forgotFood.trim() || !forgotBook.trim() || !forgotColor.trim()) {
      setError("Please answer all three security questions.");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const { token } = await verifySecurityAnswers(
        forgotEmail,
        forgotFood.trim(),
        forgotBook.trim(),
        forgotColor.trim(),
      );
      setResetToken(token);
      setMessage("Answers verified! Please set your new password below.");
      setMode("reset");
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        "Incorrect answers. Please check your responses and try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetToken || !newPassword) {
      setError("Reset token and new password are required.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await resetPassword(resetToken, newPassword);
      setMessage("Password reset successful. Please sign in.");
      setMode("login");
      setPassword("");
      setResetToken("");
      setNewPassword("");
    } catch {
      setError("Reset failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupEmail || !signupPassword) {
      setError("Email and password are required.");
      return;
    }
    if (signupPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (signupPassword !== signupConfirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!signupFood.trim() || !signupBook.trim() || !signupColor.trim()) {
      setError("Please answer all three security questions.");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const { user, token } = await signupWithEmail(
        signupEmail,
        signupPassword,
        signupName || undefined,
        {
          food: signupFood.trim(),
          book: signupBook.trim(),
          color: signupColor.trim(),
        },
        rememberMe,
      );
      localStorage.setItem("auth_token", token);
      localStorage.setItem("auth_user", JSON.stringify(user));
      // Offer to save straight after sign-up: this is the one moment we know
      // the teacher has just chosen a password they have not written down.
      await offerToSavePassword({
        email: signupEmail,
        password: signupPassword,
        name: user.name,
      });
      await waitForPasswordPrompt();
      onLogin(token, user);
    } catch (err: any) {
      const status = err?.response?.status;
      const msg =
        err?.response?.data?.message || "Sign up failed. Please try again.";
      if (status === 403) {
        setApplyEmail(signupEmail);
        setError(msg + " You can apply for access below.");
        setMode("apply");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="text-center mb-6">
        <div className="text-4xl mb-2">🎓</div>
        <h1 className="text-xl font-bold text-gray-800">
          Stonepark Intermediate School
        </h1>
        <p className="text-sm text-gray-500 mt-1">Chromebook Manager</p>
      </div>

      {error && (
        <div
          className="mb-4 px-3 py-2 rounded text-sm"
          style={{ backgroundColor: "#f8d7da", color: "#dc3545" }}
        >
          {error}
        </div>
      )}
      {message && (
        <div
          className="mb-4 px-3 py-2 rounded text-sm"
          style={{ backgroundColor: "#d4edda", color: "#155724" }}
        >
          {message}
        </div>
      )}

      {mode === "login" && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              autoComplete="username webauthn"
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your-email@cloud.edu.pe.ca"
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              style={{ borderColor: "#ccc" }}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              style={{ borderColor: "#ccc" }}
              required
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="accent-gray-800"
            />
            Keep me signed in for 30 days
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded font-medium text-sm transition-opacity"
            style={{
              backgroundColor: "#333333",
              color: "#fff",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>

          {passkeyAvailable && (
            <>
              <div className="flex items-center gap-3">
                <span className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400">or</span>
                <span className="flex-1 h-px bg-gray-200" />
              </div>
              <button
                type="button"
                onClick={handlePasskeyLogin}
                disabled={passkeyLoading || loading}
                className="w-full py-2 rounded border text-sm font-medium transition-colors hover:bg-gray-50 flex items-center justify-center gap-2"
                style={{
                  borderColor: "#333",
                  color: "#333",
                  opacity: passkeyLoading ? 0.7 : 1,
                }}
              >
                {passkeyLoading
                  ? "Waiting for your device…"
                  : "🔑 Sign in with a passkey"}
              </button>
              <p className="text-xs text-gray-400 text-center">
                Use your fingerprint, face, or screen lock — no password to
                remember.
              </p>
            </>
          )}

          <button
            type="button"
            onClick={() => setMode("forgot")}
            className="w-full text-xs text-gray-500 underline"
          >
            Forgot password?
          </button>
        </form>
      )}

      {mode === "forgot" && (
        <form onSubmit={handleForgot} className="space-y-4">
          <p className="text-sm text-gray-500 mb-2">
            Answer your security questions to reset your password.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={forgotEmail}
              autoComplete="username"
              onChange={(e) => setForgotEmail(e.target.value)}
              placeholder="your-email@cloud.edu.pe.ca"
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              style={{ borderColor: "#ccc" }}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              What's your favourite food?
            </label>
            <input
              type="text"
              value={forgotFood}
              autoComplete="off"
              onChange={(e) => setForgotFood(e.target.value)}
              placeholder="Your answer"
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              style={{ borderColor: "#ccc" }}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              What's your favourite book?
            </label>
            <input
              type="text"
              value={forgotBook}
              autoComplete="off"
              onChange={(e) => setForgotBook(e.target.value)}
              placeholder="Your answer"
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              style={{ borderColor: "#ccc" }}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              What's your favourite color?
            </label>
            <input
              type="text"
              value={forgotColor}
              autoComplete="off"
              onChange={(e) => setForgotColor(e.target.value)}
              placeholder="Your answer"
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              style={{ borderColor: "#ccc" }}
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded font-medium text-sm transition-opacity"
            style={{
              backgroundColor: "#333333",
              color: "#fff",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Verifying…" : "Verify & Reset Password"}
          </button>
          <button
            type="button"
            onClick={() => setMode("login")}
            className="w-full text-xs text-gray-500 underline"
          >
            Back to Sign In
          </button>
        </form>
      )}

      {mode === "reset" && (
        <form onSubmit={handleReset} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              New Password
            </label>
            <input
              type="password"
              value={newPassword}
              autoComplete="new-password"
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              style={{ borderColor: "#ccc" }}
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded font-medium text-sm transition-opacity"
            style={{
              backgroundColor: "#333333",
              color: "#fff",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Resetting…" : "Reset Password"}
          </button>
          <button
            type="button"
            onClick={() => setMode("login")}
            className="w-full text-xs text-gray-500 underline"
          >
            Back to Sign In
          </button>
        </form>
      )}

      {mode !== "signup" &&
        mode !== "apply" &&
        mode !== "forgot" &&
        mode !== "reset" && (
          <button
            type="button"
            onClick={() => setMode("signup")}
            className="mt-3 w-full py-2 rounded border text-sm font-medium transition-colors hover:bg-gray-50"
            style={{ borderColor: "#333", color: "#333" }}
          >
            Sign Up
          </button>
        )}

      {mode === "signup" && (
        <form onSubmit={handleSignup} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name (optional)
            </label>
            <input
              type="text"
              value={signupName}
              autoComplete="name"
              onChange={(e) => setSignupName(e.target.value)}
              placeholder="Your name"
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              style={{ borderColor: "#ccc" }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={signupEmail}
              autoComplete="username"
              onChange={(e) => setSignupEmail(e.target.value)}
              placeholder="your-email@cloud.edu.pe.ca"
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              style={{ borderColor: "#ccc" }}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              value={signupPassword}
              autoComplete="new-password"
              onChange={(e) => setSignupPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              style={{ borderColor: "#ccc" }}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirm Password
            </label>
            <input
              type="password"
              value={signupConfirm}
              autoComplete="new-password"
              onChange={(e) => setSignupConfirm(e.target.value)}
              placeholder="Repeat password"
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              style={{ borderColor: "#ccc" }}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              What's your favourite food?{" "}
              <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={signupFood}
              autoComplete="off"
              onChange={(e) => setSignupFood(e.target.value)}
              placeholder="Used for password recovery"
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              style={{ borderColor: "#ccc" }}
              required
            />
            <p className="text-xs text-gray-400 mt-0.5">
              🔒 Encrypted — used only for password recovery
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              What's your favourite book?{" "}
              <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={signupBook}
              autoComplete="off"
              onChange={(e) => setSignupBook(e.target.value)}
              placeholder="Used for password recovery"
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              style={{ borderColor: "#ccc" }}
              required
            />
            <p className="text-xs text-gray-400 mt-0.5">
              🔒 Encrypted — used only for password recovery
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              What's your favourite color?{" "}
              <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={signupColor}
              autoComplete="off"
              onChange={(e) => setSignupColor(e.target.value)}
              placeholder="Used for password recovery"
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              style={{ borderColor: "#ccc" }}
              required
            />
            <p className="text-xs text-gray-400 mt-0.5">
              🔒 Encrypted — used only for password recovery
            </p>
          </div>
          <div
            className="rounded px-3 py-2 text-xs text-gray-600"
            style={{ backgroundColor: "#fff3cd", border: "1px solid #ffc107" }}
          >
            ⚠️ Remember your answers carefully. Spelling and spacing matter, but
            capitalisation does not (e.g. "blue" = "Blue" = "BLUE"). These
            answers are <strong>encrypted</strong> and only used to verify your
            identity if you forget your password — they are never stored in
            plain text.
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="accent-gray-800"
            />
            Keep me signed in for 30 days
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded font-medium text-sm transition-opacity"
            style={{
              backgroundColor: "#333333",
              color: "#fff",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Signing up…" : "Create Account"}
          </button>
          <button
            type="button"
            onClick={() => setMode("login")}
            className="w-full text-xs text-gray-500 underline"
          >
            Back to Sign In
          </button>
        </form>
      )}

      {mode === "apply" && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!applyEmail) {
              setError("Email is required.");
              return;
            }
            setLoading(true);
            setError(null);
            setMessage(null);
            try {
              await applyForWhitelist(applyEmail, applyMessage || undefined);
              setMessage(
                "Your application has been submitted! An admin will review it. You'll receive an email once approved.",
              );
              setApplyMessage("");
            } catch (err: any) {
              const msg =
                err?.response?.data?.message ||
                "Failed to submit application. Please try again.";
              setError(msg);
            } finally {
              setLoading(false);
            }
          }}
          className="space-y-4"
        >
          <p className="text-sm text-gray-600">
            Your email is not yet on the whitelist. Submit an application and an
            admin will review it.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={applyEmail}
              autoComplete="email"
              onChange={(e) => setApplyEmail(e.target.value)}
              placeholder="your-email@cloud.edu.pe.ca"
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              style={{ borderColor: "#ccc" }}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Message to admin (optional)
            </label>
            <textarea
              value={applyMessage}
              onChange={(e) => setApplyMessage(e.target.value)}
              placeholder="e.g. I am a new staff member in Year 7"
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              style={{ borderColor: "#ccc" }}
              rows={3}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded font-medium text-sm transition-opacity"
            style={{
              backgroundColor: "#333333",
              color: "#fff",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Submitting…" : "Apply for Access"}
          </button>
          <button
            type="button"
            onClick={() => setMode("login")}
            className="w-full text-xs text-gray-500 underline"
          >
            Back to Sign In
          </button>
        </form>
      )}

      <p className="mt-4 text-center text-xs text-gray-400">
        Stonepark Intermediate School — Staff Access Only
      </p>
    </div>
  );
}
