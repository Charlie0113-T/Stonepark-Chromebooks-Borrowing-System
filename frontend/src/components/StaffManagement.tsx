import React, { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  ShieldCheck,
  Trash2,
  TrendingUp,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import {
  adminCreateUser,
  adminDeleteUser,
  adminSetPassword,
  fetchUsers,
  fetchAdminPromotionRequests,
  requestAdminPromotion,
  voteAdminPromotion,
  cancelAdminPromotion,
  AuthUser,
} from "../api";
import { PromotionRequest } from "../types";

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

/** Small warning chip shown when an account has no security questions set. */
const NoSecurityQuestionsChip: React.FC = () => (
  <div
    className="sp-pill-warning inline-flex items-center gap-1 mt-0.5"
    title="This user has not set security questions yet; they will be prompted to set them on first sign-in."
  >
    <AlertTriangle size={12} strokeWidth={2} aria-hidden="true" />
    No security questions set
  </div>
);

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
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Reset password form
  const [resetTarget, setResetTarget] = useState<UserRow | null>(null);
  const [resetPassword, setResetPasswordValue] = useState("");
  const [resetConfirm, setResetConfirm] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);

  // Promotion requests
  const [promotionRequests, setPromotionRequests] = useState<PromotionRequest[]>([]);
  const [promotionLoading, setPromotionLoading] = useState(false);
  const [promotionError, setPromotionError] = useState<string | null>(null);

  const flashSuccess = (msg: string) => {
    setSuccess(msg);
    setError(null);
    setTimeout(() => setSuccess(null), 4000);
  };

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Do not log the response: it is the full staff roster (names, emails,
      // roles) and would sit in the browser console on a shared machine.
      setUsers(await fetchUsers());
    } catch (err: any) {
      setError(
        err?.response?.data?.message || "Failed to load users. Please retry.",
      );
    } finally {
      setLoading(false);
    }
    // Load promotions separately so a failure doesn't block the user list
    if (currentUser.role === "admin") {
      try {
        const promos = await fetchAdminPromotionRequests();
        setPromotionRequests(promos);
      } catch {
        setPromotionRequests([]);
      }
    }
  }, [currentUser.role]);

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
        role: "staff",
      });
      flashSuccess(`Account created for ${newEmail}.`);
      setNewName("");
      setNewEmail("");
      setNewPassword("");
      setNewConfirm("");
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

  const handleRequestPromotion = async (user: UserRow) => {
    setPromotionLoading(true);
    setPromotionError(null);
    try {
      const result = await requestAdminPromotion(user.email);
      if ("status" in result && result.status === "promoted") {
        flashSuccess(`${user.email} has been promoted to Admin.`);
        await loadUsers();
      } else {
        flashSuccess(`Promotion request submitted for ${user.email}. Other admins can now vote.`);
        await loadUsers();
      }
    } catch (err: any) {
      setPromotionError(err?.response?.data?.message || "Failed to request promotion.");
    } finally {
      setPromotionLoading(false);
    }
  };

  const handleVotePromotion = async (email: string) => {
    setPromotionLoading(true);
    setPromotionError(null);
    try {
      const result = await voteAdminPromotion(email);
      if (result.status === "promoted") {
        flashSuccess(`${email} has been promoted to Admin.`);
      }
      await loadUsers();
    } catch (err: any) {
      setPromotionError(err?.response?.data?.message || "Failed to vote on promotion.");
    } finally {
      setPromotionLoading(false);
    }
  };

  const handleCancelPromotion = async (email: string) => {
    setPromotionLoading(true);
    setPromotionError(null);
    try {
      await cancelAdminPromotion(email);
      flashSuccess(`Promotion request for ${email} cancelled.`);
      await loadUsers();
    } catch (err: any) {
      setPromotionError(err?.response?.data?.message || "Failed to cancel promotion.");
    } finally {
      setPromotionLoading(false);
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
        <div className="sp-banner-alert text-sm flex items-start gap-2">
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
        <div className="sp-banner-success text-sm flex items-start gap-2">
          <CheckCircle2
            size={16}
            strokeWidth={2}
            aria-hidden="true"
            className="flex-shrink-0 mt-0.5"
          />
          <span>{success}</span>
        </div>
      )}

      {/* ── Create account panel ─────────────────────────────────────── */}
      {panel === "create" && (
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="sp-rule-gold inline-block pb-1 text-sm font-semibold text-purple-800">
            Create Staff Account
          </div>
          <div>
            <label className="sp-label">Name (Optional)</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Ms. Johnson"
              className="sp-input"
            />
          </div>
          <div>
            <label className="sp-label">
              Email <span className="text-status-alert-fg">*</span>
            </label>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="teacher@school.edu"
              className="sp-input"
              required
            />
          </div>
          <div>
            <label className="sp-label">
              Password <span className="text-status-alert-fg">*</span>
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="sp-input pr-16"
                required
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-ink-400 hover:text-ink-600"
                tabIndex={-1}
              >
                {showNewPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          <div>
            <label className="sp-label">
              Confirm Password <span className="text-status-alert-fg">*</span>
            </label>
            <input
              type={showNewPassword ? "text" : "password"}
              value={newConfirm}
              onChange={(e) => setNewConfirm(e.target.value)}
              placeholder="Repeat password"
              className="sp-input"
              required
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={loading}
              className="sp-btn-primary flex-1 inline-flex items-center justify-center gap-2"
            >
              <UserPlus size={16} strokeWidth={2} aria-hidden="true" />
              {loading ? "Creating…" : "Create Account"}
            </button>
            <button
              type="button"
              onClick={goBack}
              disabled={loading}
              className="sp-btn-secondary"
            >
              Cancel
            </button>
          </div>
          <p className="text-xs text-ink-500">
            The teacher's email will be automatically added to the whitelist.
            Share the password with them directly.
          </p>
        </form>
      )}

      {/* ── Reset password panel ─────────────────────────────────────── */}
      {panel === "reset" && resetTarget && (
        <form onSubmit={handleResetPassword} className="space-y-3">
          <div className="sp-rule-gold inline-block pb-1 text-sm font-semibold text-purple-800">
            Reset Password
          </div>
          <div className="px-3 py-2 rounded-md bg-ink-50 text-sm text-ink-800">
            Setting new password for{" "}
            <strong>{resetTarget.name || resetTarget.email}</strong>
            <br />
            <span className="text-xs text-ink-500">{resetTarget.email}</span>
          </div>
          <div>
            <label className="sp-label">
              New Password <span className="text-status-alert-fg">*</span>
            </label>
            <div className="relative">
              <input
                type={showResetPassword ? "text" : "password"}
                value={resetPassword}
                onChange={(e) => setResetPasswordValue(e.target.value)}
                placeholder="At least 8 characters"
                className="sp-input pr-16"
                required
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowResetPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-ink-400 hover:text-ink-600"
                tabIndex={-1}
              >
                {showResetPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          <div>
            <label className="sp-label">
              Confirm New Password{" "}
              <span className="text-status-alert-fg">*</span>
            </label>
            <input
              type={showResetPassword ? "text" : "password"}
              value={resetConfirm}
              onChange={(e) => setResetConfirm(e.target.value)}
              placeholder="Repeat new password"
              className="sp-input"
              required
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={loading}
              className="sp-btn-primary flex-1 inline-flex items-center justify-center gap-2"
            >
              <KeyRound size={16} strokeWidth={2} aria-hidden="true" />
              {loading ? "Updating…" : "Update Password"}
            </button>
            <button
              type="button"
              onClick={goBack}
              disabled={loading}
              className="sp-btn-secondary"
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
            <div className="text-sm text-ink-500">
              <span className="font-mono">{users.length}</span> account
              {users.length !== 1 ? "s" : ""} total
              {users.length > 0 &&
                users.filter((u) => !u.has_security_questions).length > 0 && (
                  <span className="ml-2 text-xs text-status-warning-fg inline-flex items-center gap-1">
                    <AlertTriangle
                      size={12}
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                    <span className="font-mono">
                      {users.filter((u) => !u.has_security_questions).length}
                    </span>{" "}
                    users without security questions
                  </span>
                )}
            </div>
            <button
              onClick={openCreate}
              disabled={loading}
              className="sp-btn-primary sp-btn-sm inline-flex items-center gap-1.5"
            >
              <UserPlus size={16} strokeWidth={2} aria-hidden="true" />
              Add Teacher Account
            </button>
          </div>

          {loading && users.length === 0 ? (
            <div className="text-sm text-ink-500 text-center py-6">
              Loading…
            </div>
          ) : users.length === 0 ? (
            <div className="text-sm text-ink-500 text-center py-6">
              No user accounts found.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Staff accounts */}
              <div>
                <div className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                  <Users size={14} strokeWidth={2} aria-hidden="true" />
                  Teachers / Staff ({staffUsers.length})
                </div>
                {staffUsers.length === 0 ? (
                  <div className="text-xs text-ink-400 px-1">
                    No staff accounts yet. Click "Add Teacher Account" to
                    create one.
                  </div>
                ) : (
                  <div className="divide-y divide-ink-100 border border-ink-200 rounded-md">
                    {staffUsers.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between px-3 py-2 hover:bg-purple-50"
                      >
                        <div className="min-w-0 flex-1 mr-2">
                          <div className="text-sm font-medium text-ink-900 truncate">
                            {user.name || user.email}
                          </div>
                          {user.name && (
                            <div className="text-xs text-ink-400 truncate">
                              {user.email}
                            </div>
                          )}
                          {!user.has_security_questions && (
                            <NoSecurityQuestionsChip />
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => handleRequestPromotion(user)}
                            disabled={loading || promotionLoading}
                            className="sp-btn-secondary sp-btn-sm inline-flex items-center gap-1"
                            title="Request promotion to Admin (requires other admins to vote)"
                          >
                            <ShieldCheck
                              size={14}
                              strokeWidth={2}
                              aria-hidden="true"
                            />
                            Promote
                          </button>
                          <button
                            onClick={() => openReset(user)}
                            disabled={loading}
                            className="sp-btn-secondary sp-btn-sm inline-flex items-center gap-1"
                            title="Reset password"
                          >
                            <KeyRound
                              size={14}
                              strokeWidth={2}
                              aria-hidden="true"
                            />
                            Reset Password
                          </button>
                          <button
                            onClick={() => setDeleteTarget(user)}
                            disabled={loading}
                            className="sp-btn sp-btn-sm border border-status-alert-edge text-status-alert-fg bg-white hover:bg-status-alert-bg"
                            title="Delete account"
                            aria-label="Delete Account"
                          >
                            <Trash2
                              size={14}
                              strokeWidth={2}
                              aria-hidden="true"
                            />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Admin accounts */}
              <div>
                <div className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                  <ShieldCheck size={14} strokeWidth={2} aria-hidden="true" />
                  Admins ({adminUsers.length})
                </div>
                <div className="divide-y divide-ink-100 border border-ink-200 rounded-md">
                  {adminUsers.map((user) => {
                    const isSelf =
                      currentUser.email.toLowerCase() ===
                      user.email.toLowerCase();
                    return (
                      <div
                        key={user.id}
                        className="flex items-center justify-between px-3 py-2 hover:bg-purple-50"
                      >
                        <div className="min-w-0 flex-1 mr-2">
                          <div className="text-sm font-medium text-ink-900 truncate flex items-center gap-1.5">
                            {user.name || user.email}
                            {isSelf && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-sm border border-ink-300 text-ink-600">
                                You
                              </span>
                            )}
                          </div>
                          {user.name && (
                            <div className="text-xs text-ink-400 truncate">
                              {user.email}
                            </div>
                          )}
                          {!user.has_security_questions && (
                            <NoSecurityQuestionsChip />
                          )}
                        </div>
                        <button
                          onClick={() => openReset(user)}
                          disabled={loading}
                          className="sp-btn-secondary sp-btn-sm inline-flex items-center gap-1 flex-shrink-0"
                          title="Reset password"
                        >
                          <KeyRound
                            size={14}
                            strokeWidth={2}
                            aria-hidden="true"
                          />
                          Reset Password
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Pending admin promotions */}
          {(promotionRequests.length > 0 || promotionError) && (
            <div>
              <div className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                <TrendingUp size={14} strokeWidth={2} aria-hidden="true" />
                Pending Admin Promotions
              </div>
              {promotionError && (
                <div className="sp-banner-alert text-sm mb-2">
                  {promotionError}
                </div>
              )}
              {promotionRequests.length === 0 ? (
                <div className="text-xs text-ink-400 px-1">
                  No pending promotion requests.
                </div>
              ) : (
                <div className="divide-y divide-ink-100 border border-ink-200 rounded-md">
                  {promotionRequests.map((req) => {
                    const canVote =
                      !req.has_voted &&
                      req.required > 0 &&
                      currentUser.email.toLowerCase() !== req.created_by.toLowerCase() &&
                      currentUser.email.toLowerCase() !== req.email.toLowerCase();
                    return (
                      <div
                        key={req.email}
                        className="flex items-center justify-between px-3 py-2 hover:bg-purple-50"
                      >
                        <div>
                          <div className="text-sm text-ink-900">
                            {req.email}
                          </div>
                          <div className="text-xs text-ink-400">
                            Requested by {req.created_by}
                          </div>
                          <div className="text-xs text-ink-500">
                            Votes:{" "}
                            <span className="font-mono">
                              {req.votes}/{req.required}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleVotePromotion(req.email)}
                            disabled={!canVote || promotionLoading}
                            className="sp-btn-secondary sp-btn-sm inline-flex items-center gap-1"
                            title={
                              canVote
                                ? "Vote to approve promotion"
                                : "Already voted or not eligible"
                            }
                          >
                            <CheckCircle2
                              size={14}
                              strokeWidth={2}
                              aria-hidden="true"
                            />
                            {req.has_voted ? "Voted" : "Vote Approve"}
                          </button>
                          <button
                            onClick={() => handleCancelPromotion(req.email)}
                            disabled={promotionLoading}
                            className="sp-btn sp-btn-sm border border-status-alert-edge text-status-alert-fg bg-white hover:bg-status-alert-bg inline-flex items-center gap-1"
                            title="Cancel this promotion request"
                          >
                            <X size={14} strokeWidth={2} aria-hidden="true" />
                            Cancel
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <p className="text-xs text-ink-500 pt-1">
            Creating an account automatically whitelists the email. Share the
            password with the teacher securely (e.g. in person or via your
            school's internal messaging).
          </p>
          <p className="text-xs text-ink-500 pt-1">
            To promote a staff member to Admin, click "Promote" — other admins
            must vote to approve, mirroring the admin removal process.
          </p>
          <p className="text-xs text-ink-500 pt-1">
            Users labeled "No security questions set" will be prompted to set
            security questions on first login; no environment variables are
            required. Once set, they can use the "Forgot password" feature.
          </p>
        </>
      )}

      {/* ── Delete confirmation overlay ──────────────────────────────── */}
      {deleteTarget && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 bg-ink-900/50"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="bg-white rounded-md shadow-lg p-6 max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-base font-semibold text-purple-800 mb-2">
              Delete account?
            </div>
            <p className="text-sm text-ink-600 mb-4">
              This will permanently delete the account for{" "}
              <strong>{deleteTarget.name || deleteTarget.email}</strong>
              {deleteTarget.name && (
                <span className="text-ink-400"> ({deleteTarget.email})</span>
              )}
              . They will no longer be able to sign in.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={loading}
                className="sp-btn-danger flex-1 inline-flex items-center justify-center gap-2"
              >
                <Trash2 size={16} strokeWidth={2} aria-hidden="true" />
                {loading ? "Deleting…" : "Yes, Delete"}
              </button>
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={loading}
                className="sp-btn-secondary flex-1"
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
