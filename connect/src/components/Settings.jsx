import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'

export default function Settings({ session, onLogout }) {
  const [profile, setProfile] = useState(null)
  const [fullName, setFullName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [activeSection, setActiveSection] = useState('profile')

  // Report state
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [myReports, setMyReports] = useState([])

  // Ref for hidden file input
  const fileInputRef = useRef(null)

  useEffect(() => {
    fetchProfile()
    fetchReports()
  }, [])

  const fetchProfile = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()

    if (data) {
      setProfile(data)
      setFullName(data.full_name || '')
      if (data.avatar_url) {
        const { data: urlData } = supabase
          .storage
          .from('avatars')
          .getPublicUrl(data.avatar_url)
        setAvatarUrl(urlData.publicUrl)
      }
    }
  }

  const fetchReports = async () => {
    const { data } = await supabase
      .from('reports')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
    if (data) setMyReports(data)
  }

  // Handles profile picture upload
  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setUploading(true)

    // Create unique filename using user id
    const fileExt = file.name.split('.').pop()
    const fileName = `${session.user.id}.${fileExt}`

    // Upload to Supabase storage avatars bucket
    const { error: uploadError } = await supabase
      .storage
      .from('avatars')
      .upload(fileName, file, { upsert: true })

    if (!uploadError) {
      // Save the path to profiles table
      await supabase
        .from('profiles')
        .update({ avatar_url: fileName })
        .eq('id', session.user.id)

      // Get public URL to show immediately
      const { data: urlData } = supabase
        .storage
        .from('avatars')
        .getPublicUrl(fileName)

      setAvatarUrl(urlData.publicUrl)
    }

    setUploading(false)
  }

  // Saves profile name
  const handleSaveProfile = async () => {
    setSaving(true)

    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName })
      .eq('id', session.user.id)

    if (!error) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }

    setSaving(false)
  }

  // Submits a report
  const handleSubmitReport = async (e) => {
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
      fetchReports()
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

  const firstName = fullName
    ? fullName.split(' ')[0]
    : session.user.email.split('@')[0]

  return (
    <div className="settings-wrapper">
      <div className="step-label">settings</div>

      {/* Section tabs */}
      <div className="settings-tabs">
        {[
          { id: 'profile', label: '👤 profile' },
          { id: 'report', label: '🚨 report issue' },
          { id: 'account', label: '⚙️ account' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSection(tab.id)}
            className={`settings-tab ${activeSection === tab.id ? 'active' : ''}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* PROFILE SECTION */}
      {activeSection === 'profile' && (
        <div>
          <div className="card settings-card">

            {/* Avatar upload */}
            <div className="settings-avatar-row">
              <div className="settings-avatar" onClick={() => fileInputRef.current.click()}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt="profile" className="settings-avatar-img" />
                ) : (
                  <div className="settings-avatar-placeholder">
                    {firstName[0]?.toUpperCase()}
                  </div>
                )}
                {/* Camera overlay */}
                <div className="settings-avatar-overlay">
                  {uploading ? '...' : '📷'}
                </div>
              </div>

              <div>
                <p style={{ fontWeight: 500, fontSize: 15 }}>{firstName}</p>
                <p style={{ fontSize: 13, color: '#999', marginTop: 2 }}>
                  {session.user.email}
                </p>
                <p style={{ fontSize: 12, color: '#bbb', marginTop: 4 }}>
                  tap photo to change
                </p>
              </div>
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              style={{ display: 'none' }}
            />

            {/* Name input */}
            <div style={{ marginTop: 20 }}>
              <label className="settings-label">full name</label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="your full name"
                style={{ marginTop: 6 }}
              />
            </div>

            {/* Email (read only) */}
            <div style={{ marginTop: 14 }}>
              <label className="settings-label">email</label>
              <input
                type="email"
                value={session.user.email}
                disabled
                style={{ marginTop: 6, opacity: 0.6, cursor: 'not-allowed' }}
              />
            </div>

            {saved && (
              <div className="report-success" style={{ marginTop: 12 }}>
                ✓ profile saved!
              </div>
            )}

            <button
              className="btn-primary"
              onClick={handleSaveProfile}
              disabled={saving}>
              {saving ? 'saving...' : 'save profile'}
            </button>
          </div>
        </div>
      )}

      {/* REPORT SECTION */}
      {activeSection === 'report' && (
        <div>
          <div className="card settings-card">
            <p style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>
              having a problem with Connect? let us know!
            </p>

            <form onSubmit={handleSubmitReport}>
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

          {/* Past reports */}
          {myReports.length > 0 && (
            <div style={{ marginTop: 20 }}>
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
      )}

      {/* ACCOUNT SECTION */}
      {activeSection === 'account' && (
        <div>
          <div className="card settings-card">
            <div className="settings-account-row">
              <div>
                <p style={{ fontWeight: 500, fontSize: 14 }}>email</p>
                <p style={{ fontSize: 13, color: '#999', marginTop: 2 }}>{session.user.email}</p>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 16, marginTop: 16 }}>
              <div className="settings-account-row">
                <div>
                  <p style={{ fontWeight: 500, fontSize: 14 }}>member since</p>
                  <p style={{ fontSize: 13, color: '#999', marginTop: 2 }}>
                    {formatDate(session.user.created_at)}
                  </p>
                </div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 16, marginTop: 16 }}>
              <p style={{ fontSize: 13, color: '#999', marginBottom: 12 }}>
                need to change your password? log out and use the forgot password option on login.
              </p>
            </div>
          </div>

          {/* Log out button */}
          <button
            onClick={onLogout}
            style={{
              width: '100%', marginTop: 12, padding: 12,
              background: 'transparent', color: '#E24B4A',
              border: '1px solid #fca5a5', borderRadius: 12,
              fontSize: 14, fontFamily: 'DM Sans, sans-serif',
              cursor: 'pointer', fontWeight: 500
            }}>
            log out
          </button>
        </div>
      )}
    </div>
  )
}