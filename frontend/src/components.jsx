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

export function PageHeading({ title, description, action }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-[#193b2e] sm:text-2xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-[#728078]">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function Panel({ children, className = '' }) {
  return <section className={`rounded-2xl border border-[#e3e3e3] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)] sm:p-6 ${className}`}>{children}</section>
}

const buttonStyles = {
  primary: 'bg-[#1b4937] text-white shadow-sm hover:bg-[#143b2c] disabled:bg-[#a5b8ad]',
  secondary: 'border border-transparent bg-[#f1f1f1] text-[#303030] hover:bg-[#e8e8e8] disabled:opacity-50',
  subtle: 'bg-[#eef5ef] text-[#1b4937] hover:bg-[#e3efe5] disabled:opacity-50',
  danger: 'bg-[#a73532] text-white hover:bg-[#8e2b28] disabled:opacity-50',
}

export function Button({ children, variant = 'primary', className = '', ...props }) {
  return (
    <button
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed ${buttonStyles[variant]} ${className}`}
      {...props}
    >{children}</button>
  )
}

export function Field({ label, hint, className = '', ...props }) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="mb-1.5 block text-sm font-medium text-[#43544a]">{label}</span>}
      <input
        className="min-h-10 w-full rounded-lg border border-[#c9ccca] bg-white px-3 text-sm text-[#20372c] outline-none transition placeholder:text-[#a1aca4] focus:border-[#4b8b69] focus:ring-2 focus:ring-[#4b8b69]/15 disabled:bg-[#f3f5f2]"
        {...props}
      />
      {hint && <span className="mt-1.5 block text-xs leading-5 text-[#77847b]">{hint}</span>}
    </label>
  )
}

export function SelectField({ label, children, className = '', ...props }) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="mb-1.5 block text-sm font-medium text-[#43544a]">{label}</span>}
      <select
        className="min-h-10 w-full rounded-lg border border-[#c9ccca] bg-white px-3 text-sm text-[#20372c] outline-none focus:border-[#4b8b69] focus:ring-2 focus:ring-[#4b8b69]/15"
        {...props}
      >{children}</select>
    </label>
  )
}

export function Notice({ children, tone = 'error' }) {
  const style = tone === 'success'
    ? 'border-[#cce6d3] bg-[#edf8f0] text-[#25583b]'
    : tone === 'info'
      ? 'border-[#dce8e1] bg-[#f4f8f5] text-[#456252]'
      : 'border-[#f0d4d1] bg-[#fff4f2] text-[#973a35]'
  return <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-lg border px-4 py-3 text-sm leading-5 ${style}`}>{children}</div>
}

export function EmptyState({ children }) {
  return <div className="rounded-xl border border-dashed border-[#dce5dc] bg-[#fafbf9] px-4 py-9 text-center text-sm text-[#7a887f]">{children}</div>
}

export function LoadingState() {
  return <div className="flex min-h-32 items-center justify-center text-sm text-[#77847b]">{TEXT.messages.loading}</div>
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
        <input
          autoFocus
          autoComplete="off"
          value={value}
          onChange={(event) => { setValue(event.target.value); setSearched(false); setResults([]); setError(false) }}
          placeholder={placeholder || TEXT.labels.search}
          aria-label={placeholder || TEXT.labels.search}
          className="min-h-12 min-w-0 flex-1 rounded-xl border border-[#dce5dc] bg-white px-4 text-sm outline-none transition placeholder:text-[#a1aca4] focus:border-[#4b8b69] focus:ring-4 focus:ring-[#4b8b69]/10"
        />
        <Button type="submit" variant="secondary" disabled={loading || !value.trim()}>{TEXT.actions.search}</Button>
      </form>
      {error && <div role="alert" className="mt-3 rounded-lg border border-[#f0d4d1] bg-[#fff4f2] px-3 py-2 text-sm text-[#973a35]">{TEXT.errors.generic}</div>}
      {results.length > 0 && (
        <div className="mt-3 divide-y divide-[#edf0eb] overflow-hidden rounded-xl border border-[#e5eae4]">
          {results.map((product) => (
            <button
              type="button"
              key={product.id}
              onClick={async () => { await onSelect(product); setResults([]); setValue('') }}
              className="flex w-full items-center justify-between gap-3 bg-white px-4 py-3 text-left transition hover:bg-[#f5f8f4]"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-[#233b2e]">{product.name}</span>
                <span className="mt-1 block text-xs text-[#829087]">{product.barcode} · {product.stock_qty} {TEXT.labels.quantity.toLowerCase()}</span>
              </span>
              <span className="shrink-0 text-sm font-semibold text-[#1b4937]">{money(product.sell_price)}</span>
            </button>
          ))}
        </div>
      )}
      {results.length === 0 && searched && value.trim() && !loading && !error && (
        <p className="mt-3 text-sm text-[#829087]">{TEXT.messages.noResults}</p>
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
    logout: <><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/></>,
  }
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}
