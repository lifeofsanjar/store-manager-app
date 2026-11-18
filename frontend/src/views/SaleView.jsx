import { useMemo, useState } from 'react'
import { ApiError, api } from '../api.js'
import { Button, EmptyState, Field, money, Notice, PageHeading, Panel, ProductLookup } from '../components.jsx'
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

  return (
    <>
      <PageHeading title={TEXT.headings.sale} description={TEXT.descriptions.sale} />
      {receipt && (
        <Notice tone="success">
          {TEXT.messages.saleSaved} · #{receipt.id} · {TEXT.labels.total}: {money(receipt.total_amount)}
          {receipt.debt > 0 && <> · {TEXT.labels.debt}: {money(receipt.debt)}</>}
        </Notice>
      )}
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
        <Panel>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-[#253c30]">{TEXT.labels.product}</h2>
              <p className="mt-1 text-xs text-[#87928a]">{TEXT.descriptions.sale}</p>
            </div>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eef5ef] text-sm font-bold text-[#1b4937]">01</span>
          </div>
          <ProductLookup token={token} onSelect={addProduct} autoAddBarcode />
          <div className="mt-4 rounded-xl bg-[#f7f9f6] p-3.5 text-xs leading-5 text-[#7b887f]">
            {TEXT.messages.scannerHint}
          </div>
        </Panel>

        <div className="space-y-5">
        <Panel>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold text-[#253c30]">{TEXT.labels.total}</h2>
            <span className="rounded-full bg-[#eef5ef] px-3 py-1 text-xs font-semibold text-[#4a6756]">{cart.length} {TEXT.labels.item.toLowerCase()}</span>
          </div>
          {cart.length === 0 ? (
            <EmptyState>{TEXT.messages.emptyCart}</EmptyState>
          ) : (
            <div className="space-y-3">
              {cart.map((item) => (
                <div key={item.product.id} className="rounded-xl border border-[#e8ede7] p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-[#283e32]">{item.product.name}</div>
                      <div className="mt-1 text-xs text-[#87928a]">{item.product.barcode} · {TEXT.labels.lowStock}: {item.product.stock_qty}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCart((items) => items.filter((row) => row.product.id !== item.product.id))}
                      className="rounded-lg px-2 py-1 text-xs font-medium text-[#a14a44] hover:bg-[#fff4f2]"
                    >{TEXT.actions.remove}</button>
                  </div>
                  <div className="mt-3 grid grid-cols-[100px_1fr] items-end gap-3">
                    <Field
                      label={TEXT.labels.quantity}
                      type="number"
                      min="1"
                      step="1"
                      value={item.quantity}
                      onChange={(event) => updateQuantity(item.product.id, event.target.value)}
                    />
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-[#78867d]">{TEXT.labels.sellPrice}</span>
                        <button
                          type="button"
                          onClick={() => { setEditingId(item.product.id); setPriceDraft(String(item.unit_price)) }}
                          className="text-xs font-semibold text-[#477555] hover:underline"
                        >{TEXT.actions.editPrice}</button>
                      </div>
                      {editingId === item.product.id ? (
                        <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                          <input
                            type="number" min="0" step="1" value={priceDraft}
                            aria-label={TEXT.labels.sellPrice}
                            onChange={(event) => setPriceDraft(event.target.value)}
                            className="min-h-12 min-w-0 rounded-xl border border-[#cbd9ce] bg-white px-4 text-base font-semibold text-[#20372c] outline-none focus:border-[#4b8b69] focus:ring-4 focus:ring-[#4b8b69]/10"
                          />
                          <Button type="button" className="min-h-12 px-5" onClick={() => saveCustomPrice(item.product.id)}>{TEXT.actions.save}</Button>
                        </div>
                      ) : (
                        <div className="mt-2 flex items-center justify-between text-sm font-semibold text-[#2c4436]">
                          <span>{money(item.unit_price)} × {item.quantity}</span>
                          <span>{money(item.unit_price * item.quantity)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
        <form onSubmit={submitSale}>
          <Panel>
            <div>
              <h2 className="text-base font-bold text-[#253c30]">{TEXT.labels.payment}</h2>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[
                  ['cash', TEXT.labels.cash],
                  ['card', TEXT.labels.card],
                  ['debt', TEXT.labels.debtChoice],
                ].map(([value, label]) => (
                  <button
                    type="button" key={value} onClick={() => setPaymentChoice(value)}
                    aria-pressed={paymentChoice === value}
                    className={`min-h-12 rounded-xl border px-3 text-sm font-semibold transition ${paymentChoice === value ? 'border-[#1b4937] bg-[#eaf3ec] text-[#1b4937] ring-2 ring-[#1b4937]/10' : 'border-[#e2e8e1] bg-white text-[#728078] hover:bg-[#f6f8f5]'}`}
                  >{label}</button>
                ))}
              </div>
              {paymentChoice === 'debt' && (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Field label={TEXT.labels.customerName} value={customerName} onChange={(event) => setCustomerName(event.target.value)} required />
                  <Field label={TEXT.labels.customerPhone} type="tel" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} required />
                  <p className="text-xs leading-5 text-[#7c887f] sm:col-span-2">{TEXT.messages.debtNote}</p>
                </div>
              )}
            </div>
            <div className="mt-5 rounded-2xl bg-[#f6f8f5] p-4 sm:p-5">
              <div className="flex items-center justify-between text-sm text-[#738077]">
                <span>{TEXT.labels.total}</span>
                <span className="font-semibold text-[#34473b]">{cart.length} {TEXT.labels.item.toLowerCase()}</span>
              </div>
              <div className="mt-2 flex items-end justify-between gap-3">
                <span className="text-sm font-medium text-[#536359]">{TEXT.labels.amount}</span>
                <span className="text-2xl font-bold tracking-tight text-[#183c2d]">{money(total)}</span>
              </div>
              {error && <div className="mt-4"><Notice>{error}</Notice></div>}
              <Button type="submit" className="mt-5 w-full" disabled={!cart.length || loading || (paymentChoice === 'debt' && (!customerName.trim() || !customerPhone.trim()))}>
                {loading ? TEXT.messages.loading : TEXT.actions.completeSale}
              </Button>
            </div>
          </Panel>
        </form>
        </div>
      </div>
    </>
  )
}
