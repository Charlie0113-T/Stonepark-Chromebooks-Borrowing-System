import React, { useEffect, useState, useRef } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { CalendarDays, MapPin } from "lucide-react";
import { AuthUser, createBooking, fetchBookings } from "../api";
import { CreateBookingPayload, Resource } from "../types";

/**
 * The signed-in teacher, for prefilling the borrower field. Read from storage
 * rather than threaded through props so the form stays usable anywhere.
 */
function currentUserName(): string {
  try {
    const raw = localStorage.getItem("auth_user");
    if (!raw) return "";
    const user = JSON.parse(raw) as AuthUser;
    return user.name || user.email || "";
  } catch {
    return "";
  }
}

interface BookingFormProps {
  resource: Resource;
  onSuccess: () => void;
  onCancel: () => void;
}

const BookingForm: React.FC<BookingFormProps> = ({
  resource,
  onSuccess,
  onCancel,
}) => {
  // Prefilled with the signed-in teacher — they are the borrower the vast
  // majority of the time, and retyping your own name on every booking is the
  // kind of small friction that makes staff avoid the system.
  const [borrower, setBorrower] = useState(currentUserName);
  const [borrowerClass, setBorrowerClass] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [startTime, setStartTime] = useState<Date | null>(new Date());
  const [endTime, setEndTime] = useState<Date | null>(
    new Date(Date.now() + 60 * 60 * 1000),
  );
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const startTimeInputRef = useRef<HTMLDivElement>(null);
  const endTimeInputRef = useRef<HTMLDivElement>(null);

  /**
   * How many units are free during the slot the teacher actually picked.
   *
   * `resource.availableNow` is availability *at this instant*, which is the
   * wrong bound for a future booking: a cabinet with 28 of 30 out right now
   * would cap tomorrow's booking at 2 even though it will be empty by then.
   * The server already checks the real window, so the form only needs to
   * agree with it.
   */
  const [availableForSlot, setAvailableForSlot] = useState<number | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  useEffect(() => {
    if (resource.type !== "cabinet" || !startTime || !endTime) {
      setAvailableForSlot(null);
      return;
    }
    if (startTime >= endTime) {
      setAvailableForSlot(null);
      return;
    }

    let cancelled = false;
    setCheckingAvailability(true);

    // Debounced: the date pickers fire on every keystroke and scroll tick.
    const timer = setTimeout(async () => {
      try {
        const overlapping = await fetchBookings({
          resourceId: resource.id,
          status: "active",
        });
        const start = startTime.getTime();
        const end = endTime.getTime();
        const booked = overlapping
          .filter((b) => {
            const bStart = new Date(b.startTime).getTime();
            const bEnd = new Date(b.endTime).getTime();
            return !(bEnd <= start || bStart >= end);
          })
          .reduce((sum, b) => sum + (b.quantity || 0), 0);
        if (!cancelled) {
          setAvailableForSlot(Math.max(0, resource.totalQuantity - booked));
        }
      } catch {
        // Fall back to no client-side cap; the server still enforces it.
        if (!cancelled) setAvailableForSlot(null);
      } finally {
        if (!cancelled) setCheckingAvailability(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [resource.id, resource.type, resource.totalQuantity, startTime, endTime]);

  const maxQuantity = availableForSlot ?? resource.totalQuantity;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!startTime || !endTime) {
      setError("Please select both start and end times.");
      return;
    }
    if (startTime >= endTime) {
      setError("End time must be after start time.");
      return;
    }

    const payload: CreateBookingPayload = {
      resourceId: resource.id,
      borrower: borrower.trim(),
      borrowerClass: borrowerClass.trim(),
      quantity: resource.type === "single" ? 1 : quantity,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      notes: notes.trim(),
    };

    try {
      setLoading(true);
      await createBooking(payload);
      onSuccess();
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        "Failed to create booking. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "sp-input";
  const labelClass = "sp-label";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Resource Info */}
      <div className="rounded-md border border-ink-200 bg-ink-50 p-3 text-sm">
        <p className="font-semibold text-purple-800">{resource.name}</p>
        <p className="text-ink-500 flex items-center gap-1.5">
          <MapPin size={14} strokeWidth={2} aria-hidden="true" />
          {resource.classRoom} ·{" "}
          {resource.type === "cabinet"
            ? "Charging Cabinet"
            : "Single Chromebook"}
        </p>
        {resource.type === "cabinet" && (
          <p className="text-ink-600 mt-1">
            Currently available: <strong>{resource.availableNow}</strong> of{" "}
            <strong>{resource.totalQuantity}</strong> units
          </p>
        )}
      </div>

      {/* Borrower Name */}
      <div>
        <label className={labelClass} htmlFor="borrower">
          Borrower Name *
        </label>
        <input
          id="borrower"
          type="text"
          required
          value={borrower}
          onChange={(e) => setBorrower(e.target.value)}
          placeholder="e.g. Ms. Johnson"
          className={inputClass}
        />
      </div>

      {/* Class */}
      <div>
        <label className={labelClass} htmlFor="borrowerClass">
          Class *
        </label>
        <input
          id="borrowerClass"
          type="text"
          required
          value={borrowerClass}
          onChange={(e) => setBorrowerClass(e.target.value)}
          placeholder="e.g. Year 7A"
          className={inputClass}
        />
      </div>

      {/* Quantity (cabinet only) */}
      {resource.type === "cabinet" && (
        <div>
          <label className={labelClass} htmlFor="quantity">
            Quantity *
          </label>
          <input
            id="quantity"
            type="number"
            required
            min={1}
            max={maxQuantity}
            value={quantity}
            onChange={(e) =>
              setQuantity(
                Math.max(
                  1,
                  Math.min(maxQuantity, parseInt(e.target.value, 10) || 1),
                ),
              )
            }
            className={inputClass}
          />
          <p className="text-xs text-ink-500 mt-1">
            {checkingAvailability ? (
              "Checking availability for this time…"
            ) : availableForSlot !== null ? (
              <>
                Available for the time you picked:{" "}
                <strong>{availableForSlot}</strong> of{" "}
                <strong>{resource.totalQuantity}</strong> units
              </>
            ) : (
              <>
                <strong>{resource.totalQuantity}</strong> units in this cabinet
              </>
            )}
          </p>
        </div>
      )}

      {/* Start Time */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <label className={labelClass} style={{ marginBottom: 0 }}>
            Start Time *
          </label>
          <button
            type="button"
            onClick={() => {
              const input = startTimeInputRef.current?.querySelector("input");
              input?.focus();
            }}
            className="text-purple-700 hover:text-purple-800 transition-colors"
            title="Open date picker"
          >
            <CalendarDays size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
        <div ref={startTimeInputRef}>
          <DatePicker
            selected={startTime}
            onChange={(date: Date | null) => setStartTime(date)}
            showTimeSelect
            dateFormat="Pp"
            className={`${inputClass} font-mono`}
            wrapperClassName="w-full"
            placeholderText="Select start time"
          />
        </div>
      </div>

      {/* End Time */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <label className={labelClass} style={{ marginBottom: 0 }}>
            End Time *
          </label>
          <button
            type="button"
            onClick={() => {
              const input = endTimeInputRef.current?.querySelector("input");
              input?.focus();
            }}
            className="text-purple-700 hover:text-purple-800 transition-colors"
            title="Open date picker"
          >
            <CalendarDays size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
        <div ref={endTimeInputRef}>
          <DatePicker
            selected={endTime}
            onChange={(date: Date | null) => setEndTime(date)}
            showTimeSelect
            dateFormat="Pp"
            minDate={startTime || undefined}
            className={`${inputClass} font-mono`}
            wrapperClassName="w-full"
            placeholderText="Select end time"
          />
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className={labelClass} htmlFor="notes">
          Notes
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Optional notes (e.g. Science project)"
          className={inputClass}
        />
      </div>

      {/* Error */}
      {error && <div className="sp-banner-alert">{error}</div>}

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="sp-btn-secondary flex-1"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="sp-btn-primary flex-1"
        >
          {loading ? "Booking…" : "Confirm Booking"}
        </button>
      </div>
    </form>
  );
};

export default BookingForm;
