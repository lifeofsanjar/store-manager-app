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

function NavigationLink({ id, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`flex min-h-11 shrink-0 items-center gap-3 rounded-xl px-3.5 text-sm font-medium transition md:w-full ${active ? 'bg-[#1b4937] text-white shadow-sm' : 'text-[#607067] hover:bg-[#edf3ed] hover:text-[#1b4937]'}`}
    >
      <Icon name={id} className="h-[18px] w-[18px]" />
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

  const pageTitle = TEXT.headings[page] || TEXT.headings.stats
  return (
    <div className="min-h-screen bg-[#f6f6f7]">
      <header className="sticky top-0 z-20 border-b border-[#e3e3e3] bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[68px] max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1b4937] text-xs font-bold text-white">{TEXT.brandMark}</div>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-[#193b2e] sm:text-base">{TEXT.appName}</div>
              <div className="hidden text-xs text-[#87928a] sm:block">{TEXT.tagline}</div>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="hidden text-right sm:block">
              <div className="max-w-48 truncate text-sm font-semibold text-[#33483b]">{session.user.name}</div>
              <div className="text-xs text-[#87928a]">{TEXT.roles[session.user.role]}</div>
            </div>
            <Button variant="secondary" className="min-h-10 gap-2 px-3" onClick={logOut}>
              <Icon name="logout" className="h-4 w-4" />
              <span className="hidden sm:inline">{TEXT.actions.logout}</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] px-3 pb-8 pt-4 sm:px-6 sm:pt-6 lg:px-8">
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1 md:hidden">
          {navigation.map(([id, icon]) => <NavigationLink key={id} id={icon} active={page === id} onClick={() => setPage(id)} />)}
        </div>
        <div className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)] lg:grid-cols-[248px_minmax(0,1fr)]">
          <aside className="hidden md:block">
            <div className="sticky top-[88px] rounded-xl border border-[#e3e3e3] bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
              <p className="mb-2 px-3 pt-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#a0aaa2]">{TEXT.appShort}</p>
              <nav className="space-y-5">
                {navigationGroups.filter(([, items]) => items.some(([id]) => navigation.some(([visible]) => visible === id))).map(([group, items]) => {
                  const visibleItems = items.filter(([id]) => navigation.some(([visible]) => visible === id))
                  return visibleItems.length ? <div key={group}>
                    <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#9aa59d]">{TEXT.navGroups[group]}</p>
                    <div className="space-y-1">{visibleItems.map(([id, icon]) => <NavigationLink key={id} id={icon} active={page === id} onClick={() => setPage(id)} />)}</div>
                  </div> : null
                })}
              </nav>
              <div className="mt-5 border-t border-[#edf0eb] px-3 pt-4">
                <div className="truncate text-sm font-semibold text-[#33483b]">{session.user.name}</div>
                <div className="mt-1 text-xs text-[#87928a]">{TEXT.roles[session.user.role]}</div>
              </div>
            </div>
          </aside>
          <main className="min-w-0">
            <ActiveView page={page} session={session} />
            <footer className="mt-8 text-center text-xs text-[#a1aaa3]">{pageTitle} · {TEXT.appName}</footer>
          </main>
        </div>
      </div>
    </div>
  )
}
