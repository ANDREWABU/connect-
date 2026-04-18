// Demo mode — no backend required. All data lives in localStorage.

const DEMO_EMAIL = 'demo@connect.run'
const DEMO_PASSWORD = 'demo1234'
const DEMO_USER = {
  id: 'demo-user-id',
  email: DEMO_EMAIL,
  created_at: '2024-01-01T00:00:00Z',
}

function ls(key, def = null) {
  try { return JSON.parse(localStorage.getItem(key)) ?? def }
  catch { return def }
}
function lsSet(key, val) { localStorage.setItem(key, JSON.stringify(val)) }

// ---- query builder (mirrors supabase-js chaining API) ----
class Query {
  constructor(table) {
    this._table = table
    this._filters = {}
    this._order = null
    this._single = false
    this._type = 'select'
    this._data = null
  }

  select() { this._type = 'select'; return this }

  insert(data) {
    this._type = 'insert'
    this._data = Array.isArray(data) ? data : [data]
    return this._run()
  }

  update(data) { this._type = 'update'; this._data = data; return this }

  delete() { this._type = 'delete'; return this }

  eq(col, val) { this._filters[col] = val; return this }

  order(col, { ascending = true } = {}) { this._order = { col, ascending }; return this }

  single() { this._single = true; return this._run() }

  then(resolve, reject) { return this._run().then(resolve, reject) }

  _rows() { return ls(`tbl_${this._table}`, []) }

  _save(rows) { lsSet(`tbl_${this._table}`, rows) }

  _match(row) {
    return Object.entries(this._filters).every(([k, v]) => row[k] === v)
  }

  _run() {
    const rows = this._rows()

    if (this._type === 'select') {
      let result = rows.filter(r => this._match(r))
      if (this._order) {
        result = [...result].sort((a, b) => {
          const av = a[this._order.col], bv = b[this._order.col]
          return this._order.ascending ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
        })
      }
      if (this._single) return Promise.resolve({ data: result[0] ?? null, error: null })
      return Promise.resolve({ data: result, error: null })
    }

    if (this._type === 'insert') {
      const inserted = this._data.map(d => ({
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
        created_at: new Date().toISOString(),
        ...d,
      }))
      this._save([...rows, ...inserted])
      return Promise.resolve({ data: inserted, error: null })
    }

    if (this._type === 'update') {
      this._save(rows.map(r => this._match(r) ? { ...r, ...this._data } : r))
      return Promise.resolve({ data: null, error: null })
    }

    if (this._type === 'delete') {
      this._save(rows.filter(r => !this._match(r)))
      return Promise.resolve({ data: null, error: null })
    }

    return Promise.resolve({ data: null, error: null })
  }
}

// ---- auth state listeners ----
const listeners = []

export const supabase = {
  auth: {
    getSession: () => {
      const session = ls('demo_session')
      return Promise.resolve({ data: { session } })
    },

    signInWithPassword: ({ email, password }) => {
      if (email === DEMO_EMAIL && password === DEMO_PASSWORD) {
        const session = { user: DEMO_USER, access_token: 'demo-token' }
        lsSet('demo_session', session)
        listeners.forEach(cb => cb('SIGNED_IN', session))
        return Promise.resolve({ error: null })
      }
      return Promise.resolve({ error: { message: 'Invalid login credentials' } })
    },

    signUp: () => Promise.resolve({
      error: { message: 'Sign up is disabled in demo mode — use demo@connect.run / demo1234' },
    }),

    signOut: () => {
      localStorage.removeItem('demo_session')
      listeners.forEach(cb => cb('SIGNED_OUT', null))
      return Promise.resolve({ error: null })
    },

    onAuthStateChange: (callback) => {
      listeners.push(callback)
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              const i = listeners.indexOf(callback)
              if (i > -1) listeners.splice(i, 1)
            },
          },
        },
      }
    },
  },

  from: (table) => new Query(table),

  storage: {
    from: () => ({
      upload: () => Promise.resolve({ error: null }),
      getPublicUrl: () => ({ data: { publicUrl: null } }),
    }),
  },
}
