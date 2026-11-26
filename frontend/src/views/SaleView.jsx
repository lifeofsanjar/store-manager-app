import { useMemo, useState } from 'react'
import { ApiError, api } from '../api.js'
import { Button, EmptyState, Field, Icon, money, Notice, PageHeading, Panel, ProductLookup, SectionTitle } from '../components.jsx'
import { TEXT } from '../text.js'

export default function SaleView({ token }) {
  const [cart, setCart] = useState([])
  const [paymentChoice, setPaymentChoice] = useState('cash')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [priceDraft, setPriceDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [receipt, setReceipt] = useState(null)

  const total = useMemo(() => cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0), [cart])

  function addProduct(product) {
    setReceipt(null)
    setError('')
    setCart((current) => {
      const existing = current.find((item) => item.product.id === product.id)
      if (existing) {
        return current.map((item) => item.product.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item)
      }
      return [...current, { product, quantity: 1, unit_price: product.sell_price }]
    })
  }

  function updateQuantity(productId, quantity) {
    const next = Math.max(1, Number(quantity) || 1)
    setCart((items) => items.map((item) => item.product.id === productId ? { ...item, quantity: next } : item))
  }

  function saveCustomPrice(productId) {
    const price = Number(priceDraft)
    if (!Number.isSafeInteger(price) || price < 0) return
    setCart((items) => items.map((item) => item.product.id === productId ? { ...item, unit_price: price } : item))
    setEditingId(null)
  }

  async function submitSale(event) {
    event.preventDefault()
    if (!cart.length) return
    if (paymentChoice === 'debt' && (!customerName.trim() || !customerPhone.trim())) {
      setError(TEXT.errors.missingNote)
      return
    }
    if (!window.confirm(TEXT.messages.confirmSale)) return
    setLoading(true)
    setError('')
    try {
      const note = paymentChoice === 'debt' ? `${customerName.trim()} · ${customerPhone.trim()}` : ''
      const result = await api('/sales/', {
        token,
        method: 'POST',
        body: {
          items: cart.map((item) => ({
            product_id: item.product.id,
            quantity: item.quantity,
            ...(item.unit_price !== item.product.sell_price ? { unit_price: item.unit_price } : {}),
          })),
          payment_choice: paymentChoice,
          note,
        },
      })
      setReceipt(result)
      setCart([])
      setCustomerName('')
      setCustomerPhone('')
      setPaymentChoice('cash')
    } catch (caught) {
      setError(caught instanceof ApiError ? TEXT.errors[caught.code] || TEXT.errors.generic : TEXT.errors.generic)
    } finally {
      setLoading(false)
    }
  }

  const paymentOptions = [
    ['cash', TEXT.labels.cash, 'cash', 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-emerald-500/20'],
    ['card', TEXT.labels.card, 'card', 'border-sky-500 bg-sky-50 text-sky-800 ring-sky-500/20'],
    ['debt', TEXT.labels.debtChoice, 'debts', 'border-amber-500 bg-amber-50 text-amber-800 ring-amber-500/20'],
  ]
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0)
  const stepButton = 'flex h-10 w-10 items-center justify-center text-lg font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-40'

  return (
    <>
      <PageHeading icon="sale" title={TEXT.headings.sale} description={TEXT.descriptions.sale} />
      {receipt && (
        <div className="mb-5">
          <Notice tone="success">
            {TEXT.messages.saleSaved} · #{receipt.id} · {TEXT.labels.total}: {money(receipt.total_amount)}
            {receipt.debt > 0 && <> · {TEXT.labels.debt}: {money(receipt.debt)}</>}
          </Notice>
        </div>
      )}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-5">
          <Panel>
            <SectionTitle>{TEXT.labels.product}</SectionTitle>
            <ProductLookup token={token} onSelect={addProduct} autoAddBarcode />
            <p className="mt-3 text-xs leading-5 text-slate-500">{TEXT.messages.scannerHint}</p>
          </Panel>

          <Panel>
            <SectionTitle aside={<span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">{cart.length} {TEXT.labels.item.toLowerCase()}</span>}>
              {TEXT.labels.item}
            </SectionTitle>
            {cart.length === 0 ? (
              <EmptyState>{TEXT.messages.emptyCart}</EmptyState>
            ) : (
              <ul className="divide-y divide-slate-100">
                {cart.map((item) => {
                  const custom = item.unit_price !== item.product.sell_price
                  return (
                    <li key={item.product.id} className="py-4 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                        <div className="min-w-0 flex-1 basis-48">
                          <div className="truncate text-[15px] font-semibold text-slate-900">{item.product.name}</div>
                          <div className="mt-0.5 text-xs text-slate-500">{item.product.barcode} · {TEXT.labels.lowStock}: {item.product.stock_qty}</div>
                        </div>
                        <div className="flex items-center overflow-hidden rounded-xl border border-slate-300 bg-white">
                          <button type="button" aria-label="-1" className={stepButton} disabled={item.quantity <= 1} onClick={() => updateQuantity(item.product.id, item.quantity - 1)}>−</button>
                          <input
                            type="number" min="1" step="1" value={item.quantity}
                            aria-label={TEXT.labels.quantity}
                            onChange={(event) => updateQuantity(item.product.id, event.target.value)}
                            className="h-10 w-14 border-x border-slate-200 text-center text-[15px] font-bold text-slate-900 outline-none focus:bg-brand-50"
                          />
                          <button type="button" aria-label="+1" className={stepButton} onClick={() => updateQuantity(item.product.id, item.quantity + 1)}>+</button>
                        </div>
                        <div className="w-32 text-right">
                          <div className="text-[15px] font-bold text-slate-900">{money(item.unit_price * item.quantity)}</div>
                          <div className={`text-xs ${custom ? 'font-semibold text-amber-700' : 'text-slate-500'}`}>{money(item.unit_price)} × {item.quantity}</div>
                        </div>
                        <button
                          type="button"
                          aria-label={TEXT.actions.remove}
                          title={TEXT.actions.remove}
                          onClick={() => setCart((items) => items.filter((row) => row.product.id !== item.product.id))}
                          className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                        >
                          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>
                        </button>
                      </div>
                      <div className="mt-2">
                        {editingId === item.product.id ? (
                          <div className="flex max-w-sm gap-2">
                            <input
                              type="number" min="0" step="1" value={priceDraft} autoFocus
                              aria-label={TEXT.labels.sellPrice}
                              onChange={(event) => setPriceDraft(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') { event.preventDefault(); saveCustomPrice(item.product.id) }
                                if (event.key === 'Escape') setEditingId(null)
                              }}
                              className="min-h-11 min-w-0 flex-1 rounded-xl border-2 border-amber-400 bg-white px-3.5 text-base font-semibold text-slate-900 outline-none focus:ring-4 focus:ring-amber-400/20"
                            />
                            <Button type="button" onClick={() => saveCustomPrice(item.product.id)}>{TEXT.actions.save}</Button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => { setEditingId(item.product.id); setPriceDraft(String(item.unit_price)) }}
                            className="rounded-lg px-2 py-1 text-xs font-semibold text-brand-700 transition hover:bg-brand-50"
                          >✎ {TEXT.actions.editPrice}</button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Panel>
        </div>

        <form onSubmit={submitSale} className="xl:sticky xl:top-8">
          <Panel>
            <SectionTitle>{TEXT.labels.payment}</SectionTitle>
            <div className="grid grid-cols-3 gap-2">
              {paymentOptions.map(([value, label, icon, activeStyle]) => (
                <button
                  type="button" key={value} onClick={() => setPaymentChoice(value)}
                  aria-pressed={paymentChoice === value}
                  className={`flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-2xl border-2 px-2 text-sm font-bold transition ${paymentChoice === value ? `${activeStyle} ring-4` : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}
                >
                  <Icon name={icon} className="h-6 w-6" />
                  {label}
                </button>
              ))}
            </div>
            {paymentChoice === 'debt' && (
              <div className="mt-4 space-y-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
                <Field label={TEXT.labels.customerName} value={customerName} onChange={(event) => setCustomerName(event.target.value)} required />
                <Field label={TEXT.labels.customerPhone} type="tel" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} required />
                <p className="text-xs leading-5 text-amber-800">{TEXT.messages.debtNote}</p>
              </div>
            )}
            <div className="mt-5 rounded-2xl bg-slate-900 p-5 text-white">
              <div className="flex items-center justify-between text-sm text-slate-300">
                <span>{TEXT.labels.quantity}</span>
                <span className="font-semibold text-white">{itemCount}</span>
              </div>
              <div className="mt-3 flex items-end justify-between gap-3 border-t border-white/10 pt-3">
                <span className="text-sm font-medium text-slate-300">{TEXT.labels.total}</span>
                <span className="text-3xl font-bold tracking-tight">{money(total)}</span>
              </div>
            </div>
            {error && <div className="mt-4"><Notice>{error}</Notice></div>}
            <Button type="submit" variant="success" className="mt-4 min-h-14 w-full rounded-2xl text-base" disabled={!cart.length || loading || (paymentChoice === 'debt' && (!customerName.trim() || !customerPhone.trim()))}>
              {loading ? TEXT.messages.loading : TEXT.actions.completeSale}
            </Button>
          </Panel>
        </form>
      </div>
    </>
  )
}
