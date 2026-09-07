import { useState, useEffect } from 'react'
import { getAllMeters, createMeter, assignMeter } from '../api/meters'
import { getMeterRealTime, getMeterDaily } from '../api/analytics'
import './AdminDashboard.css'

export default function AdminDashboard() {
  const [meters, setMeters] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Create meter modal
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({ meterNumber: '', dcuId: '', flatNumber: '', userId: '' })
  const [createErrors, setCreateErrors] = useState({})
  const [creating, setCreating] = useState(false)
  const [createSuccess, setCreateSuccess] = useState('')

  // Assign modal
  const [assignModal, setAssignModal] = useState(null) // meterId
  const [assignUserId, setAssignUserId] = useState('')
  const [assigning, setAssigning] = useState(false)

  // Selected meter detail panel
  const [selectedMeter, setSelectedMeter] = useState(null)
  const [meterDetail, setMeterDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const loadMeters = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getAllMeters()
      setMeters(data)
    } catch {
      setError('Failed to load meters.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadMeters() }, [])

  const handleCreateChange = (e) => {
    setCreateForm((f) => ({ ...f, [e.target.name]: e.target.value }))
    setCreateErrors((er) => ({ ...er, [e.target.name]: '' }))
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    const errs = {}
    if (!createForm.meterNumber.trim()) errs.meterNumber = 'Required'
    if (!createForm.dcuId.trim()) errs.dcuId = 'Required'
    if (!createForm.flatNumber.trim()) errs.flatNumber = 'Required'
    if (Object.keys(errs).length) { setCreateErrors(errs); return }

    setCreating(true)
    try {
      const payload = {
        meterNumber: createForm.meterNumber,
        dcuId: createForm.dcuId,
        flatNumber: createForm.flatNumber,
      }
      if (createForm.userId) payload.userId = parseInt(createForm.userId)
      await createMeter(payload)
      setCreateSuccess('Meter registered successfully.')
      setCreateForm({ meterNumber: '', dcuId: '', flatNumber: '', userId: '' })
      loadMeters()
      setTimeout(() => { setShowCreate(false); setCreateSuccess('') }, 1500)
    } catch (err) {
      setCreateErrors({ meterNumber: err.response?.data?.message || 'Failed to create meter.' })
    } finally {
      setCreating(false)
    }
  }

  const handleAssign = async () => {
    if (!assignUserId) return
    setAssigning(true)
    try {
      await assignMeter(assignModal, parseInt(assignUserId))
      setAssignModal(null)
      setAssignUserId('')
      loadMeters()
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to assign meter.')
    } finally {
      setAssigning(false)
    }
  }

  const handleSelectMeter = async (meter) => {
    setSelectedMeter(meter)
    setDetailLoading(true)
    setMeterDetail(null)
    try {
      const [rt, daily] = await Promise.all([
        getMeterRealTime(meter.id),
        getMeterDaily(meter.id),
      ])
      setMeterDetail({ realtime: rt, summary: daily })
    } catch {
      setMeterDetail({ error: 'No readings available for this meter yet.' })
    } finally {
      setDetailLoading(false)
    }
  }

  const activeCount = meters.filter((m) => m.status === 'ACTIVE').length
  const assignedCount = meters.filter((m) => m.userId != null).length

  return (
    <div className="admin-page">
      <div className="container">

        {/* Header */}
        <div className="admin-header">
          <div>
            <h1 className="text-3xl">Society Overview</h1>
            <p className="text-secondary" style={{ marginTop: 6 }}>
              Manage meters and monitor consumption
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            + Register Meter
          </button>
        </div>

        {/* Summary stats */}
        <div className="admin-stats">
          <div className="card stat-card">
            <p className="stat-label">Total Meters</p>
            <p className="stat-value">{meters.length}<span className="stat-unit"> meters</span></p>
          </div>
          <div className="card stat-card">
            <p className="stat-label">Active</p>
            <p className="stat-value" style={{ color: 'var(--color-success)' }}>
              {activeCount}<span className="stat-unit"> active</span>
            </p>
          </div>
          <div className="card stat-card">
            <p className="stat-label">Assigned</p>
            <p className="stat-value">
              {assignedCount}<span className="stat-unit"> / {meters.length}</span>
            </p>
          </div>
          <div className="card stat-card">
            <p className="stat-label">Unassigned</p>
            <p className="stat-value" style={{ color: meters.length - assignedCount > 0 ? 'var(--color-warning)' : 'inherit' }}>
              {meters.length - assignedCount}<span className="stat-unit"> meters</span>
            </p>
          </div>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}

        <div className="admin-content">
          {/* Meters table */}
          <div className="admin-table-section">
            {loading ? (
              <div className="page-loading" style={{ minHeight: 200 }}>
                <span className="spinner" /> Loading meters…
              </div>
            ) : meters.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: 48 }}>
                <p className="text-secondary">No meters registered yet.</p>
                <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowCreate(true)}>
                  Register first meter
                </button>
              </div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Meter</th>
                      <th>Flat</th>
                      <th>DCU</th>
                      <th>Resident</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {meters.map((m) => (
                      <tr
                        key={m.id}
                        className={selectedMeter?.id === m.id ? 'row-selected' : ''}
                        onClick={() => handleSelectMeter(m)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td className="font-semibold">{m.meterNumber}</td>
                        <td>{m.flatNumber}</td>
                        <td className="text-secondary">{m.dcuId}</td>
                        <td>
                          {m.userName
                            ? <span className="font-medium">{m.userName}</span>
                            : <span className="text-tertiary text-sm">Unassigned</span>
                          }
                        </td>
                        <td>
                          <span className={`badge ${
                            m.status === 'ACTIVE' ? 'badge-success'
                            : m.status === 'FAULTY' ? 'badge-danger'
                            : 'badge-neutral'
                          }`}>
                            {m.status}
                          </span>
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => { setAssignModal(m.id); setAssignUserId('') }}
                          >
                            Assign
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Detail panel */}
          {selectedMeter && (
            <div className="card meter-detail">
              <div className="meter-detail-header">
                <div>
                  <p className="stat-label">Meter Detail</p>
                  <p className="font-semibold text-lg">{selectedMeter.meterNumber}</p>
                  <p className="text-secondary text-sm">Flat {selectedMeter.flatNumber}</p>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => setSelectedMeter(null)}>✕</button>
              </div>

              <div className="divider" style={{ margin: '16px 0' }} />

              {detailLoading && <div className="page-loading" style={{ minHeight: 100 }}><span className="spinner" /></div>}

              {!detailLoading && meterDetail?.error && (
                <p className="text-secondary text-sm">{meterDetail.error}</p>
              )}

              {!detailLoading && meterDetail && !meterDetail.error && (
                <>
                  <div className="detail-stats">
                    <div>
                      <p className="stat-label">Current Load</p>
                      <p className="font-semibold text-xl">
                        {Number(meterDetail.realtime.instantPowerWatts).toFixed(0)} W
                      </p>
                    </div>
                    <div>
                      <p className="stat-label">Meter Reading</p>
                      <p className="font-semibold text-xl">
                        {Number(meterDetail.realtime.kwhValue).toFixed(2)} kWh
                      </p>
                    </div>
                    <div>
                      <p className="stat-label">Last 7 Days</p>
                      <p className="font-semibold text-xl">
                        {Number(meterDetail.summary.totalUnitsConsumed).toFixed(2)} kWh
                      </p>
                    </div>
                  </div>

                  <div className="divider" style={{ margin: '16px 0' }} />

                  <p className="stat-label" style={{ marginBottom: 10 }}>Daily Breakdown</p>
                  <div className="detail-daily">
                    {meterDetail.summary.dailyBreakdown.map((d) => (
                      <div key={d.date} className="detail-day-row">
                        <span className="text-sm text-secondary">
                          {new Date(d.date).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </span>
                        <span className="font-medium text-sm">
                          {Number(d.unitsConsumed).toFixed(2)} kWh
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create Meter Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal card card-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="text-xl font-semibold">Register Meter</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}>✕</button>
            </div>

            {createSuccess && <div className="alert alert-success">{createSuccess}</div>}

            <form onSubmit={handleCreate} className="modal-form">
              <div className="form-group">
                <label className="form-label">Meter Number</label>
                <input
                  className={`form-input ${createErrors.meterNumber ? 'error' : ''}`}
                  name="meterNumber" placeholder="MTR-001"
                  value={createForm.meterNumber} onChange={handleCreateChange}
                />
                {createErrors.meterNumber && <span className="form-error">{createErrors.meterNumber}</span>}
              </div>

              <div className="modal-row">
                <div className="form-group">
                  <label className="form-label">DCU ID</label>
                  <input
                    className={`form-input ${createErrors.dcuId ? 'error' : ''}`}
                    name="dcuId" placeholder="DCU-A1"
                    value={createForm.dcuId} onChange={handleCreateChange}
                  />
                  {createErrors.dcuId && <span className="form-error">{createErrors.dcuId}</span>}
                </div>
                <div className="form-group">
                  <label className="form-label">Flat Number</label>
                  <input
                    className={`form-input ${createErrors.flatNumber ? 'error' : ''}`}
                    name="flatNumber" placeholder="A-101"
                    value={createForm.flatNumber} onChange={handleCreateChange}
                  />
                  {createErrors.flatNumber && <span className="form-error">{createErrors.flatNumber}</span>}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">User ID <span className="text-tertiary">(optional)</span></label>
                <input
                  className="form-input"
                  name="userId" placeholder="e.g. 5"
                  type="number" min="1"
                  value={createForm.userId} onChange={handleCreateChange}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? <span className="spinner" /> : 'Register'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {assignModal && (
        <div className="modal-overlay" onClick={() => setAssignModal(null)}>
          <div className="modal card card-lg" style={{ maxWidth: 360 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="text-xl font-semibold">Assign Meter</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setAssignModal(null)}>✕</button>
            </div>
            <p className="text-secondary text-sm" style={{ marginBottom: 16 }}>
              Enter the User ID of the resident to assign this meter to.
            </p>
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label className="form-label">User ID</label>
              <input
                className="form-input"
                type="number" min="1"
                placeholder="e.g. 3"
                value={assignUserId}
                onChange={(e) => setAssignUserId(e.target.value)}
                autoFocus
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setAssignModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAssign} disabled={assigning || !assignUserId}>
                {assigning ? <span className="spinner" /> : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
