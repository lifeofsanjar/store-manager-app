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
    <main className="flex min-h-screen items-center justify-center bg-[#f6f6f7] px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1b4937] text-lg font-bold text-white shadow-lg shadow-[#1b4937]/20">{TEXT.brandMark}</div>
          <h1 className="text-2xl font-bold tracking-tight text-[#193b2e]">{TEXT.appName}</h1>
          <p className="mt-2 text-sm text-[#728078]">{TEXT.tagline}</p>
        </div>
        <div className="rounded-2xl border border-[#e3e3e3] bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.05)] sm:p-8">
          <h2 className="text-xl font-bold text-[#20372c]">{TEXT.messages.welcome}</h2>
          <p className="mt-1.5 text-sm leading-6 text-[#77847b]">{TEXT.messages.loginHint}</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <Field
              label={TEXT.labels.login}
              autoComplete="username"
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
            <Button className="w-full" type="submit" disabled={loading || !login.trim() || !password}>
              {loading ? TEXT.messages.loading : TEXT.actions.login}
            </Button>
          </form>
        </div>
      </div>
    </main>
  )
}
