import React, { useCallback, useEffect, useState } from 'react';
import { Calendar, momentLocalizer, Event } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { AlertTriangle, X } from 'lucide-react';
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

// Design-system event colours: purple ink for live bookings, the status
// trio's green for returned, alert red for overdue, neutral for cancelled.
const STATUS_COLORS: Record<string, string> = {
  active: '#2A166F',
  returned: '#1E7A4C',
  cancelled: '#9994AA',
};

const OVERDUE_COLOR = '#C0271F';

export default function CalendarView() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  /**
   * Tracked live rather than measured once on mount: teachers rotate iPads
   * and use split view, and a calendar frozen at 11px in a landscape layout
   * (or crushed into a 320px column after rotating back) is the result.
   */
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 640
  );

  useEffect(() => {
    const query = window.matchMedia('(max-width: 639px)');
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const [view, setView] = useState<'month' | 'week' | 'day' | 'agenda'>(
    typeof window !== 'undefined' && window.innerWidth < 640 ? 'day' : 'week'
  );

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
      setLoadError(
        'Could not load bookings. The server may still be waking up — please try again in a moment.'
      );
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
      : STATUS_COLORS[event.status] || '#2A166F';
    return {
      style: {
        backgroundColor: bgColor,
        color: '#ffffff',
        borderRadius: '3px',
        border: 'none',
        fontSize: '12px',
        padding: '1px 4px',
        opacity: event.status === 'cancelled' ? 0.5 : 1,
      },
    };
  };

  if (loading) {
    return <div className="text-center py-20 text-ink-500">Loading calendar…</div>;
  }

  if (loadError) {
    return (
      <div className="sp-banner-alert flex items-center gap-2">
        <AlertTriangle size={16} strokeWidth={2} aria-hidden="true" />
        {loadError}
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-600">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: STATUS_COLORS.active }} />
            Active
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: OVERDUE_COLOR }} />
            Overdue
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: STATUS_COLORS.returned }} />
            Returned
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: STATUS_COLORS.cancelled }} />
            Cancelled
          </span>
        </div>
        <span className="ml-auto text-xs text-ink-500">{events.length} bookings</span>
      </div>

      <div className="overflow-x-auto -mx-4 sm:mx-0">
        <div style={{ minWidth: 320, height: isMobile ? 400 : 560 }} className="px-4 sm:px-0">
          <Calendar<CalendarEvent>
            localizer={localizer}
            events={events}
            view={view}
            onView={(v) => setView(v as 'month' | 'week' | 'day' | 'agenda')}
            views={['month', 'week', 'day', 'agenda']}
            defaultDate={new Date()}
            eventPropGetter={eventStyleGetter}
            onSelectEvent={(event) => setSelectedEvent(event)}
            popup
            style={{ fontFamily: "'Source Sans 3', system-ui, sans-serif", fontSize: isMobile ? 11 : 13 }}
          />
        </div>
      </div>

      {/* Event detail panel */}
      {selectedEvent && (
        <div className="mt-4 p-4 rounded-md border border-ink-200 bg-white text-sm shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <strong className="text-purple-800">{selectedEvent.title}</strong>
            <button
              onClick={() => setSelectedEvent(null)}
              className="text-ink-400 hover:text-ink-600 transition-colors"
              aria-label="Close"
            >
              <X size={16} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-ink-700">
            <span className="font-medium">Resource:</span><span>{selectedEvent.resourceName}</span>
            <span className="font-medium">Borrower:</span><span>{selectedEvent.borrower}</span>
            <span className="font-medium">Start:</span><span className="font-mono">{new Date(selectedEvent.start as Date).toLocaleString()}</span>
            <span className="font-medium">End:</span><span className="font-mono">{new Date(selectedEvent.end as Date).toLocaleString()}</span>
            <span className="font-medium">Status:</span>
            <span className={selectedEvent.isOverdue ? 'text-status-alert-fg font-semibold inline-flex items-center gap-1' : 'capitalize'}>
              {selectedEvent.isOverdue ? (
                <>
                  <AlertTriangle size={14} strokeWidth={2} aria-hidden="true" />
                  Overdue
                </>
              ) : (
                selectedEvent.status
              )}
            </span>
            <span className="font-medium">Booking ID:</span>
            <span className="font-mono text-xs text-ink-500 break-all">{selectedEvent.bookingId}</span>
          </div>
        </div>
      )}
    </div>
  );
}
