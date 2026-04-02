import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function Admin({ session, onBack }) {
  const [activeTab, setActiveTab] = useState('overview')
  const [reports, setReports] = useState([])
  const [users, setUsers] = useState([])
  const [routes, setRoutes] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalRoutes: 0,
    openReports: 0,
    totalRuns: 0
  })

  useEffect(() => {
    fetchAll()
  }, [])

  const fetchAll = async () => {
    setLoading(true)

    // Fetch all reports
    const { data: reportsData } = await supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false })

    // Fetch all profiles
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    // Fetch all routes
    const { data: routesData } = await supabase
      .from('routes')
      .select('*')
      .order('created_at', { ascending: false })

    // Fetch all run history
    const { data: historyData } = await supabase
      .from('run_history')
      .select('*')

    if (reportsData) setReports(reportsData)
    if (profilesData) setUsers(profilesData)
    if (routesData) setRoutes(routesData)

    // Calculate stats
    setStats({
      totalUsers: profilesData?.length || 0,
      totalRoutes: routesData?.length || 0,
      openReports: reportsData?.filter(r => r.status === 'open').length || 0,
      totalRuns: historyData?.length || 0
    })

    setLoading(false)
  }

  // Update report status
  const updateReportStatus = async (reportId, newStatus) => {
    await supabase
      .from('reports')
      .update({ status: newStatus })
      .eq('id', reportId)

    setReports(reports.map(r =>
      r.id === reportId ? { ...r, status: newStatus } : r
    ))
  }

  const formatDate = (dateStr) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric',
      year: 'numeric', hour: '2-digit', minute: '2-digit'
    })
  }

  const statusColor = {
    open: { bg: '#fff8e6', color: '#b45309' },
    'in progress': { bg: '#e6f0ff', color: '#1d4ed8' },
    resolved: { bg: '#e6faf0', color: '#15803d' },
  }

  const tabs = [
    { id: 'overview', label: 'overview' },
    { id: 'reports', label: `reports ${stats.openReports > 0 ? `(${stats.openReports})` : ''}` },
    { id: 'users', label: 'users' },
    { id: 'routes', label: 'routes' },
  ]

  if (loading) {
    return (
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '2rem 1rem' }}>
        <div style={{ textAlign: 'center', color: '#999', fontSize: 14 }}>
          loading admin data...
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '1.5rem 1rem 5rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600 }}>Connect Admin ⚡</h1>
          <p style={{ fontSize: 13, color: '#999', marginTop: 2 }}>logged in as {session.user.email}</p>
        </div>
        <button onClick={onBack} className="btn-outline"
          style={{ width: 'auto', margin: 0, padding: '6px 14px', fontSize: 13 }}>
          ← back to app
        </button>
      </div>

      {/* Tab navigation */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 24,
        background: '#f0f0ea', borderRadius: 12, padding: 4 }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{ flex: 1, padding: '8px', border: 'none', borderRadius: 9,
              cursor: 'pointer', fontSize: 13, fontFamily: 'DM Sans, sans-serif',
              fontWeight: 500, transition: 'all 0.15s',
              background: activeTab === tab.id ? '#fff' : 'transparent',
              color: activeTab === tab.id ? '#111' : '#888',
              boxShadow: activeTab === tab.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div>
          {/* Stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
            {[
              { label: 'total users', value: stats.totalUsers },
              { label: 'routes generated', value: stats.totalRoutes },
              { label: 'open reports', value: stats.openReports, alert: stats.openReports > 0 },
              { label: 'runs completed', value: stats.totalRuns },
            ].map(stat => (
              <div key={stat.label} className="card" style={{
                padding: '16px',
                border: stat.alert ? '1px solid #fca5a5' : '1px solid #e8e8e8',
                background: stat.alert ? '#fff5f5' : '#fff'
              }}>
                <div style={{ marginBottom: 8 }} />
                <div style={{ fontSize: 28, fontWeight: 600 }}>{stat.value}</div>
                <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Recent reports preview */}
          {reports.filter(r => r.status === 'open').length > 0 && (
            <div>
              <div className="step-label">open reports needing attention</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {reports.filter(r => r.status === 'open').slice(0, 3).map(report => (
                  <div key={report.id} className="card" style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div style={{ fontWeight: 500, fontSize: 14 }}>{report.subject}</div>
                      <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20,
                        background: '#fff8e6', color: '#b45309', fontWeight: 500 }}>
                        open
                      </span>
                    </div>
                    <p style={{ fontSize: 13, color: '#888', marginTop: 4 }}>{report.email}</p>
                    <button onClick={() => setActiveTab('reports')}
                      className="btn-outline" style={{ marginTop: 8, padding: '6px', fontSize: 12 }}>
                      view & resolve →
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* REPORTS TAB */}
      {activeTab === 'reports' && (
        <div>
          <div className="step-label">{reports.length} total reports</div>

          {reports.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
              <p style={{ color: '#999', fontSize: 14 }}>no reports yet 🎉</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {reports.map(report => (
                <div key={report.id} className="card" style={{ padding: '16px' }}>

                  {/* Report header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 15 }}>{report.subject}</div>
                      <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
                        {report.email} · {formatDate(report.created_at)}
                      </div>
                    </div>
                    <span style={{
                      fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 500,
                      background: statusColor[report.status]?.bg || '#f0f0f0',
                      color: statusColor[report.status]?.color || '#888'
                    }}>
                      {report.status}
                    </span>
                  </div>

                  {/* Report message */}
                  <div style={{
                    background: '#f5f5f0', borderRadius: 8,
                    padding: '10px 12px', marginTop: 10,
                    fontSize: 13, color: '#444', lineHeight: 1.6
                  }}>
                    {report.message}
                  </div>

                  {/* Status update buttons */}
                  <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                    <button
                      onClick={() => updateReportStatus(report.id, 'open')}
                      style={{
                        flex: 1, padding: '7px', border: '1px solid',
                        borderColor: report.status === 'open' ? '#b45309' : '#e0e0e0',
                        borderRadius: 8, cursor: 'pointer', fontSize: 12,
                        background: report.status === 'open' ? '#fff8e6' : '#fff',
                        color: report.status === 'open' ? '#b45309' : '#888',
                        fontFamily: 'DM Sans, sans-serif'
                      }}>
                      open
                    </button>
                    <button
                      onClick={() => updateReportStatus(report.id, 'in progress')}
                      style={{
                        flex: 1, padding: '7px', border: '1px solid',
                        borderColor: report.status === 'in progress' ? '#1d4ed8' : '#e0e0e0',
                        borderRadius: 8, cursor: 'pointer', fontSize: 12,
                        background: report.status === 'in progress' ? '#e6f0ff' : '#fff',
                        color: report.status === 'in progress' ? '#1d4ed8' : '#888',
                        fontFamily: 'DM Sans, sans-serif'
                      }}>
                      in progress
                    </button>
                    <button
                      onClick={() => updateReportStatus(report.id, 'resolved')}
                      style={{
                        flex: 1, padding: '7px', border: '1px solid',
                        borderColor: report.status === 'resolved' ? '#15803d' : '#e0e0e0',
                        borderRadius: 8, cursor: 'pointer', fontSize: 12,
                        background: report.status === 'resolved' ? '#e6faf0' : '#fff',
                        color: report.status === 'resolved' ? '#15803d' : '#888',
                        fontFamily: 'DM Sans, sans-serif'
                      }}>
                      resolved
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* USERS TAB */}
      {activeTab === 'users' && (
        <div>
          <div className="step-label">{users.length} total users</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {users.map(user => (
              <div key={user.id} className="card" style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>
                      {user.full_name || 'no name'}
                    </div>
                    <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
                      {user.email}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: '#bbb' }}>
                    joined {formatDate(user.created_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ROUTES TAB */}
      {activeTab === 'routes' && (
        <div>
          <div className="step-label">{routes.length} total routes generated</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {routes.map(route => (
              <div key={route.id} className="card" style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>
                      {route.distance_km} km {route.shape} route
                    </div>
                    <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
                      {route.center_lat?.toFixed(4)}, {route.center_lng?.toFixed(4)}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: '#bbb' }}>
                    {formatDate(route.created_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}