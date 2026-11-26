import { useState } from 'react'
import { ApiError, api } from '../api.js'
import { Button, dateTime, EmptyState, Field, money, Notice, PageHeading, Panel } from '../components.jsx'
import { TEXT } from '../text.js'

export default function ReturnView({ token }) {
  const [saleId, setSaleId] = useState('')
  const [sale, setSale] = useState(null)
  const [quantities, setQuantities] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function findSale(event) {
    event.preventDefault()
    if (!saleId || !Number.isSafeInteger(Number(saleId))) {
      setError(TEXT.errors.searchSale)
      return
    }
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const result = await api(`/sales/${Number(saleId)}/`, { token })
      setSale(result)
      setQuantities({})
    } catch (caught) {
      setSale(null)
      setError(caught instanceof ApiError ? TEXT.errors[caught.code] || TEXT.errors.generic : TEXT.errors.generic)
    } finally {
      setLoading(false)
    }
  }

  async function submitReturn(item) {
    const quantity = Number(quantities[item.id] || 1)
    if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > item.remaining_quantity) {
      setError(TEXT.errors.invalid)
      return
    }
    if (!window.confirm(TEXT.messages.confirmReturn)) return
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      await api('/returns/', {
        token,
        method: 'POST',
        body: { sale_item_id: item.id, quantity },
      })
      const updated = await api(`/sales/${sale.id}/`, { token })
      setSale(updated)
      setQuantities({})
      setSuccess(TEXT.messages.returnSaved)
    } catch (caught) {
      setError(caught instanceof ApiError ? TEXT.errors[caught.code] || TEXT.errors.generic : TEXT.errors.generic)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <PageHeading icon="returns" title={TEXT.headings.returns} description={TEXT.descriptions.returns} />
      {success && <Notice tone="success">{success}</Notice>}
      <Panel className="mt-5">
        <form onSubmit={findSale} className="grid gap-3 sm:grid-cols-[minmax(0,240px)_auto] sm:items-end">
          <Field label={TEXT.labels.saleId} inputMode="numeric" type="number" min="1" step="1" value={saleId} onChange={(event) => setSaleId(event.target.value)} required />
          <Button type="submit" variant="secondary" disabled={loading || !saleId}>{loading ? TEXT.messages.loading : TEXT.actions.showSale}</Button>
        </form>
        {error && <div className="mt-4"><Notice>{error}</Notice></div>}
      </Panel>

      {sale && (
        <Panel className="mt-5">
          <div className="flex flex-col gap-2 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-800">#{sale.id} · {sale.staff_name}</h2>
              <p className="mt-1 text-xs text-slate-500">{dateTime(sale.created_at)} · {TEXT.labels.total}: {money(sale.total_amount)}</p>
            </div>
            {sale.debt > 0 && <span className="w-fit rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">{TEXT.labels.debt}: {money(sale.debt)}</span>}
          </div>
          <div className="mt-4 space-y-3">
            {sale.items.map((item) => (
              <div key={item.id} className="grid gap-3 rounded-xl border border-slate-200 p-3.5 sm:grid-cols-[minmax(0,1fr)_110px_auto] sm:items-center">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-800">{item.product_name}</div>
                  <div className="mt-1 text-xs text-slate-500">{item.quantity} {TEXT.labels.sold.toLowerCase()} · {item.returned_quantity} {TEXT.labels.returned.toLowerCase()} · {money(item.unit_price)}</div>
                </div>
                <Field
                  label={TEXT.labels.quantity}
                  type="number"
                  min="1"
                  max={item.remaining_quantity}
                  step="1"
                  disabled={!item.remaining_quantity}
                  value={quantities[item.id] ?? '1'}
                  onChange={(event) => setQuantities({ ...quantities, [item.id]: event.target.value })}
                />
                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <span className="text-xs text-slate-500">{TEXT.labels.remaining}: {item.remaining_quantity}</span>
                  <Button type="button" variant="secondary" disabled={!item.remaining_quantity || loading} onClick={() => submitReturn(item)}>{TEXT.actions.submitReturn}</Button>
                </div>
              </div>
            ))}
            {sale.items.every((item) => item.remaining_quantity === 0) && <EmptyState>{TEXT.messages.noResults}</EmptyState>}
          </div>
          <Notice tone="info">{TEXT.messages.originalRefund}</Notice>
        </Panel>
      )}
    </>
  )
}
