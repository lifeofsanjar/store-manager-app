import { useState } from 'react'
import { ApiError, api } from '../api.js'
import { Button, Field, Notice } from '../components.jsx'
import { TEXT } from '../text.js'

export default function LoginView({ onLogin }) {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const result = await api('/auth/login/', {
        method: 'POST',
        body: { login, password },
      })
      onLogin(result)
    } catch (caught) {
      setError(caught instanceof ApiError && caught.code === 'network' ? TEXT.errors.network : TEXT.errors.login)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-900 px-4 py-10">
      <div aria-hidden="true" className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-brand-600/40 blur-3xl" />
      <div aria-hidden="true" className="absolute -bottom-40 -right-24 h-[28rem] w-[28rem] rounded-full bg-emerald-500/25 blur-3xl" />
      <div className="relative w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 text-xl font-bold text-white shadow-xl shadow-brand-600/40">{TEXT.brandMark}</div>
          <h1 className="text-3xl font-bold tracking-tight text-white">{TEXT.appName}</h1>
          <p className="mt-2 text-sm text-slate-300">{TEXT.tagline}</p>
        </div>
        <div className="rounded-3xl bg-white p-6 shadow-2xl shadow-black/30 sm:p-8">
          <h2 className="text-xl font-bold text-slate-900">{TEXT.messages.welcome}</h2>
          <p className="mt-1.5 text-sm leading-6 text-slate-500">{TEXT.messages.loginHint}</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <Field
              label={TEXT.labels.login}
              autoComplete="username"
              autoFocus
              value={login}
              onChange={(event) => setLogin(event.target.value)}
              required
            />
            <Field
              label={TEXT.labels.password}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            {error && <Notice>{error}</Notice>}
            <Button className="min-h-12 w-full text-base" type="submit" disabled={loading || !login.trim() || !password}>
              {loading ? TEXT.messages.loading : TEXT.actions.login}
            </Button>
          </form>
        </div>
      </div>
    </main>
  )
}
