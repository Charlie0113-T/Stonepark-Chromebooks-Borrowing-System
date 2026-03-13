import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from 'recharts';
import { Stats } from '../types';

interface StatsViewProps {
  stats: Stats;
}

const COLORS = ['#28a745', '#ffc107', '#dc3545'];

const StatsView: React.FC<StatsViewProps> = ({ stats }) => {
  const pieData = [
    { name: 'Available', value: stats.totalResources - stats.fullyBookedResources },
    { name: 'Fully Booked', value: stats.fullyBookedResources },
  ].filter((d) => d.value > 0);

  const barData = stats.resourceStats.map((r) => ({
    name: r.name.length > 12 ? r.name.slice(0, 12) + '…' : r.name,
    utilisation: r.utilisationPct,
    status:
      r.utilisationPct === 0
        ? 'available'
        : r.utilisationPct >= 100
        ? 'full'
        : 'partial',
  }));

  const barColor = (status: string) =>
    status === 'available' ? '#28a745' : status === 'full' ? '#dc3545' : '#ffc107';

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Resources', value: stats.totalResources, color: '#333333' },
          { label: 'Active Bookings', value: stats.activeBookings, color: '#ffc107' },
          { label: 'Returned', value: stats.returnedBookings, color: '#28a745' },
          { label: 'Fully Booked Now', value: stats.fullyBookedResources, color: '#dc3545' },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-lg border p-4 text-center"
            style={{ borderColor: '#333333', backgroundColor: '#f8f9fa' }}
          >
            <p className="text-2xl font-bold" style={{ color: card.color }}>
              {card.value}
            </p>
            <p className="text-xs text-gray-600 mt-1 font-medium">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Bar chart – utilisation per resource */}
      <div
        className="rounded-lg border p-4"
        style={{ borderColor: '#333333', backgroundColor: '#ffffff' }}
      >
        <h3 className="text-sm font-semibold text-gray-800 mb-3">
          Current Utilisation by Resource (%)
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={barData} margin={{ top: 5, right: 10, left: -20, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: '#555' }}
              angle={-30}
              textAnchor="end"
            />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#555' }} unit="%" />
            <Tooltip
              formatter={(value) => [`${value ?? 0}%`, 'Utilisation'] as [string, string]}
              contentStyle={{ fontSize: 12 }}
            />
            <Bar dataKey="utilisation" radius={[3, 3, 0, 0]}>
              {barData.map((entry, i) => (
                <Cell key={i} fill={barColor(entry.status)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Pie chart – resource availability split */}
      <div
        className="rounded-lg border p-4"
        style={{ borderColor: '#333333', backgroundColor: '#ffffff' }}
      >
        <h3 className="text-sm font-semibold text-gray-800 mb-3">
          Resource Availability Now
        </h3>
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={75}
              dataKey="value"
              label={({ name, percent }) =>
                `${name} ${Math.round((percent || 0) * 100)}%`
              }
              labelLine={false}
            >
              {pieData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Legend iconSize={10} iconType="circle" />
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Booking status table */}
      <div
        className="rounded-lg border overflow-hidden"
        style={{ borderColor: '#333333' }}
      >
        <table className="w-full text-sm">
          <thead style={{ backgroundColor: '#333333', color: '#ffffff' }}>
            <tr>
              <th className="text-left px-4 py-2 font-semibold">Resource</th>
              <th className="text-center px-4 py-2 font-semibold">Room</th>
              <th className="text-center px-4 py-2 font-semibold">In Use</th>
              <th className="text-center px-4 py-2 font-semibold">Available</th>
              <th className="text-center px-4 py-2 font-semibold">Utilisation</th>
            </tr>
          </thead>
          <tbody>
            {stats.resourceStats.map((r, i) => {
              const bgColor =
                r.utilisationPct === 0
                  ? '#f0fff4'
                  : r.utilisationPct >= 100
                  ? '#fff5f5'
                  : '#fffbf0';
              return (
                <tr
                  key={r.id}
                  style={{
                    backgroundColor: i % 2 === 0 ? bgColor : '#f8f9fa',
                    borderBottom: '1px solid #e5e7eb',
                  }}
                >
                  <td className="px-4 py-2 font-medium text-gray-900">{r.name}</td>
                  <td className="px-4 py-2 text-center text-gray-600">{r.classRoom}</td>
                  <td className="px-4 py-2 text-center">{r.currentBooked}</td>
                  <td className="px-4 py-2 text-center">{r.availableNow}</td>
                  <td className="px-4 py-2 text-center">
                    <span
                      className="font-semibold"
                      style={{
                        color:
                          r.utilisationPct === 0
                            ? '#28a745'
                            : r.utilisationPct >= 100
                            ? '#dc3545'
                            : '#856404',
                      }}
                    >
                      {r.utilisationPct}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StatsView;
