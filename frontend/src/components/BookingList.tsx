import React, { useEffect, useState } from "react";
import {
  cancelBooking,
  fetchBookings,
  fetchResourceHistory,
  returnBooking,
} from "../api";
import { Booking, Resource, ResourceHistoryEntry } from "../types";
import { format } from "date-fns";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileText,
  Package,
  RotateCcw,
  X,
} from "lucide-react";

/** Maps the stored field name to what a teacher would call it. */
const FIELD_LABELS: Record<string, string> = {
  name: "Name",
  classRoom: "Address",
  description: "Description",
};

/** Status pill classes from the design system. */
const STATUS_PILL: Record<string, string> = {
  active: "sp-pill-success",
  returned: "sp-pill bg-ink-100 text-ink-600",
  cancelled: "sp-pill-alert",
};

interface BookingListProps {
  resource: Resource;
  onClose: () => void;
  onStatusChange: () => void;
}

const BookingList: React.FC<BookingListProps> = ({
  resource,
  onClose,
  onStatusChange,
}) => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [historyEntries, setHistoryEntries] = useState<ResourceHistoryEntry[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const [bookingData, historyData] = await Promise.all([
        fetchBookings({ resourceId: resource.id }),
        fetchResourceHistory(resource.id),
      ]);
      setBookings(bookingData);
      setHistoryEntries(historyData);
    } catch {
      setLoadError("Could not load history. Please close and try again.");
      setBookings([]);
      setHistoryEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource.id]);

  const handleReturn = async (id: string) => {
    try {
      setActionId(id);
      await returnBooking(id);
      await load();
      onStatusChange();
    } catch (err: any) {
      setLoadError(
        err?.response?.data?.message || "Operation failed. Please try again.",
      );
    } finally {
      setActionId(null);
    }
  };

  const handleCancel = async (id: string) => {
    if (!window.confirm("Cancel this booking?")) return;
    try {
      setActionId(id);
      await cancelBooking(id);
      await load();
      onStatusChange();
    } catch (err: any) {
      setLoadError(
        err?.response?.data?.message || "Operation failed. Please try again.",
      );
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
    <div className="space-y-3">
      <h3 className="sp-rule-gold inline-block pb-1 font-bold text-purple-800 text-base">
        History — {resource.name}
      </h3>
      {loadError && <div className="sp-banner-alert">{loadError}</div>}
      {loading ? (
        <p className="text-sm text-ink-500">Loading…</p>
      ) : (
        <>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-600 mb-2">
              Changes
            </p>
            {historyEntries.length === 0 ? (
              <p className="text-sm text-ink-500">No changes recorded yet.</p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {historyEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-md border border-ink-200 bg-ink-50 p-3 text-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-ink-800">
                        {FIELD_LABELS[entry.field] || entry.field} updated
                      </p>
                      <span className="text-xs text-ink-500 font-mono">
                        {fmtDt(entry.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-ink-500 mt-1">
                      By {entry.changedBy || "Unknown user"}
                    </p>
                    <div className="mt-2 text-xs text-ink-700 space-y-1">
                      <p>
                        <span className="font-semibold">From:</span>{" "}
                        {entry.oldValue || "(empty)"}
                      </p>
                      <p>
                        <span className="font-semibold">To:</span>{" "}
                        {entry.newValue || "(empty)"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-600 mb-2">
              Bookings
            </p>
            {bookings.length === 0 ? (
              <p className="text-sm text-ink-500">
                No bookings found for this resource.
              </p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {bookings.map((b) => (
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
                      </div>
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
                    <div className="mt-2 text-xs text-ink-600 grid grid-cols-2 gap-x-4 gap-y-0.5">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays
                          size={14}
                          strokeWidth={2}
                          aria-hidden="true"
                        />
                        <span className="font-mono">{fmtDt(b.startTime)}</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Clock size={14} strokeWidth={2} aria-hidden="true" />
                        <span className="font-mono">{fmtDt(b.endTime)}</span>
                      </span>
                      {b.quantity > 1 && (
                        <span className="inline-flex items-center gap-1.5">
                          <Package
                            size={14}
                            strokeWidth={2}
                            aria-hidden="true"
                          />
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
                          <FileText
                            size={14}
                            strokeWidth={2}
                            aria-hidden="true"
                          />
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
                ))}
              </div>
            )}
          </div>
        </>
      )}
      <button onClick={onClose} className="sp-btn-secondary w-full">
        Close
      </button>
    </div>
  );
};

export default BookingList;
