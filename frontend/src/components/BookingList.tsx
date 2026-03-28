import React, { useEffect, useState } from "react";
import { cancelBooking, fetchBookings, returnBooking } from "../api";
import { Booking, Resource } from "../types";
import { format } from "date-fns";

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
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const data = await fetchBookings({ resourceId: resource.id });
      setBookings(data);
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
      alert(
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
      alert(
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
      <h3 className="font-semibold text-gray-900 text-base">
        Bookings — {resource.name}
      </h3>
      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : bookings.length === 0 ? (
        <p className="text-sm text-gray-500">
          No bookings found for this resource.
        </p>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {bookings.map((b) => (
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
                </div>
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
          ))}
        </div>
      )}
      <button
        onClick={onClose}
        className="w-full py-2 text-sm font-medium rounded border transition-colors hover:bg-gray-100"
        style={{ borderColor: "#333333", color: "#333333" }}
      >
        Close
      </button>
    </div>
  );
};

export default BookingList;
