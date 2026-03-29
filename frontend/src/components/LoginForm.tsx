import React, { useState } from "react";
import {
  AuthUser,
  loginWithEmail,
  requestPasswordReset,
  resetPassword,
  signupWithEmail,
} from "../api";

interface Props {
  onLogin: (token: string, user: AuthUser) => void;
}

export default function LoginForm({ onLogin }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [mode, setMode] = useState<"login" | "forgot" | "reset" | "signup">(
    "login",
  );
  const [signupEmail, setSignupEmail] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirm, setSignupConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const { user, token } = await loginWithEmail(email, password);
      localStorage.setItem("auth_token", token);
      localStorage.setItem("auth_user", JSON.stringify(user));
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
    if (!email) {
      setError("Email is required.");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await requestPasswordReset(email);
      setMessage("If this email is allowed, a reset code was sent.");
      setMode("reset");
    } catch {
      setError("Failed to send reset code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetToken || !newPassword) {
      setError("Reset code and new password are required.");
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
      setError("Reset failed. Please check your code and try again.");
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
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const { user, token } = await signupWithEmail(
        signupEmail,
        signupPassword,
        signupName || undefined,
      );
      localStorage.setItem("auth_token", token);
      localStorage.setItem("auth_user", JSON.stringify(user));
      onLogin(token, user);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message || "Sign up failed. Please try again.";
      setError(msg);
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
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@cloud.edu.pe.ca"
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
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
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
            {loading ? "Signing in…" : "Sign In"}
          </button>
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@cloud.edu.pe.ca"
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
            {loading ? "Sending…" : "Send Reset Code"}
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
              Reset Code
            </label>
            <input
              type="text"
              value={resetToken}
              onChange={(e) => setResetToken(e.target.value)}
              placeholder="Paste the reset code"
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              style={{ borderColor: "#ccc" }}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              New Password
            </label>
            <input
              type="password"
              value={newPassword}
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

      {mode !== "signup" && (
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
              onChange={(e) => setSignupEmail(e.target.value)}
              placeholder="you@cloud.edu.pe.ca"
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
              onChange={(e) => setSignupConfirm(e.target.value)}
              placeholder="Repeat password"
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

      <p className="mt-4 text-center text-xs text-gray-400">
        Stonepark Intermediate School — Staff Access Only
      </p>
    </div>
  );
}
