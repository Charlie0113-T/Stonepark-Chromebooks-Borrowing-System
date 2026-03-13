import React, { useCallback, useEffect, useState } from 'react';
import './App.css';
import { fetchResources, fetchStats } from './api';
import BookingForm from './components/BookingForm';
import BookingList from './components/BookingList';
import Modal from './components/Modal';
import ResourceCard from './components/ResourceCard';
import StatsView from './components/StatsView';
import { StatusDot } from './components/StatusBadge';
import { Resource, Stats } from './types';

type Tab = 'dashboard' | 'stats';

function App() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('dashboard');

  // Modal states
  const [bookingResource, setBookingResource] = useState<Resource | null>(null);
  const [historyResource, setHistoryResource] = useState<Resource | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filter
  const [filter, setFilter] = useState<'all' | 'cabinet' | 'single'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'partial' | 'full'>('all');

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [res, st] = await Promise.all([fetchResources(), fetchStats()]);
      setResources(res);
      setStats(st);
    } catch {
      setError('Failed to load data. Make sure the backend is running on port 4000.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // auto-refresh every 30s
    return () => clearInterval(interval);
  }, [loadData]);

  const handleBookSuccess = async () => {
    setBookingResource(null);
    setSuccessMsg('Booking created successfully!');
    setTimeout(() => setSuccessMsg(null), 4000);
    await loadData();
  };

  const filteredResources = resources.filter((r) => {
    if (filter !== 'all' && r.type !== filter) return false;
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    return true;
  });

  const tabClass = (t: Tab) =>
    `px-5 py-2.5 text-sm font-semibold rounded-t border-b-2 transition-colors ${
      tab === t
        ? 'border-gray-900 text-gray-900 bg-white'
        : 'border-transparent text-gray-500 hover:text-gray-700 bg-transparent'
    }`;

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f8f9fa', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <header style={{ backgroundColor: '#333333', color: '#ffffff' }}>
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              🎓 Stonepark Chromebook Manager
            </h1>
            <p className="text-xs text-gray-300 mt-0.5">Borrowing &amp; Reservation System</p>
          </div>
          {stats && (
            <div className="hidden sm:flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <StatusDot status="available" />
                <span className="text-gray-200">
                  {stats.resourceStats.filter((r) => r.utilisationPct === 0).length} Free
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <StatusDot status="partial" />
                <span className="text-gray-200">
                  {stats.resourceStats.filter((r) => r.utilisationPct > 0 && r.utilisationPct < 100).length} Partial
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <StatusDot status="full" />
                <span className="text-gray-200">{stats.fullyBookedResources} Full</span>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex gap-1 mt-4" style={{ borderBottom: '1px solid #333333' }}>
          <button className={tabClass('dashboard')} onClick={() => setTab('dashboard')}>
            📋 Dashboard
          </button>
          <button className={tabClass('stats')} onClick={() => setTab('stats')}>
            📊 Statistics
          </button>
        </div>
      </div>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Success toast */}
        {successMsg && (
          <div
            className="mb-4 rounded px-4 py-3 text-sm font-medium"
            style={{ backgroundColor: '#d4edda', color: '#28a745', border: '1px solid #28a745' }}
          >
            ✅ {successMsg}
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div
            className="mb-4 rounded px-4 py-3 text-sm font-medium"
            style={{ backgroundColor: '#f8d7da', color: '#dc3545', border: '1px solid #dc3545' }}
          >
            ⚠️ {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 text-gray-500">Loading resources…</div>
        ) : tab === 'dashboard' ? (
          <>
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Type:</label>
                {(['all', 'cabinet', 'single'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className="px-3 py-1 rounded border text-xs font-medium transition-colors capitalize"
                    style={{
                      borderColor: '#333333',
                      backgroundColor: filter === f ? '#333333' : 'transparent',
                      color: filter === f ? '#ffffff' : '#333333',
                    }}
                  >
                    {f === 'all' ? 'All' : f === 'cabinet' ? '⚡ Cabinet' : '💻 Single'}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Status:</label>
                {(['all', 'available', 'partial', 'full'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className="px-3 py-1 rounded border text-xs font-medium transition-colors capitalize"
                    style={{
                      borderColor: '#333333',
                      backgroundColor: statusFilter === s ? '#333333' : 'transparent',
                      color: statusFilter === s ? '#ffffff' : '#333333',
                    }}
                  >
                    {s === 'all'
                      ? 'All'
                      : s === 'available'
                      ? '🟢 Available'
                      : s === 'partial'
                      ? '🟡 Partial'
                      : '🔴 Full'}
                  </button>
                ))}
              </div>
              <span className="ml-auto text-xs text-gray-500">
                {filteredResources.length} resource{filteredResources.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Resource Grid */}
            {filteredResources.length === 0 ? (
              <p className="text-center text-gray-500 py-10">No resources match the current filter.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredResources.map((resource) => (
                  <ResourceCard
                    key={resource.id}
                    resource={resource}
                    onBook={setBookingResource}
                    onViewBookings={setHistoryResource}
                  />
                ))}
              </div>
            )}

            {/* Legend */}
            <div className="mt-6 flex flex-wrap gap-4 justify-center text-xs text-gray-600">
              {[
                { color: '#28a745', label: 'Available (Green) — Free to borrow' },
                { color: '#ffc107', label: 'Partial (Yellow) — Partially occupied' },
                { color: '#dc3545', label: 'Full (Red) — Fully booked' },
              ].map((item) => (
                <span key={item.label} className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  {item.label}
                </span>
              ))}
            </div>
          </>
        ) : (
          stats && <StatsView stats={stats} />
        )}
      </main>

      {/* Footer */}
      <footer className="text-center text-xs text-gray-400 py-6 mt-8">
        Stonepark Secondary School — Chromebook Borrowing System
      </footer>

      {/* Booking Modal */}
      {bookingResource && (
        <Modal title={`Book ${bookingResource.name}`} onClose={() => setBookingResource(null)}>
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
    </div>
  );
}

export default App;
