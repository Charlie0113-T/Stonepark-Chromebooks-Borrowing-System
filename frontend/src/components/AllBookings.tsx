import React, { useCallback, useEffect, useState } from "react";
import {
  cancelBooking,
  fetchBookings,
  fetchResources,
  returnBooking,
} from "../api";
import { Booking, BookingStatus, Resource } from "../types";
import { format } from "date-fns";

interface AllBookingsProps {
  onStatusChange: () => void;
}

const AllBookings: React.FC<AllBookingsProps> = ({ onStatusChange }) => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [statusFilter, setStatusFilter] = useState<"all" | BookingStatus>(
    "all",
  );
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const resourceMap = React.useMemo(() => {
    const map: Record<string, Resource> = {};
    resources.forEach((r) => (map[r.id] = r));
    return map;
  }, [resources]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (statusFilter !== "all") params.status = statusFilter;
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      const [fetchedBookings, fetchedResources] = await Promise.all([
        fetchBookings(params),
        fetchResources(),
      ]);
      setBookings(fetchedBookings);
      setResources(fetchedResources);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, debouncedSearch]);

  useEffect(() => {
    load();
  }, [load]);

  const handleReturn = async (id: string) => {
    try {
      setActionId(id);
      setActionError(null);
      await returnBooking(id);
      await load();
      onStatusChange();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        "Failed to return booking. Please try again.";
      setActionError(msg);
    } finally {
      setActionId(null);
    }
  };

  const handleCancel = async (id: string) => {
    if (!window.confirm("Cancel this booking?")) return;
    try {
      setActionId(id);
      setActionError(null);
      await cancelBooking(id);
      await load();
      onStatusChange();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        "Failed to cancel booking. Please try again.";
      setActionError(msg);
    } finally {
      setActionId(null);
    }
  };

  const fmtDt = (iso: string) => {
    try {
      return format(new Date(iso), "MMM d, HH:mm");
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-4">
      {/* Action error */}
      {actionError && (
        <div
          className="rounded px-4 py-3 text-sm font-medium"
          style={{
            backgroundColor: "#f8d7da",
            color: "#dc3545",
            border: "1px solid #dc3545",
          }}
        >
          ⚠️ {actionError}
        </div>
      )}

      {/* Search */}
      <div>
        <input
          type="text"
          placeholder="🔍 Search by borrower name or class…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
          style={{ borderColor: "#333333", backgroundColor: "#ffffff" }}
        />
      </div>

      {/* Status filters */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm font-medium text-gray-700">Status:</label>
        {(["all", "active", "returned", "cancelled"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className="px-3 py-1 rounded border text-xs font-medium transition-colors capitalize"
            style={{
              borderColor: "#333333",
              backgroundColor: statusFilter === s ? "#333333" : "transparent",
              color: statusFilter === s ? "#ffffff" : "#333333",
            }}
          >
            {s === "all" ? "All" : s}
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-500">
          {bookings.length} booking{bookings.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Bookings list */}
      {loading ? (
        <p className="text-sm text-gray-500 text-center py-10">
          Loading bookings…
        </p>
      ) : bookings.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-10">
          No bookings found.
        </p>
      ) : (
        <div className="space-y-2">
          {bookings.map((b) => {
            const res = resourceMap[b.resourceId];
            return (
              <div
                key={b.id}
                className="rounded border p-3 text-sm"
                style={{ borderColor: "#333333", backgroundColor: "#f8f9fa" }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {b.borrower}
                    </p>
                    <p className="text-gray-500 text-xs">{b.borrowerClass}</p>
                    {res && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        📦 {res.name} — {res.classRoom}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold capitalize"
                      style={{
                        backgroundColor:
                          b.status === "active"
                            ? "#d4edda"
                            : b.status === "returned"
                              ? "#e2e3e5"
                              : "#f8d7da",
                        color:
                          b.status === "active"
                            ? "#28a745"
                            : b.status === "returned"
                              ? "#383d41"
                              : "#dc3545",
                      }}
                    >
                      {b.status}
                    </span>
                    {b.isOverdue && (
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={{ backgroundColor: "#f8d7da", color: "#dc3545" }}
                      >
                        ⏰ Overdue
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-2 text-xs text-gray-600 grid grid-cols-2 gap-x-4 gap-y-0.5">
                  <span>📅 {fmtDt(b.startTime)}</span>
                  <span>🏁 {fmtDt(b.endTime)}</span>
                  {b.quantity > 1 && <span>📦 Qty: {b.quantity}</span>}
                  {b.actualReturnTime && (
                    <span className="col-span-2">
                      ✅ Returned: {fmtDt(b.actualReturnTime)}
                    </span>
                  )}
                  {b.notes && <span className="col-span-2">📝 {b.notes}</span>}
                </div>
                <div className="flex gap-2 mt-2">
                  {b.status === "active" && (
                    <>
                      <button
                        onClick={() => handleReturn(b.id)}
                        disabled={actionId === b.id}
                        className="px-3 py-1 rounded text-xs font-medium transition-colors disabled:opacity-50"
                        style={{ backgroundColor: "#28a745", color: "#ffffff" }}
                      >
                        Return
                      </button>
                      <button
                        onClick={() => handleCancel(b.id)}
                        disabled={actionId === b.id}
                        className="px-3 py-1 rounded text-xs font-medium transition-colors disabled:opacity-50"
                        style={{ backgroundColor: "#dc3545", color: "#ffffff" }}
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AllBookings;
