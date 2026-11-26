import { useEffect, useState } from 'react'
import { ApiError, api, queryString } from '../api.js'
import { dateTime, EmptyState, Icon, LoadingState, money, Notice, PageHeading, Panel, StatCard } from '../components.jsx'
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
    { label: TEXT.labels.total, value: data ? money(data.sales_total) : '—', tone: 'brand', icon: 'cash' },
    { label: TEXT.labels.profit, value: data ? money(data.profit) : '—', tone: 'emerald', icon: 'stats' },
    { label: TEXT.labels.salesCount, value: data ? new Intl.NumberFormat('uz-UZ').format(data.sales_count) : '—', tone: 'sky', icon: 'receipt' },
    { label: TEXT.labels.unitsSold, value: data ? new Intl.NumberFormat('uz-UZ').format(data.units_sold) : '—', tone: 'amber', icon: 'box' },
  ]
  const topProducts = data?.top_products || []
  const highestQuantity = Math.max(1, ...topProducts.map((product) => product.quantity))

  return (
    <>
      <PageHeading icon="stats" title={TEXT.headings.stats} description={TEXT.descriptions.stats} action={
        <div className="flex w-full gap-1 rounded-2xl bg-white p-1 shadow-sm ring-1 ring-slate-200 sm:w-fit">
          {Object.entries(TEXT.periods).map(([key, label]) => (
            <button key={key} type="button" aria-pressed={period === key} onClick={() => setPeriod(key)} className={`min-h-10 flex-1 rounded-xl px-5 text-sm font-semibold transition sm:flex-none ${period === key ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30' : 'text-slate-600 hover:bg-slate-50 hover:text-brand-700'}`}>{label}</button>
          ))}
        </div>
      } />
      {error && <Notice>{error}</Notice>}
      <div className="mt-1 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {metrics.map((metric) => <StatCard key={metric.label} label={metric.label} value={loading ? '—' : metric.value} hint={TEXT.periods[period]} icon={metric.icon} tone={metric.tone} />)}
      </div>
      <Panel className="mt-4">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-800">{TEXT.labels.topProducts}</h2>
            <p className="mt-1 text-sm text-slate-500">{TEXT.descriptions.topProducts} · {TEXT.periods[period].toLowerCase()}</p>
          </div>
          <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">{topProducts.length}</span>
        </div>
        {loading ? <LoadingState /> : topProducts.length ? (
          <div className="divide-y divide-slate-200">
            {topProducts.map((product, index) => (
              <div key={product.product_id} className="py-3.5 first:pt-1 last:pb-1">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-xs font-bold text-brand-700">{index + 1}</span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-800">{product.product_name}</div>
                      <div className="mt-0.5 text-xs text-slate-500">{product.barcode}</div>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-bold text-slate-800">{product.quantity} {TEXT.labels.quantity.toLowerCase()}</div>
                    <div className="mt-0.5 text-xs text-slate-500">{money(product.revenue)}</div>
                  </div>
                </div>
                <div className="ml-11 mt-2 h-2 overflow-hidden rounded-full bg-slate-100" aria-label={`${product.product_name}: ${product.quantity} ${TEXT.labels.quantity.toLowerCase()}`}>
                  <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-400" style={{ width: `${Math.max(6, (product.quantity / highestQuantity) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        ) : <EmptyState>{TEXT.messages.noTopProducts}</EmptyState>}
      </Panel>
      <Panel className="mt-4 flex items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{TEXT.labels.period}</div>
          <div className="mt-1 text-sm font-semibold text-slate-700">{data ? `${formatPeriodDate(data.from)} — ${formatPeriodDate(data.through)}` : TEXT.periods[period]}</div>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Icon name="today" className="h-5 w-5" /></div>
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
      <PageHeading icon="debts" title={TEXT.headings.debts} description={TEXT.descriptions.debts} />
      <Panel className="mt-5">
        {error && <Notice>{error}</Notice>}
        {loading ? <LoadingState /> : rows.length ? (
          <div className="space-y-3">
            {rows.map((row) => (
              <div key={row.sale_id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 border-l-4 border-l-amber-400 p-4 transition hover:shadow-md sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-800">#{row.sale_id}</div>
                  <div className="mt-1 text-xs text-slate-500">{dateTime(row.created_at)}</div>
                  {row.note && <div className="mt-2 break-words text-sm text-slate-600">{row.note}</div>}
                </div>
                <div className="shrink-0 rounded-xl bg-amber-50 px-4 py-3 ring-1 ring-amber-200 sm:text-right">
                  <div className="text-xs font-medium text-amber-700">{TEXT.labels.debt}</div>
                  <div className="mt-1 text-base font-bold text-amber-700">{money(row.unpaid_amount)}</div>
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
      <PageHeading icon="lowStock" title={TEXT.headings.lowStock} description={TEXT.descriptions.lowStock} />
      <Panel className="mt-5">
        {error && <Notice>{error}</Notice>}
        {loading ? <LoadingState /> : rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr><th className="pb-3 pr-4 font-semibold">{TEXT.labels.product}</th><th className="pb-3 px-4 font-semibold">{TEXT.labels.barcode}</th><th className="pb-3 px-4 font-semibold">{TEXT.labels.lowStock}</th><th className="pb-3 pl-4 text-right font-semibold">{TEXT.labels.minStock}</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rows.map((product) => (
                  <tr key={product.id}>
                    <td className="py-3.5 pr-4 font-semibold text-slate-800">{product.name}</td>
                    <td className="px-4 py-3.5 text-slate-500">{product.barcode}</td>
                    <td className="px-4 py-3.5"><span className="rounded-full bg-rose-50 px-2.5 py-1 font-bold text-rose-700 ring-1 ring-rose-200">{product.stock_qty}</span></td>
                    <td className="py-3.5 pl-4 text-right text-slate-600">{product.min_stock}</td>
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
