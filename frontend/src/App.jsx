import { useEffect, useMemo, useState } from 'react'
import { Button, Icon } from './components.jsx'
import { TEXT } from './text.js'
import LoginView from './views/LoginView.jsx'
import OwnerViews from './views/OwnerViews.jsx'
import RestockView from './views/RestockView.jsx'
import ReturnView from './views/ReturnView.jsx'
import SaleView from './views/SaleView.jsx'
import StockView from './views/StockView.jsx'
import TodaySalesView from './views/TodaySalesView.jsx'

const SESSION_KEY = 'store-manager-session'

const staffNavigation = [
  ['sale', 'sale'],
  ['restock', 'restock'],
  ['returns', 'returns'],
  ['today', 'today'],
  ['stock', 'stock'],
]
const ownerNavigation = [
  ['stats', 'stats'],
  ['debts', 'debts'],
  ['lowStock', 'lowStock'],
]
const navigationGroups = [
  ['management', ownerNavigation],
  ['work', staffNavigation],
]

function readSession() {
  try {
    const value = sessionStorage.getItem(SESSION_KEY)
    return value ? JSON.parse(value) : null
  } catch {
    return null
  }
}

function NavigationLink({ id, active, onClick, compact = false }) {
  if (compact) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-current={active ? 'page' : undefined}
        className={`flex min-h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold transition ${active ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:text-brand-700'}`}
      >
        <Icon name={id} className="h-4 w-4" />
        <span>{TEXT.nav[id]}</span>
      </button>
    )
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`group relative flex min-h-11 w-full items-center gap-3 rounded-xl px-3.5 text-sm font-medium transition ${active ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
    >
      {active && <span aria-hidden="true" className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-brand-400" />}
      <span className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${active ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/40' : 'bg-white/5 text-slate-400 group-hover:text-white'}`}>
        <Icon name={id} className="h-[18px] w-[18px]" />
      </span>
      <span>{TEXT.nav[id]}</span>
    </button>
  )
}

function ActiveView({ page, session }) {
  const common = { token: session.access_token }
  if (page === 'sale') return <SaleView {...common} />
  if (page === 'restock') return <RestockView {...common} />
  if (page === 'returns') return <ReturnView {...common} />
  if (page === 'today') return <TodaySalesView {...common} />
  if (page === 'stock') return <StockView {...common} role={session.user.role} />
  return <OwnerViews page={page} {...common} />
}

export default function App() {
  const [session, setSession] = useState(readSession)
  const [page, setPage] = useState(() => readSession()?.user?.role === 'owner' ? 'stats' : 'sale')

  useEffect(() => {
    const expire = () => {
      sessionStorage.removeItem(SESSION_KEY)
      setSession(null)
    }
    window.addEventListener('store-auth-expired', expire)
    return () => window.removeEventListener('store-auth-expired', expire)
  }, [])

  const navigation = useMemo(() => [
    ...(session?.user?.role === 'owner' ? ownerNavigation : []),
    ...staffNavigation,
  ], [session?.user?.role])

  function logIn(value) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(value))
    setSession(value)
    setPage(value.user.role === 'owner' ? 'stats' : 'sale')
  }

  function logOut() {
    sessionStorage.removeItem(SESSION_KEY)
    setSession(null)
  }

  if (!session?.access_token || !session?.user) return <LoginView onLogin={logIn} />

  const visibleGroups = navigationGroups
    .map(([group, items]) => [group, items.filter(([id]) => navigation.some(([visible]) => visible === id))])
    .filter(([, items]) => items.length)

  return (
    <div className="min-h-screen bg-slate-100 md:grid md:grid-cols-[256px_minmax(0,1fr)]">
      <aside className="hidden md:block">
        <div className="sticky top-0 flex h-screen flex-col bg-slate-900 px-4 py-5 text-white">
          <div className="flex items-center gap-3 px-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-sm font-bold shadow-lg shadow-brand-500/30">{TEXT.brandMark}</div>
            <div className="min-w-0">
              <div className="truncate text-[15px] font-bold">{TEXT.appName}</div>
              <div className="truncate text-xs text-slate-400">{TEXT.tagline}</div>
            </div>
          </div>
          <nav className="mt-8 flex-1 space-y-6 overflow-y-auto">
            {visibleGroups.map(([group, items]) => (
              <div key={group}>
                <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">{TEXT.navGroups[group]}</p>
                <div className="space-y-1">{items.map(([id, icon]) => <NavigationLink key={id} id={icon} active={page === id} onClick={() => setPage(id)} />)}</div>
              </div>
            ))}
          </nav>
          <div className="mt-4 rounded-2xl bg-white/5 p-3">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-700 text-slate-200"><Icon name="user" className="h-[18px] w-[18px]" /></span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{session.user.name}</div>
                <div className="text-xs text-slate-400">{TEXT.roles[session.user.role]}</div>
              </div>
              <button type="button" onClick={logOut} title={TEXT.actions.logout} aria-label={TEXT.actions.logout} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white">
                <Icon name="logout" className="h-[18px] w-[18px]" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur-xl md:hidden">
          <div className="flex h-16 items-center justify-between px-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-bold text-white">{TEXT.brandMark}</div>
              <div className="min-w-0">
                <div className="truncate text-sm font-bold text-slate-900">{TEXT.appName}</div>
                <div className="truncate text-xs text-slate-500">{session.user.name} · {TEXT.roles[session.user.role]}</div>
              </div>
            </div>
            <Button variant="secondary" className="min-h-10 px-3" onClick={logOut} aria-label={TEXT.actions.logout}>
              <Icon name="logout" className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none]">
            {navigation.map(([id, icon]) => <NavigationLink key={id} id={icon} compact active={page === id} onClick={() => setPage(id)} />)}
          </div>
        </header>

        <main className="mx-auto max-w-[1280px] px-4 pb-10 pt-5 sm:px-6 md:pt-8 lg:px-10">
          <ActiveView page={page} session={session} />
        </main>
      </div>
    </div>
  )
}
