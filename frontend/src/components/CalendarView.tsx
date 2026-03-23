import React, { useCallback, useEffect, useState } from 'react';
import { Calendar, momentLocalizer, Event } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { fetchBookings, fetchResources } from '../api';
import { Booking } from '../types';

const localizer = momentLocalizer(moment);

interface CalendarEvent extends Event {
  bookingId: string;
  resourceName: string;
  borrower: string;
  status: string;
  isOverdue: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  active: '#333333',
  returned: '#28a745',
  cancelled: '#adb5bd',
};

const OVERDUE_COLOR = '#dc3545';

export default function CalendarView() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [view, setView] = useState<'month' | 'week' | 'day'>('week');

  const loadData = useCallback(async () => {
    try {
      const [bookings, res] = await Promise.all([fetchBookings(), fetchResources()]);
      const resourceMap: Record<string, string> = {};
      res.forEach((r) => (resourceMap[r.id] = r.name));

      const calEvents: CalendarEvent[] = bookings.map((b: Booking) => ({
        bookingId: b.id,
        title: `${resourceMap[b.resourceId] || b.resourceId} – ${b.borrower}`,
        start: new Date(b.startTime),
        end: new Date(b.endTime),
        resourceName: resourceMap[b.resourceId] || b.resourceId,
        borrower: b.borrower,
        status: b.status,
        isOverdue: b.isOverdue || false,
      }));
      setEvents(calEvents);
    } catch (err) {
      setLoadError('Failed to load bookings. Please check the backend connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const eventStyleGetter = (event: CalendarEvent) => {
    const bgColor = event.isOverdue
      ? OVERDUE_COLOR
      : STATUS_COLORS[event.status] || '#333333';
    return {
      style: {
        backgroundColor: bgColor,
        color: '#fff',
        borderRadius: '4px',
        border: 'none',
        fontSize: '12px',
        padding: '1px 4px',
        opacity: event.status === 'cancelled' ? 0.5 : 1,
      },
    };
  };

  if (loading) {
    return <div className="text-center py-20 text-gray-500">Loading calendar…</div>;
  }

  if (loadError) {
    return (
      <div
        className="rounded px-4 py-3 text-sm font-medium"
        style={{ backgroundColor: '#f8d7da', color: '#dc3545', border: '1px solid #dc3545' }}
      >
        ⚠️ {loadError}
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded inline-block" style={{ backgroundColor: STATUS_COLORS.active }} />
            Active
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded inline-block" style={{ backgroundColor: OVERDUE_COLOR }} />
            Overdue
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded inline-block" style={{ backgroundColor: STATUS_COLORS.returned }} />
            Returned
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded inline-block" style={{ backgroundColor: STATUS_COLORS.cancelled }} />
            Cancelled
          </span>
        </div>
        <span className="ml-auto text-xs text-gray-500">{events.length} bookings</span>
      </div>

      <div style={{ height: 560 }}>
        <Calendar<CalendarEvent>
          localizer={localizer}
          events={events}
          view={view}
          onView={(v) => setView(v as 'month' | 'week' | 'day')}
          views={['month', 'week', 'day']}
          defaultDate={new Date()}
          eventPropGetter={eventStyleGetter}
          onSelectEvent={(event) => setSelectedEvent(event)}
          popup
          style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
        />
      </div>

      {/* Event detail panel */}
      {selectedEvent && (
        <div
          className="mt-4 p-4 rounded border text-sm"
          style={{ borderColor: '#333333', backgroundColor: '#fff' }}
        >
          <div className="flex items-center justify-between mb-2">
            <strong>{selectedEvent.title}</strong>
            <button
              onClick={() => setSelectedEvent(null)}
              className="text-gray-400 hover:text-gray-600 text-lg leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-700">
            <span className="font-medium">Resource:</span><span>{selectedEvent.resourceName}</span>
            <span className="font-medium">Borrower:</span><span>{selectedEvent.borrower}</span>
            <span className="font-medium">Start:</span><span>{new Date(selectedEvent.start as Date).toLocaleString()}</span>
            <span className="font-medium">End:</span><span>{new Date(selectedEvent.end as Date).toLocaleString()}</span>
            <span className="font-medium">Status:</span>
            <span className={selectedEvent.isOverdue ? 'text-red-600 font-semibold' : ''}>
              {selectedEvent.isOverdue ? '⚠️ Overdue' : selectedEvent.status}
            </span>
            <span className="font-medium">Booking ID:</span>
            <span className="font-mono text-xs text-gray-500 break-all">{selectedEvent.bookingId}</span>
          </div>
        </div>
      )}
    </div>
  );
}
