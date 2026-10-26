import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5001/api').replace(/\/+$/, '')
const API_URL = `${API_BASE}/jobs`
const TOKEN_KEY = 'jobTrackerToken'
const STATUSES = ['Applied', 'Interview', 'Selected', 'Rejected']
const EMPTY_FORM = { companyName: '', role: '', location: '', status: 'Applied', appliedDate: '' }

const toDateInput = (value) => (value ? new Date(value).toISOString().slice(0, 10) : '')
const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
    : '—'

const readToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

const saveToken = (token) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // storage unavailable (private mode); the session just won't persist
  }
}

class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

async function request(url, options = {}, token) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  let res
  try {
    res = await fetch(url, { ...options, headers })
  } catch {
    throw new ApiError('Cannot reach the server. Make sure the backend is running.', 0)
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(data?.message || `Request failed (${res.status})`, res.status)
  return data
}

function AuthScreen({ onAuth, message }) {
  const [mode, setMode] = useState('login')
  const [values, setValues] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState(message)
  const [submitting, setSubmitting] = useState(false)
  const isRegister = mode === 'register'

  const handleChange = (e) => setValues({ ...values, [e.target.name]: e.target.value })

  const switchMode = () => {
    setMode(isRegister ? 'login' : 'register')
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const email = values.email.trim()
    if ((isRegister && !values.name.trim()) || !email || !values.password) {
      setError('Please fill in all fields.')
      return
    }
    if (isRegister && values.password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const body = isRegister
        ? { name: values.name.trim(), email, password: values.password }
        : { email, password: values.password }
      const data = await request(`${API_BASE}/auth/${mode}`, { method: 'POST', body: JSON.stringify(body) })
      onAuth(data.token, data.user)
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <div className="app auth-page">
      <div className="auth-card">
        <div className="auth-head">
          <span className="brand">Job Tracker</span>
          <h1>{isRegister ? 'Create your account' : 'Welcome back'}</h1>
          <p>{isRegister ? 'Start tracking your job applications.' : 'Log in to see your applications.'}</p>
        </div>
        <form className="form auth-form" onSubmit={handleSubmit} noValidate>
          {error && (
            <div className="alert alert-inline" role="alert">
              {error}
            </div>
          )}
          {isRegister && (
            <label className="field">
              <span>Full name</span>
              <input
                className="input"
                name="name"
                value={values.name}
                onChange={handleChange}
                autoComplete="name"
                autoFocus
              />
            </label>
          )}
          <label className="field">
            <span>Email</span>
            <input
              className="input"
              type="email"
              name="email"
              value={values.email}
              onChange={handleChange}
              autoComplete="email"
              autoFocus={!isRegister}
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              className="input"
              type="password"
              name="password"
              value={values.password}
              onChange={handleChange}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              placeholder={isRegister ? 'At least 6 characters' : ''}
            />
          </label>
          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? 'Please wait…' : isRegister ? 'Create account' : 'Log in'}
          </button>
        </form>
        <p className="auth-switch">
          {isRegister ? 'Already have an account?' : 'New here?'}{' '}
          <button type="button" className="link link-strong" onClick={switchMode}>
            {isRegister ? 'Log in' : 'Create an account'}
          </button>
        </p>
      </div>
    </div>
  )
}

function App() {
  const [token, setToken] = useState(readToken)
  const [user, setUser] = useState(null)
  const [sessionMessage, setSessionMessage] = useState('')

  const logout = useCallback((message = '') => {
    saveToken(null)
    setToken(null)
    setUser(null)
    setSessionMessage(message)
  }, [])

  useEffect(() => {
    if (!token || user) return
    request(`${API_BASE}/auth/me`, {}, token)
      .then((data) => setUser(data.user))
      .catch((err) =>
        logout(err.status === 401 ? 'Your session has expired. Please log in again.' : err.message),
      )
  }, [token, user, logout])

  const handleAuth = (newToken, newUser) => {
    saveToken(newToken)
    setSessionMessage('')
    setUser(newUser)
    setToken(newToken)
  }

  if (!token) {
    return <AuthScreen key={sessionMessage} onAuth={handleAuth} message={sessionMessage} />
  }

  if (!user) {
    return (
      <div className="app auth-page">
        <div className="spinner" aria-label="Loading" />
      </div>
    )
  }

  return <Tracker key={user.id} token={token} user={user} onLogout={logout} />
}

function Tracker({ token, user, onLogout }) {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)
  const [formOpen, setFormOpen] = useState(false)
  const [formError, setFormError] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')

  const fetchJobs = useCallback(
    () =>
      request(API_URL, {}, token)
        .then(setJobs)
        .catch((err) => {
          if (err.status === 401) onLogout('Your session has expired. Please log in again.')
          else setError(`Could not load applications. ${err.message}`)
        })
        .finally(() => setLoading(false)),
    [token, onLogout],
  )

  const loadJobs = () => {
    setLoading(true)
    setError('')
    fetchJobs()
  }

  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(''), 3000)
    return () => clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    if (!formOpen) return
    const onKey = (e) => e.key === 'Escape' && !saving && setFormOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [formOpen, saving])

  const stats = useMemo(() => {
    const counts = { Total: jobs.length }
    STATUSES.forEach((s) => {
      counts[s] = jobs.filter((job) => job.status === s).length
    })
    return counts
  }, [jobs])

  const visibleJobs = useMemo(() => {
    const term = search.trim().toLowerCase()
    return jobs.filter((job) => {
      const matchesStatus = statusFilter === 'All' || job.status === statusFilter
      const matchesSearch =
        !term ||
        [job.companyName, job.role, job.location].some((field) => field?.toLowerCase().includes(term))
      return matchesStatus && matchesSearch
    })
  }, [jobs, search, statusFilter])

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const openNew = () => {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setFormError('')
    setFormOpen(true)
  }

  const openEdit = (job) => {
    setForm({
      companyName: job.companyName,
      role: job.role,
      location: job.location || '',
      status: job.status,
      appliedDate: toDateInput(job.appliedDate),
    })
    setEditingId(job._id)
    setFormError('')
    setFormOpen(true)
  }

  const closeForm = () => {
    if (!saving) setFormOpen(false)
  }

  const buildPayload = () => {
    const payload = {
      companyName: form.companyName.trim(),
      role: form.role.trim(),
      location: form.location.trim(),
      status: form.status,
    }
    if (form.appliedDate) payload.appliedDate = form.appliedDate
    return payload
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.companyName.trim() || !form.role.trim()) {
      setFormError('Company and role are required.')
      return
    }
    setSaving(true)
    setFormError('')
    try {
      if (editingId) {
        const updated = await request(`${API_URL}/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(buildPayload()),
        }, token)
        setJobs((prev) => prev.map((job) => (job._id === editingId ? updated : job)))
        setNotice('Application updated')
      } else {
        const created = await request(API_URL, { method: 'POST', body: JSON.stringify(buildPayload()) }, token)
        setJobs((prev) => [created, ...prev])
        setNotice('Application added')
      }
      setFormOpen(false)
    } catch (err) {
      if (err.status === 401) onLogout('Your session has expired. Please log in again.')
      else setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const updateStatus = async (id, status) => {
    setBusyId(id)
    setError('')
    try {
      const updated = await request(`${API_URL}/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }, token)
      setJobs((prev) => prev.map((job) => (job._id === id ? updated : job)))
      setNotice(`Status changed to ${status}`)
    } catch (err) {
      if (err.status === 401) onLogout('Your session has expired. Please log in again.')
      else setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  const deleteJob = async (job) => {
    if (!window.confirm(`Delete the application for ${job.role} at ${job.companyName}?`)) return
    setBusyId(job._id)
    setError('')
    try {
      await request(`${API_URL}/${job._id}`, { method: 'DELETE' }, token)
      setJobs((prev) => prev.filter((j) => j._id !== job._id))
      setNotice('Application deleted')
    } catch (err) {
      if (err.status === 401) onLogout('Your session has expired. Please log in again.')
      else setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="container topbar-inner">
          <span className="brand">Job Tracker</span>
          <div className="topbar-actions">
            <span className="user-name" title={user.email}>
              {user.name}
            </span>
            <button type="button" className="link" onClick={() => onLogout()}>
              Log out
            </button>
            <button type="button" className="btn btn-primary" onClick={openNew}>
              New application
            </button>
          </div>
        </div>
      </header>

      <main className="container main">
        <div className="page-head">
          <h1>Applications</h1>
          <p>Track where you have applied and how each application is progressing.</p>
        </div>

        <section className="stats" aria-label="Application statistics">
          {Object.entries(stats).map(([label, value]) => {
            const filterValue = label === 'Total' ? 'All' : label
            return (
              <button
                type="button"
                key={label}
                className={`stat ${statusFilter === filterValue ? 'is-active' : ''}`}
                onClick={() => setStatusFilter(filterValue)}
              >
                <span className="stat-label">
                  {label !== 'Total' && <span className={`dot dot-${label.toLowerCase()}`} />}
                  {label}
                </span>
                <span className="stat-value">{value}</span>
              </button>
            )
          })}
        </section>

        {error && (
          <div className="alert" role="alert">
            <span>{error}</span>
            <div className="alert-actions">
              <button type="button" className="link" onClick={loadJobs}>
                Retry
              </button>
              <button type="button" className="link" onClick={() => setError('')}>
                Dismiss
              </button>
            </div>
          </div>
        )}

        <section className="card">
          <div className="toolbar">
            <input
              type="search"
              className="input search"
              placeholder="Search by company, role or location"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search applications"
            />
            <select
              className="input filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
            >
              <option value="All">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="empty">
              <div className="spinner" aria-hidden="true" />
              <p>Loading applications…</p>
            </div>
          ) : jobs.length === 0 ? (
            <div className="empty">
              <p className="empty-title">No applications yet</p>
              <p>Add your first application to start tracking it.</p>
              <button type="button" className="btn btn-secondary" onClick={openNew}>
                New application
              </button>
            </div>
          ) : visibleJobs.length === 0 ? (
            <div className="empty">
              <p className="empty-title">No matching applications</p>
              <p>Try a different search term or status.</p>
            </div>
          ) : (
            <div className="table" role="table" aria-label="Job applications">
              <div className="row row-head" role="row">
                <span role="columnheader">Role</span>
                <span role="columnheader">Location</span>
                <span role="columnheader">Applied</span>
                <span role="columnheader">Status</span>
                <span role="columnheader" className="sr-only">
                  Actions
                </span>
              </div>
              {visibleJobs.map((job) => (
                <div key={job._id} role="row" className={`row ${busyId === job._id ? 'is-busy' : ''}`}>
                  <div role="cell" className="cell-role">
                    <span className="role">{job.role}</span>
                    <span className="company">{job.companyName}</span>
                  </div>
                  <div role="cell" className="cell-muted" data-label="Location">
                    {job.location || '—'}
                  </div>
                  <div role="cell" className="cell-muted" data-label="Applied">
                    {formatDate(job.appliedDate)}
                  </div>
                  <div role="cell" data-label="Status">
                    <select
                      className={`status-select status-${job.status.toLowerCase()}`}
                      value={job.status}
                      onChange={(e) => updateStatus(job._id, e.target.value)}
                      disabled={busyId === job._id}
                      aria-label={`Status for ${job.role} at ${job.companyName}`}
                    >
                      {STATUSES.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div role="cell" className="cell-actions">
                    <button type="button" className="link" onClick={() => openEdit(job)} disabled={busyId === job._id}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="link link-danger"
                      onClick={() => deleteJob(job)}
                      disabled={busyId === job._id}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && jobs.length > 0 && (
            <div className="card-foot">
              Showing {visibleJobs.length} of {jobs.length}
            </div>
          )}
        </section>
      </main>

      {formOpen && (
        <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && closeForm()}>
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="form-title">
            <div className="dialog-head">
              <h2 id="form-title">{editingId ? 'Edit application' : 'New application'}</h2>
              <button type="button" className="icon-btn" onClick={closeForm} aria-label="Close">
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit} className="form" noValidate>
              {formError && (
                <div className="alert alert-inline" role="alert">
                  {formError}
                </div>
              )}
              <label className="field">
                <span>Company</span>
                <input
                  className="input"
                  name="companyName"
                  value={form.companyName}
                  onChange={handleChange}
                  placeholder="Acme Corp"
                  autoFocus
                />
              </label>
              <label className="field">
                <span>Role</span>
                <input
                  className="input"
                  name="role"
                  value={form.role}
                  onChange={handleChange}
                  placeholder="Frontend Developer"
                />
              </label>
              <label className="field">
                <span>
                  Location <em>optional</em>
                </span>
                <input
                  className="input"
                  name="location"
                  value={form.location}
                  onChange={handleChange}
                  placeholder="Remote"
                />
              </label>
              <div className="field-row">
                <label className="field">
                  <span>Status</span>
                  <select className="input" name="status" value={form.status} onChange={handleChange}>
                    {STATUSES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Applied on</span>
                  <input
                    className="input"
                    type="date"
                    name="appliedDate"
                    value={form.appliedDate}
                    onChange={handleChange}
                  />
                </label>
              </div>
              <div className="dialog-actions">
                <button type="button" className="btn btn-secondary" onClick={closeForm} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
    </div>
  )
}

export default App
