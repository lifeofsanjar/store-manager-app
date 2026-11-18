import { useCallback, useEffect, useState } from 'react'
import { ApiError, api } from '../api.js'
import { Button, dateTime, EmptyState, Field, money, Notice, PageHeading, Panel, SelectField } from '../components.jsx'
import { TEXT } from '../text.js'

export default function TodaySalesView({ token }) {
  const [sales, setSales] = useState([])
  const [saleId, setSaleId] = useState('')
  const [expandedSaleId, setExpandedSaleId] = useState(null)
  const [debtSale, setDebtSale] = useState(null)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('cash')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const refreshSales = useCallback(async () => {
    const result = await api('/sales/today/', { token })
    setSales(result)
  }, [token])

  useEffect(() => {
    refreshSales()
      .catch((caught) => setError(caught instanceof ApiError ? TEXT.errors[caught.code] || TEXT.errors.generic : TEXT.errors.generic))
      .finally(() => setLoading(false))
  }, [refreshSales])

  async function findDebt(event, idOverride) {
    event?.preventDefault()
    const requestedId = idOverride || saleId
    if (!requestedId || !Number.isSafeInteger(Number(requestedId))) {
      setError(TEXT.errors.searchSale)
      return
    }
    setError('')
    setSuccess('')
    setSaving(true)
    try {
      const result = await api(`/sales/${Number(requestedId)}/`, { token })
      setDebtSale(result)
      setSaleId(String(requestedId))
      setAmount('')
    } catch (caught) {
      setDebtSale(null)
      setError(caught instanceof ApiError ? TEXT.errors[caught.code] || TEXT.errors.generic : TEXT.errors.generic)
    } finally {
      setSaving(false)
    }
  }

  async function recordPayment(event) {
    event.preventDefault()
    const paymentAmount = Number(amount)
    if (!debtSale || !Number.isSafeInteger(paymentAmount) || paymentAmount <= 0 || paymentAmount > debtSale.debt) {
      setError(TEXT.errors.invalid)
      return
    }
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await api(`/sales/${debtSale.id}/payments/`, {
        token,
        method: 'POST',
        body: { method, amount: paymentAmount },
      })
      const updatedDebt = await api(`/sales/${debtSale.id}/`, { token })
      setDebtSale(updatedDebt)
      setAmount('')
      await refreshSales()
      setSuccess(TEXT.messages.paymentSaved)
    } catch (caught) {
      setError(caught instanceof ApiError ? TEXT.errors[caught.code] || TEXT.errors.generic : TEXT.errors.generic)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeading title={TEXT.headings.today} description={TEXT.descriptions.today} />
      {success && <Notice tone="success">{success}</Notice>}
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <Panel>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold text-[#253c30]">{TEXT.headings.today}</h2>
            <span className="rounded-full bg-[#eef5ef] px-3 py-1 text-xs font-semibold text-[#4a6756]">{sales.length}</span>
          </div>
          {loading ? <div className="py-8 text-center text-sm text-[#77847b]">{TEXT.messages.loading}</div> : sales.length ? (
            <div className="space-y-2.5">
              {sales.map((sale) => {
                const expanded = expandedSaleId === sale.id
                return <div key={sale.id} className="overflow-hidden rounded-xl border border-[#e8ede7]">
                  <button
                    type="button" onClick={() => setExpandedSaleId(expanded ? null : sale.id)}
                    aria-expanded={expanded}
                    className="flex w-full items-center justify-between gap-3 px-3.5 py-3.5 text-left transition hover:bg-[#fbfcfa]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-[#283e32]">#{sale.id} · {sale.staff_name}</span>
                      <span className="mt-1 block text-xs text-[#87928a]">{dateTime(sale.created_at)} · {sale.items.length} {TEXT.labels.item.toLowerCase()}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      <span className="text-right">
                        <span className="block text-sm font-bold text-[#274534]">{money(sale.total_amount)}</span>
                        {sale.debt > 0 && <span className="mt-1 block text-xs font-semibold text-[#96641d]">{TEXT.labels.debt}: {money(sale.debt)}</span>}
                      </span>
                      <span aria-hidden="true" className="text-sm text-[#829087]">{expanded ? '−' : '+'}</span>
                    </span>
                  </button>
                  {expanded && <div className="border-t border-[#edf0eb] bg-[#fbfcfa] px-3.5 py-3">
                    <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-[#87928a]">{TEXT.labels.receiptItems}</h3>
                    <div className="divide-y divide-[#edf0eb]">
                      {sale.items.map((item) => <div key={item.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                        <div className="min-w-0">
                          <div className="font-semibold text-[#283e32]">{item.product_name}</div>
                          <div className="mt-0.5 text-xs text-[#87928a]">{item.quantity} × {money(item.unit_price)}{item.returned_quantity > 0 ? ` · ${TEXT.labels.returned}: ${item.returned_quantity}` : ''}</div>
                        </div>
                        <div className="shrink-0 font-semibold text-[#34473b]">{money(item.quantity * item.unit_price)}</div>
                      </div>)}
                    </div>
                  </div>}
                </div>
              })}
            </div>
          ) : <EmptyState>{TEXT.messages.noSales}</EmptyState>}
          {error && <div className="mt-4"><Notice>{error}</Notice></div>}
        </Panel>

        <Panel>
          <h2 className="text-base font-bold text-[#253c30]">{TEXT.nav.debts}</h2>
          <p className="mt-1 text-sm leading-5 text-[#78867d]">{TEXT.messages.debtNote}</p>
          <form onSubmit={findDebt} className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
            <Field label={TEXT.labels.saleId} type="number" min="1" step="1" value={saleId} onChange={(event) => setSaleId(event.target.value)} />
            <Button type="submit" variant="secondary" disabled={saving || !saleId}>{TEXT.actions.find}</Button>
          </form>
          {debtSale && (
            <div className="mt-4 rounded-2xl border border-[#e8ede7] bg-[#fbfcfa] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-[#283e32]">#{debtSale.id} · {debtSale.staff_name}</div>
                  <div className="mt-1 text-xs text-[#87928a]">{dateTime(debtSale.created_at)}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-[#7a887f]">{TEXT.labels.debt}</div>
                  <div className="text-base font-bold text-[#865913]">{money(debtSale.debt)}</div>
                </div>
              </div>
              {debtSale.debt > 0 ? (
                <form onSubmit={recordPayment} className="mt-4 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={TEXT.labels.amount} type="number" min="1" max={debtSale.debt} step="1" value={amount} onChange={(event) => setAmount(event.target.value)} required />
                    <SelectField label={TEXT.labels.payment} value={method} onChange={(event) => setMethod(event.target.value)}>
                      <option value="cash">{TEXT.labels.cash}</option>
                      <option value="card">{TEXT.labels.card}</option>
                    </SelectField>
                  </div>
                  <Button type="submit" className="w-full" disabled={saving || !amount}>{saving ? TEXT.messages.saving : TEXT.actions.recordPayment}</Button>
                </form>
              ) : <Notice tone="success">{TEXT.messages.paymentSaved}</Notice>}
            </div>
          )}
        </Panel>
      </div>
    </>
  )
}
