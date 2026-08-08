import React from "react";
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
} from "recharts";
import { Stats } from "../types";

interface StatsViewProps {
  stats: Stats;
}

// Design-system status trio (utilisation / availability charts)
const STATUS_GREEN = "#1E7A4C";
const STATUS_AMBER = "#E08A00";
const STATUS_RED = "#C0271F";

// Chart chrome
const GRID_STROKE = "#DDD9E5";
const AXIS_TEXT = "#726B87";
const CHART_FONT = "'Source Sans 3', sans-serif";

const TOOLTIP_STYLE: React.CSSProperties = {
  fontSize: 12,
  fontFamily: CHART_FONT,
  backgroundColor: "#FFFFFF",
  border: `1px solid ${GRID_STROKE}`,
  borderRadius: 6,
  boxShadow: "0 2px 8px rgba(42, 22, 111, 0.12)",
};

const PIE_COLORS = [STATUS_GREEN, STATUS_RED];

const StatsView: React.FC<StatsViewProps> = ({ stats }) => {
  const pieData = [
    {
      name: "Available",
      value: stats.totalResources - stats.fullyBookedResources,
    },
    { name: "Fully Booked", value: stats.fullyBookedResources },
  ].filter((d) => d.value > 0);

  const barData = stats.resourceStats.map((r) => ({
    name: r.name.length > 12 ? r.name.slice(0, 12) + "…" : r.name,
    utilisation: r.utilisationPct,
    status:
      r.utilisationPct === 0
        ? "available"
        : r.utilisationPct >= 100
          ? "full"
          : "partial",
  }));

  const barColor = (status: string) =>
    status === "available"
      ? STATUS_GREEN
      : status === "full"
        ? STATUS_RED
        : STATUS_AMBER;

  const utilisationTextClass = (pct: number) =>
    pct === 0
      ? "text-status-success-fg"
      : pct >= 100
        ? "text-status-alert-fg"
        : "text-status-warning-fg";

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: "Resources", value: stats.totalResources },
          { label: "Total Chromebooks", value: stats.totalChromebooks },
          { label: "Active Bookings", value: stats.activeBookings },
          ...(stats.overdueBookings > 0
            ? [{ label: "Overdue", value: stats.overdueBookings }]
            : []),
          { label: "Returned", value: stats.returnedBookings },
          { label: "Fully Booked Now", value: stats.fullyBookedResources },
        ].map((card) => (
          <div key={card.label} className="sp-card-gold p-4 text-center">
            <p className="font-mono text-2xl font-semibold text-purple-800">
              {card.value}
            </p>
            <p className="text-xs uppercase tracking-wide text-ink-500 mt-1">
              {card.label}
            </p>
          </div>
        ))}
      </div>

      {/* Bar chart – utilisation per resource */}
      <div className="sp-card p-4">
        <h3 className="sp-rule-gold inline-block pb-1 text-sm font-semibold text-purple-800 mb-3">
          Current Utilisation by Resource (%)
        </h3>
        <div className="overflow-x-auto -mx-2">
          <div style={{ minWidth: 280 }} className="px-2">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={barData}
                margin={{ top: 5, right: 10, left: -20, bottom: 40 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                <XAxis
                  dataKey="name"
                  tick={{
                    fontSize: 12,
                    fill: AXIS_TEXT,
                    fontFamily: CHART_FONT,
                  }}
                  angle={-30}
                  textAnchor="end"
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{
                    fontSize: 12,
                    fill: AXIS_TEXT,
                    fontFamily: CHART_FONT,
                  }}
                  unit="%"
                />
                <Tooltip
                  formatter={(value) =>
                    [`${value ?? 0}%`, "Utilisation"] as [string, string]
                  }
                  contentStyle={TOOLTIP_STYLE}
                />
                <Bar dataKey="utilisation" radius={[3, 3, 0, 0]}>
                  {barData.map((entry, i) => (
                    <Cell key={i} fill={barColor(entry.status)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Pie chart – resource availability split */}
      <div className="sp-card p-4">
        <h3 className="sp-rule-gold inline-block pb-1 text-sm font-semibold text-purple-800 mb-3">
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
                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Legend
              iconSize={10}
              iconType="circle"
              wrapperStyle={{ fontSize: 12, fontFamily: CHART_FONT }}
            />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Booking status table */}
      <div className="sp-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="bg-ink-50">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink-600">
                  Resource
                </th>
                <th className="text-center px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink-600">
                  Room
                </th>
                <th className="text-center px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink-600">
                  In Use
                </th>
                <th className="text-center px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink-600">
                  Available
                </th>
                <th className="text-center px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink-600">
                  Utilisation
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {stats.resourceStats.map((r) => (
                <tr key={r.id} className="hover:bg-purple-50">
                  <td className="px-4 py-2 font-medium text-ink-900">
                    {r.name}
                  </td>
                  <td className="px-4 py-2 text-center text-ink-500">
                    {r.classRoom}
                  </td>
                  <td className="px-4 py-2 text-center font-mono text-ink-800">
                    {r.currentBooked}
                  </td>
                  <td className="px-4 py-2 text-center font-mono text-ink-800">
                    {r.availableNow}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <span
                      className={`font-mono font-semibold ${utilisationTextClass(r.utilisationPct)}`}
                    >
                      {r.utilisationPct}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Staff / Admin Usage */}
      {stats.staffUsage && stats.staffUsage.length > 0 && (
        <div className="sp-card overflow-hidden">
          <div className="px-4 pt-3">
            <h3 className="sp-rule-gold inline-block pb-1 text-sm font-semibold text-purple-800 mb-3">
              Staff / Admin Usage ({stats.totalUniqueStaff} unique users)
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[400px] text-sm">
              <thead className="bg-ink-50">
                <tr>
                  <th className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink-600">
                    Name
                  </th>
                  <th className="text-center px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink-600">
                    Total
                  </th>
                  <th className="text-center px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink-600">
                    Active
                  </th>
                  <th className="text-center px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink-600">
                    Returned
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {stats.staffUsage.map((su) => (
                  <tr key={su.name} className="hover:bg-purple-50">
                    <td className="px-4 py-2 font-medium text-ink-900">
                      {su.name}
                    </td>
                    <td className="px-4 py-2 text-center font-mono text-ink-800">
                      {su.total}
                    </td>
                    <td className="px-4 py-2 text-center font-mono text-ink-800">
                      {su.active}
                    </td>
                    <td className="px-4 py-2 text-center font-mono text-ink-800">
                      {su.returned}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default StatsView;
