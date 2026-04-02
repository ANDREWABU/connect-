import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function Report({ session }) {
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [myReports, setMyReports] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchMyReports() }, [])

  const fetchMyReports = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
    if (!error) setMyReports(data)
    setLoading(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    const { error } = await supabase.from('reports').insert({
      user_id: session.user.id,
      email: session.user.email,
      subject, message, status: 'open'
    })
    if (!error) {
      setSubmitted(true)
      setSubject('')
      setMessage('')
      fetchMyReports()
      setTimeout(() => setSubmitted(false), 3000)
    }
    setSubmitting(false)
  }

  const statusClass = {
    open: 'status-badge status-open',
    'in progress': 'status-badge status-inprogress',
    resolved: 'status-badge status-resolved',
  }

  const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  })

  return (
    <div>
      <div className="step-label">report an issue</div>

      <div className="card">
        <p style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>
          having a problem with Connect? let us know and we'll fix it.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="report-form">
            <select
              className="report-select"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              required
              style={{ color: subject ? '#111' : '#999' }}>
              <option value="" disabled>select an issue type</option>
              <option value="Map not loading">map not loading</option>
              <option value="Route not generating">route not generating</option>
              <option value="Login issue">login issue</option>
              <option value="History not saving">history not saving</option>
              <option value="App is slow">app is slow</option>
              <option value="Other">other</option>
            </select>

            <textarea
              className="report-textarea"
              placeholder="describe the issue in detail..."
              value={message}
              onChange={e => setMessage(e.target.value)}
              required
              rows={4}
            />
          </div>

          {submitted && (
            <div className="report-success">
              ✓ report submitted! we'll look into it soon.
            </div>
          )}

          <button className="btn-primary" type="submit" disabled={submitting}>
            {submitting ? 'submitting...' : 'submit report'}
          </button>
        </form>
      </div>

      {!loading && myReports.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div className="step-label">your past reports</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {myReports.map(report => (
              <div key={report.id} className="card" style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{report.subject}</div>
                  <span className={statusClass[report.status] || 'status-badge'}>
                    {report.status}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: '#888', marginTop: 6, lineHeight: 1.5 }}>
                  {report.message}
                </p>
                <p style={{ fontSize: 11, color: '#bbb', marginTop: 8 }}>
                  {formatDate(report.created_at)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}