import { useState } from 'react'
import { api, queryString } from './api.js'
import { TEXT } from './text.js'

export const money = (value) => `${new Intl.NumberFormat('uz-UZ').format(Number(value || 0))} ${TEXT.labels.currency}`

export function dateTime(value) {
  return new Intl.DateTimeFormat('uz-UZ', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(value))
}

export function PageHeading({ title, description, action, icon }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3.5">
        {icon && (
          <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-600/25 sm:flex">
            <Icon name={icon} className="h-6 w-6" />
          </span>
        )}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[28px]">{title}</h1>
          {description && <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  )
}

export function Panel({ children, className = '' }) {
  return <section className={`rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-900/5 sm:p-6 ${className}`}>{children}</section>
}

export function SectionTitle({ children, aside }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-base font-bold text-slate-900">{children}</h2>
      {aside}
    </div>
  )
}

const buttonStyles = {
  primary: 'bg-brand-600 text-white shadow-md shadow-brand-600/25 hover:bg-brand-700 active:bg-brand-800 disabled:bg-slate-300 disabled:text-slate-600 disabled:shadow-none',
  secondary: 'border border-slate-300 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50 disabled:opacity-50',
  subtle: 'bg-brand-50 text-brand-700 hover:bg-brand-100 disabled:opacity-50',
  success: 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25 hover:bg-emerald-700 disabled:bg-slate-300 disabled:text-slate-600 disabled:shadow-none',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50',
}

export function Button({ children, variant = 'primary', className = '', ...props }) {
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100 ${buttonStyles[variant]} ${className}`}
      {...props}
    >{children}</button>
  )
}

const inputClass = 'min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-500 hover:border-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 disabled:bg-slate-100'

export function Field({ label, hint, className = '', ...props }) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span>}
      <input className={inputClass} {...props} />
      {hint && <span className="mt-1.5 block text-xs leading-5 text-slate-500">{hint}</span>}
    </label>
  )
}

export function SelectField({ label, children, className = '', ...props }) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span>}
      <select className={inputClass} {...props}>{children}</select>
    </label>
  )
}

export function Notice({ children, tone = 'error' }) {
  const styles = {
    success: ['border-emerald-200 bg-emerald-50 text-emerald-800', 'bg-emerald-500', '✓'],
    info: ['border-sky-200 bg-sky-50 text-sky-800', 'bg-sky-500', 'i'],
    error: ['border-rose-200 bg-rose-50 text-rose-800', 'bg-rose-500', '!'],
  }
  const [style, dot, mark] = styles[tone] || styles.error
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm font-medium leading-5 ${style}`}>
      <span aria-hidden="true" className={`mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${dot}`}>{mark}</span>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

export function EmptyState({ children }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60 px-4 py-10 text-center text-sm text-slate-500">
      <span aria-hidden="true" className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm">
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7h18M5 7l1 13h12l1-13M9 7V4h6v3"/></svg>
      </span>
      {children}
    </div>
  )
}

export function LoadingState() {
  return (
    <div className="flex min-h-32 items-center justify-center gap-3 text-sm text-slate-500">
      <span aria-hidden="true" className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600" />
      {TEXT.messages.loading}
    </div>
  )
}

const statTones = {
  brand: 'from-brand-50 text-brand-700 ring-brand-100',
  emerald: 'from-emerald-50 text-emerald-700 ring-emerald-100',
  amber: 'from-amber-50 text-amber-700 ring-amber-100',
  sky: 'from-sky-50 text-sky-700 ring-sky-100',
}

export function StatCard({ label, value, hint, icon, tone = 'brand' }) {
  return (
    <section className={`rounded-2xl bg-gradient-to-br to-white p-4 shadow-sm sm:p-5 shadow-slate-900/5 ring-1 ${statTones[tone]}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 truncate text-sm font-semibold text-slate-600">{label}</span>
        {icon && <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm"><Icon name={icon} className="h-[18px] w-[18px]" /></span>}
      </div>
      <div className="mt-3 truncate text-lg font-bold tracking-tight text-slate-900 sm:text-[26px]">{value}</div>
      {hint && <div className="mt-1 text-xs font-medium text-slate-500">{hint}</div>}
    </section>
  )
}

export function ProductLookup({ token, onSelect, placeholder, autoAddBarcode = false }) {
  const [value, setValue] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [searched, setSearched] = useState(false)

  async function search(event) {
    event?.preventDefault()
    if (!value.trim()) return
    setLoading(true)
    setError(false)
    setSearched(true)
    try {
      const exact = await api(`/products/${queryString({ barcode: value.trim() })}`, { token })
      if (exact.length === 1 && autoAddBarcode) {
        await onSelect(exact[0])
        setValue('')
        setResults([])
        return
      }
      const found = exact.length ? exact : await api(`/products/${queryString({ q: value.trim() })}`, { token })
      setResults(found)
      if (found.length === 1 && autoAddBarcode) {
        await onSelect(found[0])
        setValue('')
        setResults([])
      }
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <form onSubmit={search} className="flex gap-2">
        <div className="relative min-w-0 flex-1">
        <Icon name="search" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input
          autoFocus
          autoComplete="off"
          value={value}
          onChange={(event) => { setValue(event.target.value); setSearched(false); setResults([]); setError(false) }}
          placeholder={placeholder || TEXT.labels.search}
          aria-label={placeholder || TEXT.labels.search}
          className="min-h-14 w-full rounded-2xl border-2 border-slate-200 bg-white pl-12 pr-4 text-base outline-none transition placeholder:text-slate-500 hover:border-slate-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
        />
        </div>
        <Button type="submit" className="min-h-14 rounded-2xl px-6" disabled={loading || !value.trim()}>{TEXT.actions.search}</Button>
      </form>
      {error && <div className="mt-3"><Notice>{TEXT.errors.generic}</Notice></div>}
      {results.length > 0 && (
        <div className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 shadow-lg shadow-slate-900/5">
          {results.map((product) => (
            <button
              type="button"
              key={product.id}
              onClick={async () => { await onSelect(product); setResults([]); setValue('') }}
              className="group flex w-full items-center justify-between gap-3 bg-white px-4 py-3.5 text-left transition hover:bg-brand-50"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-slate-800">{product.name}</span>
                <span className="mt-1 block text-xs text-slate-500">{product.barcode} · {product.stock_qty} {TEXT.labels.quantity.toLowerCase()}</span>
              </span>
              <span className="flex shrink-0 items-center gap-3"><span className="text-sm font-bold text-slate-900">{money(product.sell_price)}</span><span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-lg font-semibold text-brand-700 transition group-hover:bg-brand-600 group-hover:text-white">+</span></span>
            </button>
          ))}
        </div>
      )}
      {results.length === 0 && searched && value.trim() && !loading && !error && (
        <p className="mt-3 text-sm text-slate-500">{TEXT.messages.noResults}</p>
      )}
    </div>
  )
}

export function Icon({ name, className = 'h-5 w-5' }) {
  const paths = {
    stats: <><path d="M4 19V5"/><path d="M4 19h17"/><path d="m7 14 4-4 3 2 5-6"/><path d="M16 6h3v3"/></>,
    debts: <><circle cx="12" cy="12" r="9"/><path d="M12 7v10"/><path d="M15 9.5c-.5-1-1.5-1.5-3-1.5-1.7 0-2.8.8-2.8 2s1 1.8 2.8 2c1.7.2 2.8.8 2.8 2s-1.2 2-2.8 2c-1.5 0-2.5-.5-3-1.5"/></>,
    lowStock: <><path d="M12 3 2.8 19h18.4L12 3Z"/><path d="M12 9v4"/><path d="M12 16h.01"/></>,
    sale: <><path d="M4 5h2l2.2 10.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.6L21 9H7"/><circle cx="10" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></>,
    restock: <><path d="M12 4v12"/><path d="m7 9 5-5 5 5"/><path d="M5 14v5h14v-5"/></>,
    returns: <><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-2"/></>,
    today: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/><path d="m8 15 2 2 5-5"/></>,
    stock: <><path d="M4 5h16M4 12h16M4 19h16"/><path d="m8 3-4 2 4 2M16 10l4 2-4 2M8 17l-4 2 4 2"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></>,
    cash: <><rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 9.5v5M18 9.5v5"/></>,
    card: <><rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 10h19M6.5 15h4"/></>,
    receipt: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6M9 12h6"/></>,
    box: <><path d="m3 7 9-4 9 4-9 4-9-4Z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    logout: <><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/></>,
  }
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}
