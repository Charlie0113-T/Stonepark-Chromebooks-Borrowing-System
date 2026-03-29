import React, { useCallback, useEffect, useState } from "react";
import "./App.css";
import {
  API_BASE_URL,
  addWhitelistEmail,
  AuthUser,
  fetchCurrentUser,
  fetchResources,
  fetchSchools,
  fetchStats,
  fetchWhitelist,
  fetchWhitelistRemovalRequests,
  removeWhitelistEmail,
  requestAdminRemoval,
  School,
  voteAdminRemoval,
} from "./api";
import AddResourceForm from "./components/AddResourceForm";
import StaffManagement from "./components/StaffManagement";
import AllBookings from "./components/AllBookings";
import BookingForm from "./components/BookingForm";
import BookingList from "./components/BookingList";
import CalendarView from "./components/CalendarView";
import LoginForm from "./components/LoginForm";
import SecuritySetupModal from "./components/SecuritySetupModal";
import Modal from "./components/Modal";
import QRCodeGallery from "./components/QRCodeGallery";
import ResourceCard from "./components/ResourceCard";
import StatsView from "./components/StatsView";
import { StatusDot } from "./components/StatusBadge";
import { RemovalRequest, Resource, Stats, WhitelistEntry } from "./types";

type Tab = "dashboard" | "bookings" | "calendar" | "stats" | "qr";

function envTrue(value: string | undefined) {
  return (value || "").trim().toLowerCase() === "true";
}

function App() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [schools, setSchools] = useState<School[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("dashboard");

  // Auth state
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => {
    try {
      const u = localStorage.getItem("auth_user");
      return u ? (JSON.parse(u) as AuthUser) : null;
    } catch {
      return null;
    }
  });
  const [showLogin, setShowLogin] = useState(false);
  const [showSecuritySetup, setShowSecuritySetup] = useState(false);
  const bypassAuth = !envTrue(process.env.REACT_APP_REQUIRE_AUTH);

  const [showWhitelist, setShowWhitelist] = useState(false);
  const [showStaff, setShowStaff] = useState(false);
  const [whitelistEntries, setWhitelistEntries] = useState<WhitelistEntry[]>(
    [],
  );
  const [removalRequests, setRemovalRequests] = useState<RemovalRequest[]>([]);
  const [whitelistLoading, setWhitelistLoading] = useState(false);
  const [whitelistError, setWhitelistError] = useState<string | null>(null);
  const [whitelistEmail, setWhitelistEmail] = useState("");
  const [whitelistPage, setWhitelistPage] = useState(1);
  const whitelistPageSize = 8;

  // Modal states
  const [bookingResource, setBookingResource] = useState<Resource | null>(null);
  const [historyResource, setHistoryResource] = useState<Resource | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showAddResource, setShowAddResource] = useState(false);
  const successTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // Filter
  const [filter, setFilter] = useState<"all" | "cabinet" | "single">("all");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "available" | "partial" | "full"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [res, st] = await Promise.all([
        fetchResources(selectedSchool || undefined),
        fetchStats(selectedSchool || undefined),
      ]);
      setResources(res);
      setStats(st);
    } catch {
      const target = API_BASE_URL || "same-origin /api";
      setError(`Failed to load data. Check backend/API URL: ${target}`);
    } finally {
      setLoading(false);
    }
  }, [selectedSchool]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Load schools for multi-school selector
  useEffect(() => {
    fetchSchools()
      .then(setSchools)
      .catch(() => {});
  }, []);

  // Handle OAuth token in URL (after Google OAuth callback) and fetch current user
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // Also check URL fragment for token (more secure than query param)
    const hashParams = new URLSearchParams(
      window.location.hash.replace(/^#/, ""),
    );
    const urlToken = params.get("token") || hashParams.get("token");
    if (urlToken) {
      localStorage.setItem("auth_token", urlToken);
      window.history.replaceState({}, "", window.location.pathname);
    }

    const token = localStorage.getItem("auth_token");
    if (!token) return;
    fetchCurrentUser()
      .then((user) => {
        localStorage.setItem("auth_user", JSON.stringify(user));
        setAuthUser(user);
        if (user.needsSecuritySetup) {
          setShowSecuritySetup(true);
        }
      })
      .catch(() => {
        // Token may be invalid/expired, clear it
        localStorage.removeItem("auth_token");
        localStorage.removeItem("auth_user");
      });
  }, []);

  const handleBookSuccess = async () => {
    setBookingResource(null);
    setSuccessMsg("Booking created successfully!");
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    successTimerRef.current = setTimeout(() => setSuccessMsg(null), 4000);
    await loadData();
  };

  const handleAddResourceSuccess = async () => {
    setShowAddResource(false);
    setSuccessMsg("Resource added successfully!");
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    successTimerRef.current = setTimeout(() => setSuccessMsg(null), 4000);
    await loadData();
  };

  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    setAuthUser(null);
  };

  const handleLogin = (_token: string, user: AuthUser) => {
    setAuthUser(user);
    setShowLogin(false);
    if (user.needsSecuritySetup) {
      setShowSecuritySetup(true);
    }
  };

  const loadWhitelist = useCallback(async () => {
    setWhitelistLoading(true);
    setWhitelistError(null);
    try {
      const [entries, requests] = await Promise.all([
        fetchWhitelist(),
        fetchWhitelistRemovalRequests(),
      ]);
      setWhitelistEntries(entries);
      setRemovalRequests(requests);
      setWhitelistPage(1);
    } catch {
      setWhitelistError("Failed to load whitelist.");
    } finally {
      setWhitelistLoading(false);
    }
  }, []);

  useEffect(() => {
    if (showWhitelist) {
      loadWhitelist();
    }
  }, [showWhitelist, loadWhitelist]);

  const handleAddWhitelist = async () => {
    const email = whitelistEmail.trim().toLowerCase();
    if (!email) return;
    setWhitelistLoading(true);
    setWhitelistError(null);
    try {
      await addWhitelistEmail(email);
      setWhitelistEmail("");
      await loadWhitelist();
    } catch {
      setWhitelistError("Failed to add whitelist email.");
    } finally {
      setWhitelistLoading(false);
    }
  };

  const handleRemoveWhitelist = async (entry: WhitelistEntry) => {
    if (!authUser) return;
    if (entry.email.toLowerCase() === authUser.email.toLowerCase()) return;
    setWhitelistLoading(true);
    setWhitelistError(null);
    try {
      if (entry.is_admin) {
        await requestAdminRemoval(entry.email);
      } else {
        await removeWhitelistEmail(entry.email);
      }
      await loadWhitelist();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Failed to update whitelist.";
      setWhitelistError(msg);
    } finally {
      setWhitelistLoading(false);
    }
  };

  const handleVoteRemoval = async (email: string) => {
    setWhitelistLoading(true);
    setWhitelistError(null);
    try {
      await voteAdminRemoval(email);
      await loadWhitelist();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Failed to vote on removal.";
      setWhitelistError(msg);
    } finally {
      setWhitelistLoading(false);
    }
  };

  const whitelistTotalPages = Math.max(
    1,
    Math.ceil(whitelistEntries.length / whitelistPageSize),
  );
  const whitelistPageStart = (whitelistPage - 1) * whitelistPageSize;
  const whitelistPageEntries = whitelistEntries.slice(
    whitelistPageStart,
    whitelistPageStart + whitelistPageSize,
  );

  const filteredResources = resources.filter((r) => {
    if (filter !== "all" && r.type !== filter) return false;
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchesName = r.name.toLowerCase().includes(q);
      const matchesRoom = r.classRoom.toLowerCase().includes(q);
      const matchesDesc = r.description.toLowerCase().includes(q);
      if (!matchesName && !matchesRoom && !matchesDesc) return false;
    }
    return true;
  });

  const tabClass = (t: Tab) =>
    `px-5 py-2.5 text-sm font-semibold rounded-t border-b-2 transition-colors ${
      tab === t
        ? "border-gray-900 text-gray-900 bg-white"
        : "border-transparent text-gray-500 hover:text-gray-700 bg-transparent"
    }`;

  // Show login gate when REACT_APP_REQUIRE_AUTH=true and user isn't logged in
  if (!bypassAuth && !authUser) {
    return <LoginForm onLogin={handleLogin} />;
  }

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: "#f8f9fa",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      {/* Header */}
      <header style={{ backgroundColor: "#333333", color: "#ffffff" }}>
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              🎓 Stonepark Intermediate School
              <br />
              <span className="text-base font-semibold">
                Chromebook Manager
              </span>
            </h1>
            <p className="text-xs text-gray-300 mt-0.5">
              Borrowing &amp; Reservation System
            </p>
          </div>
          <div className="flex items-center gap-3">
            {stats && (
              <div className="hidden sm:flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <StatusDot status="available" />
                  <span className="text-gray-200">
                    {
                      stats.resourceStats.filter((r) => r.utilisationPct === 0)
                        .length
                    }{" "}
                    Free
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <StatusDot status="partial" />
                  <span className="text-gray-200">
                    {
                      stats.resourceStats.filter(
                        (r) => r.utilisationPct > 0 && r.utilisationPct < 100,
                      ).length
                    }{" "}
                    Partial
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <StatusDot status="full" />
                  <span className="text-gray-200">
                    {stats.fullyBookedResources} Full
                  </span>
                </div>
                {stats.overdueBookings > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-3 h-3 rounded-full inline-block"
                      style={{ backgroundColor: "#dc3545" }}
                      aria-label="overdue"
                    />
                    <span className="text-gray-200">
                      {stats.overdueBookings} Overdue
                    </span>
                  </div>
                )}
              </div>
            )}
            {/* Auth */}
            {authUser ? (
              <div className="flex items-center gap-2 text-xs text-gray-300">
                <span>👤 {authUser.name}</span>
                {authUser.role === "admin" && (
                  <>
                    <button
                      onClick={() => setShowStaff(true)}
                      className="px-2 py-1 rounded border border-gray-400 text-gray-200 hover:bg-gray-600 text-xs"
                    >
                      👩‍🏫 Staff
                    </button>
                    <button
                      onClick={() => setShowWhitelist(true)}
                      className="px-2 py-1 rounded border border-gray-400 text-gray-200 hover:bg-gray-600 text-xs"
                    >
                      Whitelist
                    </button>
                  </>
                )}
                <button
                  onClick={handleLogout}
                  className="px-2 py-1 rounded border border-gray-400 text-gray-300 hover:bg-gray-600 text-xs"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowLogin(true)}
                className="px-3 py-1.5 rounded border border-gray-400 text-gray-200 hover:bg-gray-600 text-xs font-medium"
              >
                Sign in
              </button>
            )}
          </div>
        </div>
      </header>

      {/* School / Campus Selector */}
      {schools.length > 1 && (
        <div
          style={{ backgroundColor: "#444", color: "#eee" }}
          className="border-b border-gray-600"
        >
          <div className="max-w-6xl mx-auto px-4 py-2 flex items-center gap-3">
            <label className="text-xs font-medium text-gray-300">
              🏫 Campus:
            </label>
            <select
              value={selectedSchool}
              onChange={(e) => setSelectedSchool(e.target.value)}
              className="rounded border text-xs px-2 py-1 bg-gray-700 text-gray-100 border-gray-500 focus:outline-none"
            >
              <option value="">All Campuses</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {s.campus}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="max-w-6xl mx-auto px-4">
        <div
          className="flex gap-1 mt-4"
          style={{ borderBottom: "1px solid #333333" }}
        >
          <button
            className={tabClass("dashboard")}
            onClick={() => setTab("dashboard")}
          >
            📋 Dashboard
          </button>
          <button
            className={tabClass("bookings")}
            onClick={() => setTab("bookings")}
          >
            📖 Bookings
          </button>
          <button
            className={tabClass("calendar")}
            onClick={() => setTab("calendar")}
          >
            📅 Calendar
          </button>
          <button className={tabClass("stats")} onClick={() => setTab("stats")}>
            📊 Statistics
          </button>
          <button className={tabClass("qr")} onClick={() => setTab("qr")}>
            🧾 QR Codes
          </button>
        </div>
      </div>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Success toast */}
        {successMsg && (
          <div
            className="mb-4 rounded px-4 py-3 text-sm font-medium"
            style={{
              backgroundColor: "#d4edda",
              color: "#28a745",
              border: "1px solid #28a745",
            }}
          >
            ✅ {successMsg}
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div
            className="mb-4 rounded px-4 py-3 text-sm font-medium"
            style={{
              backgroundColor: "#f8d7da",
              color: "#dc3545",
              border: "1px solid #dc3545",
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 text-gray-500">
            Loading resources…
          </div>
        ) : tab === "dashboard" ? (
          <>
            {/* Search */}
            <div className="mb-4">
              <input
                type="text"
                placeholder="🔍 Search resources by name, room, or description…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                style={{ borderColor: "#333333", backgroundColor: "#ffffff" }}
              />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">
                  Type:
                </label>
                {(["all", "cabinet", "single"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className="px-3 py-1 rounded border text-xs font-medium transition-colors capitalize"
                    style={{
                      borderColor: "#333333",
                      backgroundColor: filter === f ? "#333333" : "transparent",
                      color: filter === f ? "#ffffff" : "#333333",
                    }}
                  >
                    {f === "all"
                      ? "All"
                      : f === "cabinet"
                        ? "⚡ Cabinet"
                        : "💻 Single"}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">
                  Status:
                </label>
                {(["all", "available", "partial", "full"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className="px-3 py-1 rounded border text-xs font-medium transition-colors capitalize"
                    style={{
                      borderColor: "#333333",
                      backgroundColor:
                        statusFilter === s ? "#333333" : "transparent",
                      color: statusFilter === s ? "#ffffff" : "#333333",
                    }}
                  >
                    {s === "all"
                      ? "All"
                      : s === "available"
                        ? "🟢 Available"
                        : s === "partial"
                          ? "🟡 Partial"
                          : "🔴 Full"}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowAddResource(true)}
                className="px-3 py-1 rounded border text-xs font-medium transition-colors"
                style={{
                  borderColor: "#333333",
                  backgroundColor: "#333333",
                  color: "#ffffff",
                }}
              >
                + Add Resource
              </button>
              <span className="ml-auto text-xs text-gray-500">
                {filteredResources.length} resource
                {filteredResources.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Resource Grid */}
            {filteredResources.length === 0 ? (
              <p className="text-center text-gray-500 py-10">
                No resources match the current filter.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredResources.map((resource) => (
                  <ResourceCard
                    key={resource.id}
                    resource={resource}
                    onBook={setBookingResource}
                    onViewBookings={setHistoryResource}
                    onResourceUpdated={loadData}
                  />
                ))}
              </div>
            )}

            {/* Legend */}
            <div className="mt-6 flex flex-wrap gap-4 justify-center text-xs text-gray-600">
              {[
                {
                  color: "#28a745",
                  label: "Available (Green) — Free to borrow",
                },
                {
                  color: "#ffc107",
                  label: "Partial (Yellow) — Partially occupied",
                },
                { color: "#dc3545", label: "Full (Red) — Fully booked" },
              ].map((item) => (
                <span key={item.label} className="flex items-center gap-1.5">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  {item.label}
                </span>
              ))}
            </div>
          </>
        ) : tab === "bookings" ? (
          <AllBookings onStatusChange={loadData} />
        ) : tab === "calendar" ? (
          <CalendarView />
        ) : tab === "stats" ? (
          stats && <StatsView stats={stats} />
        ) : (
          <QRCodeGallery resources={resources} />
        )}
      </main>

      {/* Footer */}
      <footer className="text-center text-xs text-gray-400 py-6 mt-8">
        Stonepark Intermediate School — Chromebook Borrowing System
      </footer>

      {/* Login Modal */}
      {showLogin && (
        <Modal title="Sign In" onClose={() => setShowLogin(false)}>
          <LoginForm onLogin={handleLogin} />
        </Modal>
      )}

      {/* Booking Modal */}
      {bookingResource && (
        <Modal
          title={`Book ${bookingResource.name}`}
          onClose={() => setBookingResource(null)}
        >
          <BookingForm
            resource={bookingResource}
            onSuccess={handleBookSuccess}
            onCancel={() => setBookingResource(null)}
          />
        </Modal>
      )}

      {/* History Modal */}
      {historyResource && (
        <Modal title="Booking History" onClose={() => setHistoryResource(null)}>
          <BookingList
            resource={historyResource}
            onClose={() => setHistoryResource(null)}
            onStatusChange={loadData}
          />
        </Modal>
      )}

      {/* Add Resource Modal */}
      {showAddResource && (
        <Modal
          title="Add New Resource"
          onClose={() => setShowAddResource(false)}
        >
          <AddResourceForm
            onSuccess={handleAddResourceSuccess}
            onCancel={() => setShowAddResource(false)}
          />
        </Modal>
      )}

      {showStaff && authUser?.role === "admin" && (
        <Modal
          title="Manage Staff Accounts"
          onClose={() => setShowStaff(false)}
        >
          <StaffManagement currentUser={authUser} />
        </Modal>
      )}

      {showWhitelist && authUser?.role === "admin" && (
        <Modal title="Manage Whitelist" onClose={() => setShowWhitelist(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Add email
              </label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={whitelistEmail}
                  onChange={(e) => setWhitelistEmail(e.target.value)}
                  placeholder="name@cloud.edu.pe.ca"
                  className="flex-1 border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                  style={{ borderColor: "#ccc" }}
                />
                <button
                  onClick={handleAddWhitelist}
                  disabled={whitelistLoading}
                  className="px-3 py-2 rounded text-sm font-medium"
                  style={{
                    backgroundColor: "#333333",
                    color: "#fff",
                    opacity: whitelistLoading ? 0.7 : 1,
                  }}
                >
                  Add
                </button>
              </div>
            </div>

            {whitelistError && (
              <div
                className="px-3 py-2 rounded text-sm"
                style={{ backgroundColor: "#f8d7da", color: "#dc3545" }}
              >
                {whitelistError}
              </div>
            )}

            <div>
              <div className="text-sm font-semibold text-gray-700 mb-2">
                Whitelist
              </div>
              {whitelistLoading ? (
                <div className="text-sm text-gray-500">Loading...</div>
              ) : whitelistEntries.length === 0 ? (
                <div className="text-sm text-gray-500">
                  No whitelist entries.
                </div>
              ) : (
                <div
                  className="divide-y border rounded"
                  style={{ borderColor: "#e5e7eb" }}
                >
                  {whitelistPageEntries.map((entry) => {
                    const isSelf =
                      authUser.email.toLowerCase() ===
                      entry.email.toLowerCase();
                    return (
                      <div
                        key={entry.email}
                        className="flex items-center justify-between px-3 py-2"
                      >
                        <div>
                          <div className="text-sm text-gray-900 flex items-center gap-2">
                            <span>{entry.email}</span>
                            {entry.is_admin && (
                              <span
                                className="text-[10px] px-1.5 py-0.5 rounded border"
                                style={{
                                  borderColor: "#333333",
                                  color: "#333333",
                                }}
                              >
                                Admin
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-400">
                            {entry.created_by
                              ? `Added by ${entry.created_by}`
                              : "Seeded"}
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveWhitelist(entry)}
                          disabled={isSelf || whitelistLoading}
                          className="px-2 py-1 rounded border text-xs"
                          style={{
                            borderColor: "#333333",
                            color: isSelf ? "#999999" : "#333333",
                            opacity: whitelistLoading ? 0.6 : 1,
                          }}
                          title={
                            isSelf ? "You cannot remove yourself." : "Remove"
                          }
                        >
                          {entry.is_admin ? "Request removal" : "Remove"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              {whitelistEntries.length > 0 && (
                <div className="flex items-center justify-between mt-3 text-xs text-gray-600">
                  <button
                    onClick={() => setWhitelistPage((p) => Math.max(1, p - 1))}
                    disabled={whitelistPage <= 1}
                    className="px-2 py-1 rounded border"
                    style={{
                      borderColor: "#333333",
                      opacity: whitelistPage <= 1 ? 0.5 : 1,
                    }}
                  >
                    Prev
                  </button>
                  <span>
                    Page {whitelistPage} of {whitelistTotalPages}
                  </span>
                  <button
                    onClick={() =>
                      setWhitelistPage((p) =>
                        Math.min(whitelistTotalPages, p + 1),
                      )
                    }
                    disabled={whitelistPage >= whitelistTotalPages}
                    className="px-2 py-1 rounded border"
                    style={{
                      borderColor: "#333333",
                      opacity: whitelistPage >= whitelistTotalPages ? 0.5 : 1,
                    }}
                  >
                    Next
                  </button>
                </div>
              )}
            </div>

            <div>
              <div className="text-sm font-semibold text-gray-700 mb-2">
                Pending admin removals
              </div>
              {removalRequests.length === 0 ? (
                <div className="text-sm text-gray-500">
                  No pending admin removals.
                </div>
              ) : (
                <div
                  className="divide-y border rounded"
                  style={{ borderColor: "#e5e7eb" }}
                >
                  {removalRequests.map((request) => {
                    const canVote = !request.has_voted && request.required > 0;
                    return (
                      <div
                        key={request.email}
                        className="flex items-center justify-between px-3 py-2"
                      >
                        <div>
                          <div className="text-sm text-gray-900">
                            {request.email}
                          </div>
                          <div className="text-xs text-gray-400">
                            Requested by {request.created_by}
                          </div>
                          <div className="text-xs text-gray-500">
                            Votes: {request.votes}/{request.required}
                          </div>
                        </div>
                        <button
                          onClick={() => handleVoteRemoval(request.email)}
                          disabled={!canVote || whitelistLoading}
                          className="px-2 py-1 rounded border text-xs"
                          style={{
                            borderColor: "#333333",
                            color: canVote ? "#333333" : "#999999",
                            opacity: whitelistLoading ? 0.6 : 1,
                          }}
                          title={
                            canVote
                              ? "Vote to approve removal"
                              : "Already voted or not eligible"
                          }
                        >
                          {request.has_voted ? "Voted" : "Vote approve"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
      {/* Security Questions Setup Modal */}
      {showSecuritySetup && (
        <SecuritySetupModal
          onComplete={() => {
            setShowSecuritySetup(false);
            setAuthUser((prev) =>
              prev ? { ...prev, needsSecuritySetup: false } : prev,
            );
          }}
        />
      )}
    </div>
  );
}

export default App;
