import React, { useCallback, useEffect, useState } from "react";
import {
  adminCreateUser,
  adminDeleteUser,
  adminSetPassword,
  fetchUsers,
  AuthUser,
} from "../api";

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: "admin" | "staff";
  school_id?: string;
  has_security_questions?: boolean | number;
}

interface Props {
  currentUser: AuthUser;
}

type PanelMode = "list" | "create" | "reset";

export default function StaffManagement({ currentUser }: Props) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [panel, setPanel] = useState<PanelMode>("list");

  // Create form
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newConfirm, setNewConfirm] = useState("");
  const [newRole, setNewRole] = useState<"staff" | "admin">("staff");
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Reset password form
  const [resetTarget, setResetTarget] = useState<UserRow | null>(null);
  const [resetPassword, setResetPasswordValue] = useState("");
  const [resetConfirm, setResetConfirm] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);

  const flashSuccess = (msg: string) => {
    setSuccess(msg);
    setError(null);
    setTimeout(() => setSuccess(null), 4000);
  };

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchUsers();
      console.log("[StaffManagement] fetchUsers returned:", data);
      setUsers(data);
    } catch (err: any) {
      console.error("[StaffManagement] fetchUsers failed:", err);
      setError(
        err?.response?.data?.message || "Failed to load users. Please retry.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!newEmail || !newPassword) {
      setError("Email and password are required.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== newConfirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await adminCreateUser({
        email: newEmail,
        password: newPassword,
        name: newName || undefined,
        role: newRole,
      });
      flashSuccess(`Account created for ${newEmail}.`);
      setNewName("");
      setNewEmail("");
      setNewPassword("");
      setNewConfirm("");
      setNewRole("staff");
      setPanel("list");
      await loadUsers();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to create account.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    setError(null);
    if (!resetPassword) {
      setError("New password is required.");
      return;
    }
    if (resetPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (resetPassword !== resetConfirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await adminSetPassword(resetTarget.email, resetPassword);
      flashSuccess(`Password updated for ${resetTarget.email}.`);
      setResetTarget(null);
      setResetPasswordValue("");
      setResetConfirm("");
      setPanel("list");
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to update password.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setLoading(true);
    setError(null);
    try {
      await adminDeleteUser(deleteTarget.email);
      flashSuccess(`Account for ${deleteTarget.email} deleted.`);
      setDeleteTarget(null);
      await loadUsers();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to delete user.");
      setDeleteTarget(null);
    } finally {
      setLoading(false);
    }
  };

  const openReset = (user: UserRow) => {
    setResetTarget(user);
    setResetPasswordValue("");
    setResetConfirm("");
    setError(null);
    setPanel("reset");
  };

  const openCreate = () => {
    setNewName("");
    setNewEmail("");
    setNewPassword("");
    setNewConfirm("");
    setNewRole("staff");
    setError(null);
    setPanel("create");
  };

  const goBack = () => {
    setError(null);
    setPanel("list");
  };

  const staffUsers = users.filter((u) => u.role === "staff");
  const adminUsers = users.filter((u) => u.role === "admin");

  return (
    <div className="space-y-4">
      {/* Feedback messages */}
      {error && (
        <div
          className="px-3 py-2 rounded text-sm"
          style={{ backgroundColor: "#f8d7da", color: "#dc3545" }}
        >
          {error}
        </div>
      )}
      {success && (
        <div
          className="px-3 py-2 rounded text-sm"
          style={{ backgroundColor: "#d4edda", color: "#155724" }}
        >
          ✅ {success}
        </div>
      )}

      {/* ── Create account panel ─────────────────────────────────────── */}
      {panel === "create" && (
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="text-sm font-semibold text-gray-700 mb-1">
            Create Staff Account
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Name (optional)
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Ms. Johnson"
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              style={{ borderColor: "#ccc" }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="teacher@school.edu"
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              style={{ borderColor: "#ccc" }}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Role
            </label>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as "staff" | "admin")}
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              style={{ borderColor: "#ccc" }}
            >
              <option value="staff">Staff (Teacher)</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 pr-16"
                style={{ borderColor: "#ccc" }}
                required
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showNewPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Confirm Password <span className="text-red-500">*</span>
            </label>
            <input
              type={showNewPassword ? "text" : "password"}
              value={newConfirm}
              onChange={(e) => setNewConfirm(e.target.value)}
              placeholder="Repeat password"
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              style={{ borderColor: "#ccc" }}
              required
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 rounded font-medium text-sm"
              style={{
                backgroundColor: "#333333",
                color: "#fff",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Creating…" : "Create Account"}
            </button>
            <button
              type="button"
              onClick={goBack}
              disabled={loading}
              className="px-4 py-2 rounded border text-sm"
              style={{ borderColor: "#ccc", color: "#555" }}
            >
              Cancel
            </button>
          </div>
          <p className="text-xs text-gray-400">
            The teacher's email will be automatically added to the whitelist.
            Share the password with them directly.
          </p>
        </form>
      )}

      {/* ── Reset password panel ─────────────────────────────────────── */}
      {panel === "reset" && resetTarget && (
        <form onSubmit={handleResetPassword} className="space-y-3">
          <div className="text-sm font-semibold text-gray-700 mb-1">
            Reset Password
          </div>
          <div
            className="px-3 py-2 rounded text-sm"
            style={{ backgroundColor: "#f0f0f0", color: "#333" }}
          >
            Setting new password for{" "}
            <strong>{resetTarget.name || resetTarget.email}</strong>
            <br />
            <span className="text-xs text-gray-500">{resetTarget.email}</span>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              New Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showResetPassword ? "text" : "password"}
                value={resetPassword}
                onChange={(e) => setResetPasswordValue(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 pr-16"
                style={{ borderColor: "#ccc" }}
                required
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowResetPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showResetPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Confirm New Password <span className="text-red-500">*</span>
            </label>
            <input
              type={showResetPassword ? "text" : "password"}
              value={resetConfirm}
              onChange={(e) => setResetConfirm(e.target.value)}
              placeholder="Repeat new password"
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              style={{ borderColor: "#ccc" }}
              required
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 rounded font-medium text-sm"
              style={{
                backgroundColor: "#333333",
                color: "#fff",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Updating…" : "Update Password"}
            </button>
            <button
              type="button"
              onClick={goBack}
              disabled={loading}
              className="px-4 py-2 rounded border text-sm"
              style={{ borderColor: "#ccc", color: "#555" }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* ── User list panel ──────────────────────────────────────────── */}
      {panel === "list" && (
        <>
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              {users.length} account{users.length !== 1 ? "s" : ""} total
              {users.length > 0 &&
                users.filter((u) => !u.has_security_questions).length > 0 && ( 
                  <span className="ml-2 text-xs" style={{ color: "#856404" }}>
                    ⚠️ {users.filter((u) => !u.has_security_questions).length} users without security questions
                  </span>
                )}
            </div>
            <button
              onClick={openCreate}
              disabled={loading}
              className="px-3 py-1.5 rounded text-sm font-medium"
              style={{
                backgroundColor: "#333333",
                color: "#fff",
                opacity: loading ? 0.7 : 1,
              }}
            >
              + Add Teacher Account
            </button>
          </div>

          {loading && users.length === 0 ? (
            <div className="text-sm text-gray-500 text-center py-6">
              Loading…
            </div>
          ) : users.length === 0 ? (
            <div className="text-sm text-gray-500 text-center py-6">
              No user accounts found.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Staff accounts */}
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  👩‍🏫 Teachers / Staff ({staffUsers.length})
                </div>
                {staffUsers.length === 0 ? (
                  <div className="text-xs text-gray-400 px-1">
                    No staff accounts yet. Click "+ Add Teacher Account" to
                    create one.
                  </div>
                ) : (
                  <div
                    className="divide-y border rounded"
                    style={{ borderColor: "#e5e7eb" }}
                  >
                    {staffUsers.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between px-3 py-2"
                      >
                        <div className="min-w-0 flex-1 mr-2">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {user.name || user.email}
                          </div>
                          {user.name && (
                            <div className="text-xs text-gray-400 truncate">
                              {user.email}
                            </div>
                          )}
                          {!user.has_security_questions && (
                            <div
                              className="text-[10px] mt-0.5 px-1.5 py-0.5 rounded inline-block"
                              style={{
                                backgroundColor: "#fff3cd",
                                color: "#856404",
                                border: "1px solid #ffc107",
                              }}
                              title="该用户还未设置安全问题，首次登录时会自动提示设置"
                              >
                                ⚠️ No security questions set
                              </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => openReset(user)}
                            disabled={loading}
                            className="px-2 py-1 rounded border text-xs"
                            style={{
                              borderColor: "#333333",
                              color: "#333333",
                              opacity: loading ? 0.6 : 1,
                            }}
                            title="Reset password"
                          >
                            🔑 Reset pw
                          </button>
                          <button
                            onClick={() => setDeleteTarget(user)}
                            disabled={loading}
                            className="px-2 py-1 rounded border text-xs"
                            style={{
                              borderColor: "#dc3545",
                              color: "#dc3545",
                              opacity: loading ? 0.6 : 1,
                            }}
                            title="Delete account"
                          >
                            🗑
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Admin accounts */}
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  🛡 Admins ({adminUsers.length})
                </div>
                <div
                  className="divide-y border rounded"
                  style={{ borderColor: "#e5e7eb" }}
                >
                  {adminUsers.map((user) => {
                    const isSelf =
                      currentUser.email.toLowerCase() ===
                      user.email.toLowerCase();
                    return (
                      <div
                        key={user.id}
                        className="flex items-center justify-between px-3 py-2"
                      >
                        <div className="min-w-0 flex-1 mr-2">
                          <div className="text-sm font-medium text-gray-900 truncate flex items-center gap-1.5">
                            {user.name || user.email}
                            {isSelf && (
                              <span
                                className="text-[10px] px-1.5 py-0.5 rounded border"
                                style={{ borderColor: "#333", color: "#333" }}
                              >
                                You
                              </span>
                            )}
                          </div>
                          {user.name && (
                            <div className="text-xs text-gray-400 truncate">
                              {user.email}
                            </div>
                          )}
                          {!user.has_security_questions && (
                            <div
                              className="text-[10px] mt-0.5 px-1.5 py-0.5 rounded inline-block"
                              style={{
                                backgroundColor: "#fff3cd",
                                color: "#856404",
                                border: "1px solid #ffc107",
                              }}
                              title="该用户还未设置安全问题，首次登录时会自动提示设置"
                              >
                                ⚠️ No security questions set
                              </div>
                          )}
                        </div>
                        <button
                          onClick={() => openReset(user)}
                          disabled={loading}
                          className="px-2 py-1 rounded border text-xs flex-shrink-0"
                          style={{
                            borderColor: "#333333",
                            color: "#333333",
                            opacity: loading ? 0.6 : 1,
                          }}
                          title="Reset password"
                        >
                          🔑 Reset pw
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <p className="text-xs text-gray-400 pt-1">
            Creating an account automatically whitelists the email. Share the
            password with the teacher securely (e.g. in person or via your
            school's internal messaging).
          </p>
          <p className="text-xs text-gray-400 pt-1">
            💡 Users labeled "⚠️ No security questions set" will be prompted to set security questions on first login; no environment variables are required. Once set, they can use the "Forgot password" feature.
          </p>
        </>
      )}

      {/* ── Delete confirmation overlay ──────────────────────────────── */}
      {deleteTarget && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-base font-semibold text-gray-800 mb-2">
              Delete account?
            </div>
            <p className="text-sm text-gray-600 mb-4">
              This will permanently delete the account for{" "}
              <strong>{deleteTarget.name || deleteTarget.email}</strong>
              {deleteTarget.name && (
                <span className="text-gray-400"> ({deleteTarget.email})</span>
              )}
              . They will no longer be able to sign in.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={loading}
                className="flex-1 py-2 rounded font-medium text-sm"
                style={{
                  backgroundColor: "#dc3545",
                  color: "#fff",
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? "Deleting…" : "Yes, delete"}
              </button>
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={loading}
                className="flex-1 py-2 rounded border text-sm"
                style={{ borderColor: "#ccc", color: "#555" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
