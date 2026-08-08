import React, { useCallback, useEffect, useState } from "react";
import {
  cancelBooking,
  fetchBookings,
  fetchResources,
  returnBooking,
} from "../api";
import { Booking, BookingStatus, Resource } from "../types";
import { format } from "date-fns";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileText,
  MapPin,
  Package,
  RotateCcw,
  Search,
  X,
} from "lucide-react";

/** Status pill classes from the design system. */
const STATUS_PILL: Record<string, string> = {
  active: "sp-pill-success",
  returned: "sp-pill bg-ink-100 text-ink-600",
  cancelled: "sp-pill-alert",
};

interface AllBookingsProps {
  onStatusChange: () => void;
  refreshTrigger?: number;
}

const AllBookings: React.FC<AllBookingsProps> = ({
  onStatusChange,
  refreshTrigger,
}) => {
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
  const [loadError, setLoadError] = useState<string | null>(null);

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
      setLoadError(null);
      const params: Record<string, string> = {};
      if (statusFilter !== "all") params.status = statusFilter;
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      const [fetchedBookings, fetchedResources] = await Promise.all([
        fetchBookings(params),
        fetchResources(),
      ]);
      setBookings(fetchedBookings);
      setResources(fetchedResources);
    } catch {
      // Without this the list falls through to "No bookings found", which
      // reads as "your booking is gone" rather than "the request failed".
      setLoadError(
        "Could not load bookings. The server may still be waking up — please try again in a moment.",
      );
      setBookings([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, debouncedSearch, refreshTrigger]);

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
        <div className="sp-banner-alert flex items-center gap-2">
          <AlertTriangle size={16} strokeWidth={2} aria-hidden="true" />
          {actionError}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search
          size={16}
          strokeWidth={2}
          aria-hidden="true"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none"
        />
        <input
          type="text"
          placeholder="Search by borrower name or class…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sp-input pl-9"
        />
      </div>

      {/* Status filters */}
      <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-1">
        <label className="text-sm font-medium text-ink-700">Status:</label>
        {(["all", "active", "returned", "cancelled"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-sm border text-xs font-medium transition-colors capitalize ${
              statusFilter === s
                ? "border-purple-700 bg-purple-700 text-white"
                : "border-ink-300 bg-white text-ink-600 hover:bg-purple-50"
            }`}
          >
            {s === "all" ? "All" : s}
          </button>
        ))}
        <span className="ml-auto text-xs text-ink-500">
          {bookings.length} booking{bookings.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Load error */}
      {loadError && (
        <div className="sp-banner-alert flex items-center gap-2">
          <AlertTriangle size={16} strokeWidth={2} aria-hidden="true" />
          {loadError}
        </div>
      )}

      {/* Bookings list */}
      {loading ? (
        <p className="text-sm text-ink-500 text-center py-10">
          Loading bookings…
        </p>
      ) : bookings.length === 0 ? (
        <p className="text-sm text-ink-500 text-center py-10">
          No bookings found.
        </p>
      ) : (
        <div className="space-y-2">
          {bookings.map((b) => {
            const res = resourceMap[b.resourceId];
            return (
              <div
                key={b.id}
                className="rounded-md border border-ink-200 bg-white p-3 text-sm shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-ink-800 truncate">
                      {b.borrower}
                    </p>
                    <p className="text-ink-500 text-xs">{b.borrowerClass}</p>
                    {res && (
                      <p className="text-xs text-ink-500 mt-0.5 inline-flex items-center gap-1.5">
                        <MapPin size={14} strokeWidth={2} aria-hidden="true" />
                        {res.name} — {res.classRoom}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-1">
                    <span
                      className={`${
                        STATUS_PILL[b.status] || "sp-pill-info"
                      } capitalize`}
                    >
                      {b.status}
                    </span>
                    {b.isOverdue && (
                      <span className="sp-pill-alert inline-flex items-center gap-1">
                        <AlertTriangle
                          size={14}
                          strokeWidth={2}
                          aria-hidden="true"
                        />
                        Overdue
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-2 text-xs text-ink-600 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays size={14} strokeWidth={2} aria-hidden="true" />
                    <span className="font-mono">{fmtDt(b.startTime)}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock size={14} strokeWidth={2} aria-hidden="true" />
                    <span className="font-mono">{fmtDt(b.endTime)}</span>
                  </span>
                  {b.quantity > 1 && (
                    <span className="inline-flex items-center gap-1.5">
                      <Package size={14} strokeWidth={2} aria-hidden="true" />
                      Qty: <span className="font-mono">{b.quantity}</span>
                    </span>
                  )}
                  {b.actualReturnTime && (
                    <span className="col-span-2 inline-flex items-center gap-1.5">
                      <CheckCircle2
                        size={14}
                        strokeWidth={2}
                        aria-hidden="true"
                      />
                      Returned:{" "}
                      <span className="font-mono">
                        {fmtDt(b.actualReturnTime)}
                      </span>
                    </span>
                  )}
                  {b.notes && (
                    <span className="col-span-2 inline-flex items-center gap-1.5">
                      <FileText size={14} strokeWidth={2} aria-hidden="true" />
                      {b.notes}
                    </span>
                  )}
                </div>
                <div className="flex gap-2 mt-2">
                  {b.status === "active" && (
                    <>
                      <button
                        onClick={() => handleReturn(b.id)}
                        disabled={actionId === b.id}
                        className="sp-btn-primary sp-btn-sm inline-flex items-center gap-1.5"
                      >
                        <RotateCcw
                          size={14}
                          strokeWidth={2}
                          aria-hidden="true"
                        />
                        Return
                      </button>
                      <button
                        onClick={() => handleCancel(b.id)}
                        disabled={actionId === b.id}
                        className="sp-btn-danger sp-btn-sm inline-flex items-center gap-1.5"
                      >
                        <X size={14} strokeWidth={2} aria-hidden="true" />
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
