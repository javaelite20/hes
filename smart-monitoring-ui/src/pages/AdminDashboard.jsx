import { useState, useEffect } from 'react'
import { getAllMeters, createMeter, assignMeter } from '../api/meters'
import { getMeterRealTime, getMeterDaily } from '../api/analytics'
import { register } from '../api/auth'
import './AdminDashboard.css'

const EMPTY_RESIDENT = { name: '', towerNumber: '', flatNumber: '', password: '', phoneNumber: '' }
const EMPTY_METER    = { meterNumber: '', dcuId: '', flatNumber: '' }

export default function AdminDashboard() {
  const [meters, setMeters]           = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')

  // Register resident modal
  const [showResident, setShowResident]             = useState(false)
  const [residentForm, setResidentForm]             = useState(EMPTY_RESIDENT)
  const [residentErrors, setResidentErrors]         = useState({})
  const [registeringResident, setRegisteringResident] = useState(false)
  const [residentSuccess, setResidentSuccess]       = useState(null)

  // Register meter modal
  const [showMeter, setShowMeter]         = useState(false)
  const [meterForm, setMeterForm]         = useState(EMPTY_METER)
  const [meterErrors, setMeterErrors]     = useState({})
  const [creatingMeter, setCreatingMeter] = useState(false)
  const [meterSuccess, setMeterSuccess]   = useState('')

  // Assign meter modal
  const [assignModal, setAssignModal]   = useState(null)
  const [assignUserId, setAssignUserId] = useState('')
  const [assigning, setAssigning]       = useState(false)
  const [assignError, setAssignError]   = useState('')

  // Meter detail panel
  const [selectedMeter, setSelectedMeter] = useState(null)
  const [meterDetail, setMeterDetail]     = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const loadMeters = async () => {
    setLoading(true)
    setError('')
    try { setMeters(await getAllMeters()) }
    catch { setError('Failed to load meters.') }
    finally { setLoading(false) }
  }

  useEffect(() => { loadMeters() }, [])

  // ── Resident registration ──────────────────────────────────────────────────
  const onResidentChange = (e) => {
    setResidentForm((f) => ({ ...f, [e.target.name]: e.target.value }))
    setResidentErrors((er) => ({ ...er, [e.target.name]: '' }))
  }

  const handleRegisterResident = async (e) => {
    e.preventDefault()
    const errs = {}
    if (!residentForm.name.trim())        errs.name        = 'Required'
    if (!residentForm.towerNumber.trim()) errs.towerNumber = 'Required'
    if (!residentForm.flatNumber.trim())  errs.flatNumber  = 'Required'
    if (residentForm.password.length < 4) errs.password    = 'Min. 4 characters'
    if (Object.keys(errs).length) { setResidentErrors(errs); return }

    setRegisteringResident(true)
    try {
      const data = await register(residentForm)
      // Backend now returns userId directly in the response
      setResidentSuccess({
        userId:   data.userId,
        loginId:  data.loginId,
        name:     data.name,
        password: residentForm.password,
      })
      setResidentForm(EMPTY_RESIDENT)
    } catch (err) {
      setResidentErrors({ name: err.response?.data?.message || 'Failed to register resident.' })
    } finally {
      setRegisteringResident(false)
    }
  }

  // ── Meter creation ─────────────────────────────────────────────────────────
  const onMeterChange = (e) => {
    setMeterForm((f) => ({ ...f, [e.target.name]: e.target.value }))
    setMeterErrors((er) => ({ ...er, [e.target.name]: '' }))
  }

  const handleCreateMeter = async (e) => {
    e.preventDefault()
    const errs = {}
    if (!meterForm.meterNumber.trim()) errs.meterNumber = 'Required'
    if (!meterForm.dcuId.trim())       errs.dcuId       = 'Required'
    if (!meterForm.flatNumber.trim())  errs.flatNumber  = 'Required'
    if (Object.keys(errs).length) { setMeterErrors(errs); return }

    setCreatingMeter(true)
    try {
      await createMeter(meterForm)
      setMeterSuccess('Meter registered successfully.')
      setMeterForm(EMPTY_METER)
      loadMeters()
      setTimeout(() => { setShowMeter(false); setMeterSuccess('') }, 1500)
    } catch (err) {
      setMeterErrors({ meterNumber: err.response?.data?.message || 'Failed to create meter.' })
    } finally {
      setCreatingMeter(false)
    }
  }

  // ── Assign meter ───────────────────────────────────────────────────────────
  const handleAssign = async () => {
    if (!assignUserId.trim()) return
    setAssigning(true)
    setAssignError('')
    try {
      await assignMeter(assignModal.meterId, assignUserId.trim())
      setAssignModal(null)
      setAssignUserId('')
      loadMeters()
    } catch (err) {
      setAssignError(err.response?.data?.message || 'Failed to assign meter.')
    } finally {
      setAssigning(false)
    }
  }

  // ── Meter detail ───────────────────────────────────────────────────────────
  const handleSelectMeter = async (meter) => {
    setSelectedMeter(meter)
    setDetailLoading(true)
    setMeterDetail(null)
    try {
      const [rt, daily] = await Promise.all([getMeterRealTime(meter.id), getMeterDaily(meter.id)])
      setMeterDetail({ realtime: rt, summary: daily })
    } catch {
      setMeterDetail({ error: 'No readings available for this meter yet.' })
    } finally {
      setDetailLoading(false)
    }
  }

  const activeCount   = meters.filter((m) => m.status === 'ACTIVE').length
  const assignedCount = meters.filter((m) => m.userId != null).length

  return (
    <div className="admin-page">
      <div className="container">

        {/* Header */}
        <div className="admin-header">
          <div>
            <h1 className="text-3xl">Society Overview</h1>
            <p className="text-secondary" style={{ marginTop: 6 }}>Manage residents and meters</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary" onClick={() => { setShowResident(true); setResidentSuccess(null) }}>
              + Add Resident
            </button>
            <button className="btn btn-primary" onClick={() => setShowMeter(true)}>
              + Register Meter
            </button>
          </div>
        </div>

        {/* Stats */}
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
            <p className="stat-value">{assignedCount}<span className="stat-unit"> / {meters.length}</span></p>
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
                <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowMeter(true)}>
                  Register first meter
                </button>
              </div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Meter</th><th>Flat</th><th>DCU</th><th>Resident</th><th>Status</th><th>Actions</th>
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
                          <span className={`badge ${m.status === 'ACTIVE' ? 'badge-success' : m.status === 'FAULTY' ? 'badge-danger' : 'badge-neutral'}`}>
                            {m.status}
                          </span>
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => { setAssignModal({ meterId: m.id, flatNumber: m.flatNumber }); setAssignUserId(''); setAssignError('') }}
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
              {!detailLoading && meterDetail?.error && <p className="text-secondary text-sm">{meterDetail.error}</p>}
              {!detailLoading && meterDetail && !meterDetail.error && (
                <>
                  <div className="detail-stats">
                    <div><p className="stat-label">Current Load</p><p className="font-semibold text-xl">{Number(meterDetail.realtime.instantPowerWatts).toFixed(0)} W</p></div>
                    <div><p className="stat-label">Meter Reading</p><p className="font-semibold text-xl">{Number(meterDetail.realtime.kwhValue).toFixed(2)} kWh</p></div>
                    <div><p className="stat-label">Last 7 Days</p><p className="font-semibold text-xl">{Number(meterDetail.summary.totalUnitsConsumed).toFixed(2)} kWh</p></div>
                  </div>
                  <div className="divider" style={{ margin: '16px 0' }} />
                  <p className="stat-label" style={{ marginBottom: 10 }}>Daily Breakdown</p>
                  <div className="detail-daily">
                    {meterDetail.summary.dailyBreakdown.map((d) => (
                      <div key={d.date} className="detail-day-row">
                        <span className="text-sm text-secondary">
                          {new Date(d.date).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </span>
                        <span className="font-medium text-sm">{Number(d.unitsConsumed).toFixed(2)} kWh</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Register Resident Modal ─────────────────────────────────────────── */}
      {showResident && (
        <div className="modal-overlay" onClick={() => { setShowResident(false); setResidentSuccess(null) }}>
          <div className="modal card card-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="text-xl font-semibold">Add Resident</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => { setShowResident(false); setResidentSuccess(null) }}>✕</button>
            </div>

            {residentSuccess ? (
              /* ── Success screen — show credentials ── */
              <div>
                <div className="alert alert-success" style={{ marginBottom: 20 }}>
                  Resident registered successfully.
                </div>
                <p className="text-sm text-secondary" style={{ marginBottom: 12 }}>
                  Share these login credentials with the resident:
                </p>
                <div className="credentials-box">
                  {/* <div className="credential-row">
                    <span className="form-label">Login ID</span>
                    <span className="font-semibold">{residentSuccess.loginId}</span>
                  </div> */}
                  <div className="credential-row">
                    <span className="form-label">Password</span>
                    <span className="font-semibold">{residentSuccess.password}</span>
                  </div>
                  <div className="credential-row">
                    <span className="form-label">User ID</span>
                    <span className="font-semibold text-accent">{residentSuccess.userId}</span>
                    <span className="text-tertiary text-xs" style={{ marginLeft: 6 }}>use this when assigning a meter</span>
                  </div>
                </div>
                <div className="modal-actions" style={{ marginTop: 20 }}>
                  <button className="btn btn-secondary" onClick={() => setResidentSuccess(null)}>
                    Add Another
                  </button>
                  <button className="btn btn-primary" onClick={() => { setShowResident(false); setResidentSuccess(null) }}>
                    Done
                  </button>
                </div>
              </div>
            ) : (
              /* ── Registration form ── */
              <form onSubmit={handleRegisterResident} className="modal-form">
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input
                    className={`form-input ${residentErrors.name ? 'error' : ''}`}
                    name="name" placeholder="Ramesh Kumar"
                    value={residentForm.name} onChange={onResidentChange} autoFocus
                  />
                  {residentErrors.name && <span className="form-error">{residentErrors.name}</span>}
                </div>

                <div className="modal-row">
                  <div className="form-group">
                    <label className="form-label">Tower Number</label>
                    <input
                      className={`form-input ${residentErrors.towerNumber ? 'error' : ''}`}
                      name="towerNumber" placeholder="01"
                      value={residentForm.towerNumber} onChange={onResidentChange}
                    />
                    {residentErrors.towerNumber && <span className="form-error">{residentErrors.towerNumber}</span>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Flat Number</label>
                    <input
                      className={`form-input ${residentErrors.flatNumber ? 'error' : ''}`}
                      name="flatNumber" placeholder="A-101"
                      value={residentForm.flatNumber} onChange={onResidentChange}
                    />
                    {residentErrors.flatNumber && <span className="form-error">{residentErrors.flatNumber}</span>}
                  </div>
                </div>

                {/* Live preview of loginId */}
                {(residentForm.towerNumber || residentForm.flatNumber) && (
                  <p className="text-tertiary text-xs" style={{ marginTop: -8 }}>
                    Login ID will be: <strong className="text-secondary">
                      {residentForm.towerNumber || '?'}_{residentForm.flatNumber || '?'}
                    </strong>
                  </p>
                )}

                <div className="modal-row">
                  <div className="form-group">
                    <label className="form-label">Password</label>
                    <input
                      className={`form-input ${residentErrors.password ? 'error' : ''}`}
                      name="password" placeholder="Min. 4 characters"
                      value={residentForm.password} onChange={onResidentChange}
                    />
                    {residentErrors.password && <span className="form-error">{residentErrors.password}</span>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone <span className="text-tertiary">(optional)</span></label>
                    <input
                      className="form-input"
                      name="phoneNumber" placeholder="9876543210"
                      value={residentForm.phoneNumber} onChange={onResidentChange}
                    />
                  </div>
                </div>

                <div className="modal-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowResident(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={registeringResident}>
                    {registeringResident ? <span className="spinner" /> : 'Register Resident'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── Register Meter Modal ────────────────────────────────────────────── */}
      {showMeter && (
        <div className="modal-overlay" onClick={() => setShowMeter(false)}>
          <div className="modal card card-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="text-xl font-semibold">Register Meter</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowMeter(false)}>✕</button>
            </div>
            {meterSuccess && <div className="alert alert-success">{meterSuccess}</div>}
            <form onSubmit={handleCreateMeter} className="modal-form">
              <div className="form-group">
                <label className="form-label">Meter Number</label>
                <input
                  className={`form-input ${meterErrors.meterNumber ? 'error' : ''}`}
                  name="meterNumber" placeholder="MTR-001"
                  value={meterForm.meterNumber} onChange={onMeterChange} autoFocus
                />
                {meterErrors.meterNumber && <span className="form-error">{meterErrors.meterNumber}</span>}
              </div>
              <div className="modal-row">
                <div className="form-group">
                  <label className="form-label">DCU ID</label>
                  <input
                    className={`form-input ${meterErrors.dcuId ? 'error' : ''}`}
                    name="dcuId" placeholder="DCU-A1"
                    value={meterForm.dcuId} onChange={onMeterChange}
                  />
                  {meterErrors.dcuId && <span className="form-error">{meterErrors.dcuId}</span>}
                </div>
                <div className="form-group">
                  <label className="form-label">Flat Number</label>
                  <input
                    className={`form-input ${meterErrors.flatNumber ? 'error' : ''}`}
                    name="flatNumber" placeholder="A-101"
                    value={meterForm.flatNumber} onChange={onMeterChange}
                  />
                  {meterErrors.flatNumber && <span className="form-error">{meterErrors.flatNumber}</span>}
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowMeter(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={creatingMeter}>
                  {creatingMeter ? <span className="spinner" /> : 'Register'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Assign Meter Modal ──────────────────────────────────────────────── */}
      {assignModal && (
        <div className="modal-overlay" onClick={() => setAssignModal(null)}>
          <div className="modal card card-lg" style={{ maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="text-xl font-semibold">Assign Meter</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setAssignModal(null)}>✕</button>
            </div>
            <p className="text-secondary text-sm" style={{ marginBottom: 16 }}>
              Flat <strong>{assignModal.flatNumber}</strong> — enter the resident's User ID (e.g. <code>01_A-101</code>).
            </p>
            <div className="form-group" style={{ marginBottom: 8 }}>
              <label className="form-label">User ID</label>
              <input
                className="form-input"
                type="text"
                placeholder="e.g. 01_A-101"
                value={assignUserId}
                onChange={(e) => { setAssignUserId(e.target.value); setAssignError('') }}
                autoFocus
              />
            </div>
            {assignError && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{assignError}</div>}
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
