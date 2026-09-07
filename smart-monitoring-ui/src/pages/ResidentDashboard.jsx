import { useState, useEffect, useCallback } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { getMyRealTime, getMyWeekly, getMyDaily } from '../api/analytics'
import { getMyMeter } from '../api/meters'
import { useAuth } from '../context/AuthContext'
import './ResidentDashboard.css'

const RANGES = [
  { label: '7D', days: 7 },
  { label: '14D', days: 14 },
  { label: '30D', days: 30 },
]

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-date">{formatDate(label)}</p>
      <p className="chart-tooltip-val">
        {Number(payload[0].value).toFixed(2)}
        <span> kWh</span>
      </p>
    </div>
  )
}

export default function ResidentDashboard() {
  const { user } = useAuth()
  const [meter, setMeter] = useState(null)
  const [realtime, setRealtime] = useState(null)
  const [summary, setSummary] = useState(null)
  const [range, setRange] = useState(7)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [meterData, rt] = await Promise.all([getMyMeter(), getMyRealTime()])
      setMeter(meterData)
      setRealtime(rt)

      const to = new Date().toISOString().slice(0, 10)
      const from = new Date(Date.now() - (range - 1) * 86400000).toISOString().slice(0, 10)
      const s = await getMyDaily(from, to)
      setSummary(s)
    } catch (err) {
      if (err.response?.status === 400) {
        setError('No meter assigned to your account yet. Please contact your society admin.')
      } else {
        setError('Failed to load data. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }, [range])

  useEffect(() => { loadData() }, [loadData])

  // Auto-refresh realtime every 60s
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const rt = await getMyRealTime()
        setRealtime(rt)
      } catch { /* silent */ }
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="page-loading">
        <span className="spinner spinner-lg" />
        Loading your data…
      </div>
    )
  }

  if (error) {
    return (
      <div className="dashboard-page">
        <div className="container">
          <div className="alert alert-danger" style={{ marginTop: 48 }}>{error}</div>
        </div>
      </div>
    )
  }

  const chartData = summary?.dailyBreakdown?.map((d) => ({
    date: d.date,
    units: Number(d.unitsConsumed),
  })) ?? []

  return (
    <div className="dashboard-page">
      <div className="container">

        {/* Header */}
        <div className="dashboard-header">
          <div>
            <h1 className="text-3xl">Good {getGreeting()}, {user.name.split(' ')[0]}</h1>
            <p className="text-secondary" style={{ marginTop: 6 }}>
              Flat {meter?.flatNumber} · Meter {meter?.meterNumber}
            </p>
          </div>
          <button className="btn btn-sm btn-secondary" onClick={loadData}>
            ↻ Refresh
          </button>
        </div>

        {/* Stats row */}
        <div className="stats-grid">
          <div className="card stat-card">
            <p className="stat-label">Current Power</p>
            <p className="stat-value">
              {realtime?.instantPowerWatts != null
                ? Number(realtime.instantPowerWatts).toFixed(0)
                : '—'}
              <span className="stat-unit">W</span>
            </p>
            <p className="text-tertiary text-xs" style={{ marginTop: 8 }}>
              Live · updates every 60s
            </p>
          </div>

          <div className="card stat-card">
            <p className="stat-label">Meter Reading</p>
            <p className="stat-value">
              {realtime?.kwhValue != null
                ? Number(realtime.kwhValue).toFixed(2)
                : '—'}
              <span className="stat-unit">kWh</span>
            </p>
            <p className="text-tertiary text-xs" style={{ marginTop: 8 }}>
              Cumulative total
            </p>
          </div>

          <div className="card stat-card stat-card-accent">
            <p className="stat-label">Total This Period</p>
            <p className="stat-value">
              {summary?.totalUnitsConsumed != null
                ? Number(summary.totalUnitsConsumed).toFixed(2)
                : '—'}
              <span className="stat-unit">kWh</span>
            </p>
            <p className="text-tertiary text-xs" style={{ marginTop: 8 }}>
              Last {range} days
            </p>
          </div>

          <div className="card stat-card">
            <p className="stat-label">Daily Average</p>
            <p className="stat-value">
              {summary?.dailyBreakdown?.length
                ? (Number(summary.totalUnitsConsumed) / summary.dailyBreakdown.length).toFixed(2)
                : '—'}
              <span className="stat-unit">kWh</span>
            </p>
            <p className="text-tertiary text-xs" style={{ marginTop: 8 }}>
              Over {range} days
            </p>
          </div>
        </div>

        {/* Chart */}
        <div className="card chart-card">
          <div className="chart-header">
            <div>
              <p className="stat-label">Daily Consumption</p>
              <p className="text-sm text-secondary">
                {summary?.from && summary?.to
                  ? `${formatDate(summary.from)} – ${formatDate(summary.to)}`
                  : ''}
              </p>
            </div>
            <div className="range-pills">
              {RANGES.map((r) => (
                <button
                  key={r.days}
                  className={`range-pill ${range === r.days ? 'active' : ''}`}
                  onClick={() => setRange(r.days)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="consumption" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0071e3" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#0071e3" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  tick={{ fontSize: 11, fill: '#6e6e73' }}
                  axisLine={false}
                  tickLine={false}
                  tickMargin={8}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#6e6e73' }}
                  axisLine={false}
                  tickLine={false}
                  tickMargin={8}
                  unit=" kWh"
                />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#0071e3', strokeWidth: 1, strokeDasharray: '4 4' }} />
                <Area
                  type="monotone"
                  dataKey="units"
                  stroke="#0071e3"
                  strokeWidth={2}
                  fill="url(#consumption)"
                  dot={false}
                  activeDot={{ r: 4, fill: '#0071e3', strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="chart-empty">
              <p>No consumption data for this period.</p>
            </div>
          )}
        </div>

        {/* Daily breakdown table */}
        {chartData.length > 0 && (
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '20px 24px 16px' }}>
              <p className="stat-label">Daily Breakdown</p>
            </div>
            <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Units Consumed</th>
                    <th>vs Average</th>
                  </tr>
                </thead>
                <tbody>
                  {[...chartData].reverse().map((row) => {
                    const avg = Number(summary.totalUnitsConsumed) / chartData.length
                    const diff = row.units - avg
                    return (
                      <tr key={row.date}>
                        <td className="font-medium">{formatDate(row.date)}</td>
                        <td>{row.units.toFixed(2)} kWh</td>
                        <td>
                          <span className={diff > 0 ? 'text-danger' : 'text-success'}>
                            {diff > 0 ? '↑' : '↓'} {Math.abs(diff).toFixed(2)} kWh
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Last updated */}
        {realtime?.recordedAt && (
          <p className="text-tertiary text-xs" style={{ textAlign: 'center', padding: '16px 0' }}>
            Last reading at {new Date(realtime.recordedAt).toLocaleString('en-IN')}
          </p>
        )}

      </div>
    </div>
  )
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}
