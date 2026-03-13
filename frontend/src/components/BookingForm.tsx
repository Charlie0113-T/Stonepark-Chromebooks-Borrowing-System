import React, { useEffect, useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { createBooking } from '../api';
import { CreateBookingPayload, Resource } from '../types';

interface BookingFormProps {
  resource: Resource;
  onSuccess: () => void;
  onCancel: () => void;
}

const BookingForm: React.FC<BookingFormProps> = ({ resource, onSuccess, onCancel }) => {
  const [borrower, setBorrower] = useState('');
  const [borrowerClass, setBorrowerClass] = useState('');
  const [quantity, setQuantity] = useState(resource.type === 'single' ? 1 : 1);
  const [startTime, setStartTime] = useState<Date | null>(new Date());
  const [endTime, setEndTime] = useState<Date | null>(
    new Date(Date.now() + 60 * 60 * 1000)
  );
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setQuantity(resource.type === 'single' ? 1 : 1);
  }, [resource]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!startTime || !endTime) {
      setError('Please select both start and end times.');
      return;
    }
    if (startTime >= endTime) {
      setError('End time must be after start time.');
      return;
    }

    const payload: CreateBookingPayload = {
      resourceId: resource.id,
      borrower: borrower.trim(),
      borrowerClass: borrowerClass.trim(),
      quantity: resource.type === 'single' ? 1 : quantity,
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
        err.response?.data?.message || 'Failed to create booking. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 bg-[#f8f9fa]';
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Resource Info */}
      <div
        className="rounded p-3 text-sm"
        style={{ backgroundColor: '#f8f9fa', border: '1px solid #333333' }}
      >
        <p className="font-semibold text-gray-900">{resource.name}</p>
        <p className="text-gray-500">{resource.classRoom} · {resource.type === 'cabinet' ? 'Charging Cabinet' : 'Single Chromebook'}</p>
        {resource.type === 'cabinet' && (
          <p className="text-gray-600 mt-1">
            Currently available: <strong>{resource.availableNow}</strong> of{' '}
            <strong>{resource.totalQuantity}</strong> units
          </p>
        )}
      </div>

      {/* Borrower Name */}
      <div>
        <label className={labelClass} htmlFor="borrower">Borrower Name *</label>
        <input
          id="borrower"
          type="text"
          required
          value={borrower}
          onChange={(e) => setBorrower(e.target.value)}
          placeholder="e.g. Ms. Johnson"
          className={inputClass}
          style={{ borderColor: '#333333' }}
        />
      </div>

      {/* Class */}
      <div>
        <label className={labelClass} htmlFor="borrowerClass">Class *</label>
        <input
          id="borrowerClass"
          type="text"
          required
          value={borrowerClass}
          onChange={(e) => setBorrowerClass(e.target.value)}
          placeholder="e.g. Class 10A"
          className={inputClass}
          style={{ borderColor: '#333333' }}
        />
      </div>

      {/* Quantity (cabinet only) */}
      {resource.type === 'cabinet' && (
        <div>
          <label className={labelClass} htmlFor="quantity">
            Number of Chromebooks * (max {resource.availableNow})
          </label>
          <input
            id="quantity"
            type="number"
            required
            min={1}
            max={resource.availableNow}
            value={quantity}
            onChange={(e) => setQuantity(parseInt(e.target.value, 10))}
            className={inputClass}
            style={{ borderColor: '#333333' }}
          />
        </div>
      )}

      {/* Start Time */}
      <div>
        <label className={labelClass}>Start Time *</label>
        <DatePicker
          selected={startTime}
          onChange={(date: Date | null) => setStartTime(date)}
          showTimeSelect
          dateFormat="Pp"
          className={inputClass}
          wrapperClassName="w-full"
          placeholderText="Select start time"
        />
      </div>

      {/* End Time */}
      <div>
        <label className={labelClass}>End Time *</label>
        <DatePicker
          selected={endTime}
          onChange={(date: Date | null) => setEndTime(date)}
          showTimeSelect
          dateFormat="Pp"
          minDate={startTime || undefined}
          className={inputClass}
          wrapperClassName="w-full"
          placeholderText="Select end time"
        />
      </div>

      {/* Notes */}
      <div>
        <label className={labelClass} htmlFor="notes">Notes</label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Optional notes (e.g. Science project)"
          className={inputClass}
          style={{ borderColor: '#333333' }}
        />
      </div>

      {/* Error */}
      {error && (
        <div
          className="rounded p-3 text-sm font-medium"
          style={{ backgroundColor: '#f8d7da', color: '#dc3545', border: '1px solid #dc3545' }}
        >
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2 text-sm font-medium rounded border transition-colors hover:bg-gray-100"
          style={{ borderColor: '#333333', color: '#333333' }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 py-2 text-sm font-medium rounded transition-colors disabled:opacity-50"
          style={{ backgroundColor: '#333333', color: '#ffffff' }}
        >
          {loading ? 'Booking…' : 'Confirm Booking'}
        </button>
      </div>
    </form>
  );
};

export default BookingForm;
