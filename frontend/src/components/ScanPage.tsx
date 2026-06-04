import React, { useEffect, useState } from "react";
import {
  fetchResource,
  fetchBookings,
  returnAllForResource,
  returnBooking,
  loginWithEmail,
  AuthUser,
} from "../api";
import { Booking, Resource } from "../types";

interface Props {
  resourceId: string;
}

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
      .catch(() => setError("Failed to load resource data."))
      .finally(() => setLoading(false));
  }, [token, resourceId]);

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
      setError(err?.response?.data?.message || "Failed to return bookings.");
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
      setError(err?.response?.data?.message || "Failed to return booking.");
    } finally {
      setReturning(false);
    }
  };

  // Login view
  if (showLogin) {
    return (
      <div
        style={{
          minHeight: "100vh",
          fontFamily: "Inter, system-ui, sans-serif",
          backgroundColor: "#f8f9fa",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
        }}
      >
        <div
          style={{
            maxWidth: 400,
            width: "100%",
            backgroundColor: "#fff",
            borderRadius: 8,
            padding: 28,
            border: "1px solid #e0e0e0",
            boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🔐</div>
            <h1
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: "#333",
                margin: 0,
              }}
            >
              Staff Sign In
            </h1>
            <p style={{ fontSize: 13, color: "#666", marginTop: 4 }}>
              Sign in once — stay signed in for 30 days
            </p>
          </div>

          {loginError && (
            <div
              style={{
                backgroundColor: "#f8d7da",
                color: "#dc3545",
                padding: "10px 14px",
                borderRadius: 8,
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 14 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#333",
                  marginBottom: 5,
                }}
              >
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #ccc",
                  borderRadius: 8,
                  fontSize: 14,
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#333",
                  marginBottom: 5,
                }}
              >
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #ccc",
                  borderRadius: 8,
                  fontSize: 14,
                  boxSizing: "border-box",
                }}
              />
            </div>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                color: "#555",
                marginBottom: 16,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{ accentColor: "#333" }}
              />
              Keep me signed in for 30 days
            </label>

            <button
              type="submit"
              disabled={loginLoading}
              style={{
                width: "100%",
                padding: "13px",
                backgroundColor: "#333",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontSize: 15,
                fontWeight: 700,
                cursor: loginLoading ? "default" : "pointer",
                opacity: loginLoading ? 0.7 : 1,
              }}
            >
              {loginLoading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <p
            style={{
              textAlign: "center",
              fontSize: 11,
              color: "#999",
              marginTop: 16,
            }}
          >
            Sign in with your staff email and password.
            <br />
            You'll stay signed in on this device for 30 days.
          </p>
        </div>
      </div>
    );
  }

  // Main scan page
  return (
    <div
      style={{
        minHeight: "100vh",
        fontFamily: "Inter, system-ui, sans-serif",
        backgroundColor: "#f5f5f5",
        padding: 16,
        maxWidth: 500,
        margin: "0 auto",
        color: "#222",
      }}
    >
      {/* Header */}
      <div
        style={{
          backgroundColor: "#333",
          color: "#fff",
          borderRadius: 6,
          padding: "14px 16px",
          marginBottom: 16,
        }}
      >
        <div style={{ fontSize: 12, opacity: 0.7 }}>Chromebook Manager</div>
        <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>
          Return Chromebooks
        </div>
        {authUser && (
          <div style={{ fontSize: 12, marginTop: 6, opacity: 0.8 }}>
            Signed in as {authUser.name || authUser.email}
          </div>
        )}
      </div>

      {/* Error / Success */}
      {error && (
        <div
          style={{
            border: "1px solid #dc3545",
            color: "#dc3545",
            padding: "10px 14px",
            borderRadius: 6,
            fontSize: 13,
            marginBottom: 12,
            backgroundColor: "#fff",
          }}
        >
          {error}
        </div>
      )}
      {success && (
        <div
          style={{
            border: "1px solid #333",
            color: "#333",
            padding: "10px 14px",
            borderRadius: 6,
            fontSize: 13,
            marginBottom: 12,
            backgroundColor: "#fff",
          }}
        >
          {success}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#666" }}>
          Loading…
        </div>
      ) : resource ? (
        <>
          {/* Resource info */}
          <div
            style={{
              backgroundColor: "#fff",
              borderRadius: 6,
              padding: 14,
              marginBottom: 14,
              border: "1px solid #e0e0e0",
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>
              {resource.name}
            </div>
            <div style={{ fontSize: 12, color: "#666" }}>
              {resource.classRoom}
              {resource.type === "cabinet"
                ? ` · ${resource.totalQuantity} Chromebooks`
                : ""}
            </div>
          </div>

          {/* Active bookings */}
          {bookings.length === 0 ? (
            <div
              style={{
                backgroundColor: "#fff",
                borderRadius: 6,
                padding: 20,
                textAlign: "center",
                border: "1px solid #e0e0e0",
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
              <div style={{ fontSize: 14, color: "#666" }}>
                No active bookings for this resource.
              </div>
            </div>
          ) : (
            <>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#555",
                  marginBottom: 8,
                }}
              >
                Active Bookings ({bookings.length})
              </div>

              {bookings.map((b) => (
                <div
                  key={b.id}
                  style={{
                    backgroundColor: "#fff",
                    borderRadius: 6,
                    padding: 12,
                    marginBottom: 8,
                    border: "1px solid #e0e0e0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>
                      {b.borrower}
                    </div>
                    <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>
                      {b.borrowerClass}
                      {b.quantity > 1 ? ` · Qty: ${b.quantity}` : ""}
                    </div>
                    {b.isOverdue && (
                      <div
                        style={{
                          fontSize: 11,
                          color: "#dc3545",
                          fontWeight: 600,
                          marginTop: 2,
                        }}
                      >
                        ⚠ Overdue
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleReturnSingle(b)}
                    disabled={returning}
                    style={{
                      padding: "7px 14px",
                      backgroundColor: "#fff",
                      color: "#333",
                      border: "1px solid #333",
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: returning ? "default" : "pointer",
                      opacity: returning ? 0.5 : 1,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Return
                  </button>
                </div>
              ))}

              {/* Return All button */}
              <button
                onClick={handleReturnAll}
                disabled={returning}
                style={{
                  width: "100%",
                  padding: "13px",
                  backgroundColor: returning ? "#555" : "#111",
                  color: "#fff",
                  border: "1px solid #111",
                  borderRadius: 6,
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: returning ? "default" : "pointer",
                  opacity: returning ? 0.7 : 1,
                  marginTop: 8,
                  letterSpacing: "0.01em",
                }}
              >
                {returning ? "Processing…" : "Return All"}
              </button>
            </>
          )}

          {/* Sign out */}
          <button
            onClick={() => {
              localStorage.removeItem("auth_token");
              localStorage.removeItem("auth_user");
              setAuthUser(null);
              setToken("");
              setShowLogin(true);
            }}
            style={{
              width: "100%",
              padding: "12px",
              backgroundColor: "transparent",
              color: "#999",
              border: "1px solid #ddd",
              borderRadius: 8,
              fontSize: 13,
              marginTop: 16,
              cursor: "pointer",
            }}
          >
            Sign Out
          </button>
        </>
      ) : (
        <div style={{ textAlign: "center", padding: 40, color: "#666" }}>
          Resource not found.
        </div>
      )}
    </div>
  );
}
