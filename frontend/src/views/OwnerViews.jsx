import { useEffect, useState } from 'react'
import { ApiError, api, queryString } from '../api.js'
import { Button, dateTime, EmptyState, money, Notice, PageHeading, Panel } from '../components.jsx'
import { TEXT } from '../text.js'

function formatPeriodDate(value) {
  if (!value) return ''
  const [year, month, day] = value.split('-').map(Number)
  const monthName = TEXT.months[month - 1]
  return monthName ? `${day}-${monthName} ${year}` : value
}

function StatisticsView({ token }) {
  const [period, setPeriod] = useState('day')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    api(`/statistics/${queryString({ period })}`, { token })
      .then((result) => { if (active) setData(result) })
      .catch((caught) => { if (active) setError(caught instanceof ApiError ? TEXT.errors[caught.code] || TEXT.errors.generic : TEXT.errors.generic) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [period, token])

  const metrics = [
    { label: TEXT.labels.total, value: data ? money(data.sales_total) : '—', tone: 'text-[#193b2e]' },
    { label: TEXT.labels.profit, value: data ? money(data.profit) : '—', tone: 'text-[#193b2e]' },
    { label: TEXT.labels.salesCount, value: data ? new Intl.NumberFormat('uz-UZ').format(data.sales_count) : '—', tone: 'text-[#193b2e]' },
    { label: TEXT.labels.unitsSold, value: data ? new Intl.NumberFormat('uz-UZ').format(data.units_sold) : '—', tone: 'text-[#193b2e]' },
  ]
  const topProducts = data?.top_products || []
  const highestQuantity = Math.max(1, ...topProducts.map((product) => product.quantity))

  return (
    <>
      <PageHeading title={TEXT.headings.stats} description={TEXT.descriptions.stats} />
      <div className="mb-4 flex w-fit gap-1 rounded-xl bg-[#e9eee8] p-1">
        {Object.entries(TEXT.periods).map(([key, label]) => (
          <button key={key} type="button" aria-pressed={period === key} onClick={() => setPeriod(key)} className={`min-h-10 rounded-lg px-4 text-sm font-semibold transition ${period === key ? 'bg-white text-[#1b4937] shadow-sm' : 'text-[#77847b] hover:text-[#1b4937]'}`}>{label}</button>
        ))}
      </div>
      {error && <Notice>{error}</Notice>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric, index) => <Panel key={metric.label} className="relative overflow-hidden">
          <div className={`absolute right-0 top-0 h-20 w-20 -translate-y-7 translate-x-7 rounded-full ${index === 1 ? 'bg-[#fff3e2]' : 'bg-[#edf6ee]'}`} />
          <div className="relative text-sm font-medium text-[#78867d]">{metric.label}</div>
          <div className={`relative mt-3 text-2xl font-bold tracking-tight ${metric.tone}`}>{loading ? '—' : metric.value}</div>
          <div className="relative mt-2 text-xs text-[#87928a]">{TEXT.periods[period]}</div>
        </Panel>)}
      </div>
      <Panel className="mt-4">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[#253c30]">{TEXT.headings.topProducts}</h2>
            <p className="mt-1 text-sm text-[#78867d]">{TEXT.descriptions.topProducts} · {TEXT.periods[period].toLowerCase()}</p>
          </div>
          <span className="rounded-full bg-[#eef5ef] px-3 py-1 text-xs font-semibold text-[#4a6756]">{topProducts.length}</span>
        </div>
        {loading ? <div className="py-8 text-center text-sm text-[#77847b]">{TEXT.messages.loading}</div> : topProducts.length ? (
          <div className="divide-y divide-[#edf0eb]">
            {topProducts.map((product, index) => (
              <div key={product.product_id} className="py-3.5 first:pt-1 last:pb-1">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f1f5f0] text-xs font-bold text-[#55705e]">{index + 1}</span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-[#283e32]">{product.product_name}</div>
                      <div className="mt-0.5 text-xs text-[#87928a]">{product.barcode}</div>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-bold text-[#274534]">{product.quantity} {TEXT.labels.quantity.toLowerCase()}</div>
                    <div className="mt-0.5 text-xs text-[#87928a]">{money(product.revenue)}</div>
                  </div>
                </div>
                <div className="ml-11 mt-2 h-1.5 overflow-hidden rounded-full bg-[#edf1ec]" aria-label={`${product.product_name}: ${product.quantity} ${TEXT.labels.quantity.toLowerCase()}`}>
                  <div className="h-full rounded-full bg-[#4d8b65]" style={{ width: `${Math.max(6, (product.quantity / highestQuantity) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        ) : <EmptyState>{TEXT.messages.noTopProducts}</EmptyState>}
      </Panel>
      <Panel className="mt-4 flex items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-[#9aa49d]">{TEXT.labels.period}</div>
          <div className="mt-1 text-sm font-semibold text-[#33483b]">{data ? `${formatPeriodDate(data.from)} — ${formatPeriodDate(data.through)}` : TEXT.periods[period]}</div>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#eef5ef] text-[#477555]">↗</div>
      </Panel>
    </>
  )
}

function DebtList({ token }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    api('/sales/debts/', { token })
      .then(setRows)
      .catch((caught) => setError(caught instanceof ApiError ? TEXT.errors[caught.code] || TEXT.errors.generic : TEXT.errors.generic))
      .finally(() => setLoading(false))
  }, [token])

  return (
    <>
      <PageHeading title={TEXT.headings.debts} description={TEXT.descriptions.debts} />
      <Panel className="mt-5">
        {error && <Notice>{error}</Notice>}
        {loading ? <div className="py-8 text-center text-sm text-[#77847b]">{TEXT.messages.loading}</div> : rows.length ? (
          <div className="space-y-3">
            {rows.map((row) => (
              <div key={row.sale_id} className="flex flex-col gap-3 rounded-xl border border-[#e8ede7] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-[#293f33]">#{row.sale_id}</div>
                  <div className="mt-1 text-xs text-[#87928a]">{dateTime(row.created_at)}</div>
                  {row.note && <div className="mt-2 break-words text-sm text-[#526158]">{row.note}</div>}
                </div>
                <div className="shrink-0 rounded-xl bg-[#fff6e9] px-4 py-3 sm:text-right">
                  <div className="text-xs font-medium text-[#99713a]">{TEXT.labels.debt}</div>
                  <div className="mt-1 text-base font-bold text-[#835714]">{money(row.unpaid_amount)}</div>
                </div>
              </div>
            ))}
          </div>
        ) : <EmptyState>{TEXT.messages.noDebts}</EmptyState>}
      </Panel>
    </>
  )
}

function LowStockList({ token }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    api('/low-stock/', { token })
      .then(setRows)
      .catch((caught) => setError(caught instanceof ApiError ? TEXT.errors[caught.code] || TEXT.errors.generic : TEXT.errors.generic))
      .finally(() => setLoading(false))
  }, [token])

  return (
    <>
      <PageHeading title={TEXT.headings.lowStock} description={TEXT.descriptions.lowStock} />
      <Panel className="mt-5">
        {error && <Notice>{error}</Notice>}
        {loading ? <div className="py-8 text-center text-sm text-[#77847b]">{TEXT.messages.loading}</div> : rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="border-b border-[#edf0eb] text-xs uppercase tracking-wide text-[#8c9890]">
                <tr><th className="pb-3 pr-4 font-semibold">{TEXT.labels.product}</th><th className="pb-3 px-4 font-semibold">{TEXT.labels.barcode}</th><th className="pb-3 px-4 font-semibold">{TEXT.labels.lowStock}</th><th className="pb-3 pl-4 text-right font-semibold">{TEXT.labels.minStock}</th></tr>
              </thead>
              <tbody className="divide-y divide-[#edf0eb]">
                {rows.map((product) => (
                  <tr key={product.id}>
                    <td className="py-3.5 pr-4 font-semibold text-[#2b4034]">{product.name}</td>
                    <td className="px-4 py-3.5 text-[#77847b]">{product.barcode}</td>
                    <td className="px-4 py-3.5"><span className="rounded-full bg-[#fff3e2] px-2.5 py-1 font-semibold text-[#895b19]">{product.stock_qty}</span></td>
                    <td className="py-3.5 pl-4 text-right text-[#5e6d63]">{product.min_stock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState>{TEXT.messages.noLowStock}</EmptyState>}
      </Panel>
    </>
  )
}

export default function OwnerViews({ page, token }) {
  if (page === 'debts') return <DebtList token={token} />
  if (page === 'lowStock') return <LowStockList token={token} />
  return <StatisticsView token={token} />
}
